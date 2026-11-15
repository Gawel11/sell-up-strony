-- 024: powiadomienia push (Web Push). Klucze VAPID i sekret haka w app_secrets (wpisywane poza repozytorium).
create extension if not exists pg_net with schema extensions;

create table if not exists public.app_secrets (name text primary key, value text not null);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;
insert into public.app_secrets(name, value) values ('push_hook', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')) on conflict do nothing;

create table if not exists public.push_subscriptions (
  id bigserial primary key,
  customer_id uuid references public.customers(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  ua text,
  created_at timestamptz not null default now(),
  last_ok timestamptz
);
create index if not exists push_subs_cust on public.push_subscriptions(customer_id, restaurant_id);
create index if not exists push_subs_rest on public.push_subscriptions(restaurant_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

create table if not exists public.push_campaigns (
  id bigserial primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  title text not null, body text not null, url text,
  sent int not null default 0, created_by uuid, created_at timestamptz not null default now()
);
alter table public.push_campaigns enable row level security;
revoke all on public.push_campaigns from anon, authenticated;

create or replace function public.cust_push_subscribe(p_token text, p_restaurant text, p_sub jsonb, p_ua text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare cid uuid; rid uuid;
begin
  cid := public._session(p_token);
  select id into rid from public.restaurants where slug = p_restaurant;
  if rid is null then raise exception 'Nie ma takiego lokalu'; end if;
  if coalesce(p_sub->>'endpoint','') !~ '^https://' or p_sub #>> '{keys,p256dh}' is null or p_sub #>> '{keys,auth}' is null then raise exception 'Zła subskrypcja'; end if;
  insert into public.push_subscriptions(customer_id, restaurant_id, endpoint, p256dh, auth, ua)
  values (cid, rid, p_sub->>'endpoint', p_sub #>> '{keys,p256dh}', p_sub #>> '{keys,auth}', left(p_ua, 200))
  on conflict (endpoint) do update set customer_id = excluded.customer_id, restaurant_id = excluded.restaurant_id, p256dh = excluded.p256dh, auth = excluded.auth;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.cust_push_subscribe(text, text, jsonb, text) to anon, authenticated;

-- zmiana statusu zamówienia klienta z kontem -> funkcja push-send
create or replace function public._order_push() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.customer_id is not null and new.status is distinct from old.status and new.status in ('cooking','ready','delivering','cancelled')
     and exists (select 1 from public.push_subscriptions s where s.customer_id = new.customer_id and s.restaurant_id = new.restaurant_id) then
    perform net.http_post(
      url := 'https://medldonrwgoxfryandbp.supabase.co/functions/v1/push-send',
      body := jsonb_build_object('type', 'order', 'order_id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook', (select value from public.app_secrets where name = 'push_hook')));
  end if;
  return new;
end $$;
drop trigger if exists orders_push on public.orders;
create trigger orders_push after update of status on public.orders for each row execute function public._order_push();
revoke execute on function public._order_push() from public, anon, authenticated;
