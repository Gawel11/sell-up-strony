-- 027: pakiety (start / pro / pro_ai) ustawiane przez administratora Sell-UP + alarm o nieodebranym zamówieniu
create table if not exists public.app_admins (user_id uuid primary key);
alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon, authenticated;
insert into public.app_admins(user_id) values ('3321d84e-f84d-434c-83a7-9df44abd880e') on conflict do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$ select exists (select 1 from public.app_admins a where a.user_id = (select auth.uid())); $$;
grant execute on function public.is_admin() to authenticated;

-- pakiet lokalu; brak wpisu = start
create or replace function public._plan(p_rest uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select r.settings->>'plan' from public.restaurants r where r.id = p_rest), 'start');
$$;
revoke execute on function public._plan(uuid) from public, anon, authenticated;

create or replace function public.admin_set_plan(p_restaurant uuid, p_plan text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Tylko administrator Sell-UP'; end if;
  if p_plan not in ('start','pro','pro_ai') then raise exception 'Zły pakiet'; end if;
  update public.restaurants set settings = settings || jsonb_build_object('plan', p_plan) where id = p_restaurant;
  return jsonb_build_object('ok', true, 'plan', p_plan);
end $$;
grant execute on function public.admin_set_plan(uuid, text) to authenticated;

-- dema i obecne lokale: pełny pakiet
update public.restaurants set settings = settings || '{"plan":"pro_ai"}' where settings->>'plan' is null;

-- zamawianie online tylko w PRO i PRO AI
create or replace function public._orders_plan_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public._plan(new.restaurant_id) = 'start' then raise exception 'Zamawianie online jest dostępne w pakiecie PRO'; end if;
  return new;
end $$;
drop trigger if exists orders_plan_check on public.orders;
create trigger orders_plan_check before insert on public.orders for each row execute function public._orders_plan_check();
revoke execute on function public._orders_plan_check() from public, anon, authenticated;

-- alarm: kiedy wysłano SMS do lokalu
alter table public.orders add column if not exists alarm_at timestamptz;

-- 028: właściciel nie zmieni sobie pakietu; informacja o pakiecie dla panelu
create or replace function public._plan_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.settings->>'plan') is distinct from (old.settings->>'plan') and auth.uid() is not null and not public.is_admin() then
    new.settings := jsonb_set(new.settings, '{plan}', coalesce(old.settings->'plan', '"start"'::jsonb));
  end if;
  return new;
end $$;
drop trigger if exists restaurants_plan_guard on public.restaurants;
create trigger restaurants_plan_guard before update of settings on public.restaurants for each row execute function public._plan_guard();
revoke execute on function public._plan_guard() from public, anon, authenticated;

create or replace function public.staff_plan(p_restaurant uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff(p_restaurant) and not public.is_admin() then raise exception 'Brak dostępu'; end if;
  return jsonb_build_object('plan', public._plan(p_restaurant), 'admin', public.is_admin());
end $$;
grant execute on function public.staff_plan(uuid) to authenticated;

-- 029: CRM tylko w PRO
create or replace function public.staff_customers(p_restaurant uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff(p_restaurant) then raise exception 'Brak dostępu'; end if;
  if public._plan(p_restaurant) = 'start' then raise exception 'Baza klientów (CRM) jest dostępna w pakiecie PRO'; end if;
  return coalesce((select jsonb_agg(x order by x.last_at desc nulls last) from (
    select c.id, c.name, c.phone, c.code, c.created_at,
      (select count(*) from public.orders o where o.customer_id = c.id and o.restaurant_id = p_restaurant and o.status <> 'cancelled') as orders,
      (select coalesce(sum(o.total), 0) from public.orders o where o.customer_id = c.id and o.restaurant_id = p_restaurant and o.status <> 'cancelled') as spent,
      (select count(*) from public.loyalty_events e where e.customer_id = c.id and e.restaurant_id = p_restaurant and e.kind in ('stamp','points') and e.order_id is null) as visits,
      greatest((select max(o.created_at) from public.orders o where o.customer_id = c.id and o.restaurant_id = p_restaurant),
               (select max(e.created_at) from public.loyalty_events e where e.customer_id = c.id and e.restaurant_id = p_restaurant)) as last_at,
      (select jsonb_build_object('stamps', k.stamps, 'rewards', k.rewards, 'points', k.points, 'total', k.total_stamps) from public.loyalty_cards k where k.customer_id = c.id and k.restaurant_id = p_restaurant) as card,
      (select count(*) from public.loyalty_events e where e.customer_id = c.id and e.restaurant_id = p_restaurant and e.kind = 'redeem') as redeemed,
      (select count(*) from public.referrals f where f.referrer_id = c.id and f.restaurant_id = p_restaurant and f.rewarded_at is not null) as invited,
      (select coalesce(u.name, 'klient') from public.referrals f join public.customers u on u.id = f.referrer_id where f.referred_id = c.id and f.restaurant_id = p_restaurant) as invited_by
    from public.customers c
    where exists (select 1 from public.orders o where o.customer_id = c.id and o.restaurant_id = p_restaurant)
       or exists (select 1 from public.loyalty_cards k where k.customer_id = c.id and k.restaurant_id = p_restaurant)
       or exists (select 1 from public.referrals f where f.referred_id = c.id and f.restaurant_id = p_restaurant)
    limit 2000) x), '[]'::jsonb);
end $$;

-- 030: co minutę sprawdzanie nieodebranych zamówień -> funkcja order-alarm (SMS do lokalu)
create extension if not exists pg_cron;
create or replace function public._alarm_tick() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.orders where status = 'new' and alarm_at is null and created_at < now() - interval '4 minutes' and created_at > now() - interval '2 hours') then
    perform net.http_post(url := 'https://medldonrwgoxfryandbp.supabase.co/functions/v1/order-alarm', body := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook', (select value from public.app_secrets where name = 'push_hook')));
  end if;
end $$;
revoke execute on function public._alarm_tick() from public, anon, authenticated;
select cron.schedule('order-alarm', '* * * * *', 'select public._alarm_tick()');
