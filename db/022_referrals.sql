-- 022: polecenia. Nagroda dla obu po pierwszym zakupie poleconej osoby (nowe konto), limit nagrodzonych poleceń / miesiąc.
alter table public.loyalty_events drop constraint if exists loyalty_events_kind_check;
alter table public.loyalty_events add constraint loyalty_events_kind_check check (kind in ('stamp','points','redeem','adjust','referral'));

create table if not exists public.referrals (
  id bigserial primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  referrer_id uuid not null references public.customers(id) on delete cascade,
  referred_id uuid not null references public.customers(id) on delete cascade,
  created_at timestamptz not null default now(),
  rewarded_at timestamptz,
  referrer_rewarded boolean not null default false,
  unique (restaurant_id, referred_id),
  check (referrer_id <> referred_id)
);
create index if not exists referrals_referrer on public.referrals(referrer_id, restaurant_id, rewarded_at);
alter table public.referrals enable row level security;
revoke all on public.referrals from anon, authenticated;

create or replace function public._ref_cfg(r public.restaurants) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'enabled', coalesce((r.settings #>> '{loyalty,referral,enabled}')::boolean, true),
    'limit', greatest(0, coalesce((r.settings #>> '{loyalty,referral,limit}')::int, 3)),
    'bonus', greatest(1, coalesce((r.settings #>> '{loyalty,referral,bonus}')::int,
               case when coalesce(r.settings #>> '{loyalty,mode}', 'stamps') = 'points' then 50 else 1 end)));
$$;

-- dopisuje premię (pieczątki albo punkty) bez naliczania kolejnych poleceń
create or replace function public._bonus(p_cust uuid, p_rest uuid, p_n int, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.restaurants; l jsonb; need int;
begin
  select * into r from public.restaurants where id = p_rest; l := public._loy(r);
  insert into public.loyalty_cards(customer_id, restaurant_id) values (p_cust, p_rest) on conflict do nothing;
  if l->>'mode' = 'points' then
    update public.loyalty_cards set points = points + p_n, updated_at = now() where customer_id = p_cust and restaurant_id = p_rest;
  else
    need := (l->>'need')::int;
    update public.loyalty_cards set rewards = rewards + (stamps + p_n) / need, stamps = (stamps + p_n) % need,
      total_stamps = total_stamps + p_n, updated_at = now() where customer_id = p_cust and restaurant_id = p_rest;
  end if;
  insert into public.loyalty_events(customer_id, restaurant_id, kind, delta, note) values (p_cust, p_rest, 'referral', p_n, p_note);
end $$;

-- po pierwszym zakupie poleconej osoby
create or replace function public._ref_award(p_cust uuid, p_rest uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare f public.referrals; r public.restaurants; c jsonb; used int;
begin
  select * into f from public.referrals where restaurant_id = p_rest and referred_id = p_cust and rewarded_at is null for update;
  if f.id is null then return; end if;
  select * into r from public.restaurants where id = p_rest; c := public._ref_cfg(r);
  update public.referrals set rewarded_at = now() where id = f.id;
  if not (c->>'enabled')::boolean then return; end if;
  perform public._bonus(p_cust, p_rest, (c->>'bonus')::int, 'Polecenie: pierwszy zakup');
  select count(*) into used from public.referrals x where x.referrer_id = f.referrer_id and x.restaurant_id = p_rest
     and x.referrer_rewarded and x.rewarded_at >= date_trunc('month', now());
  if used < (c->>'limit')::int then
    update public.referrals set referrer_rewarded = true where id = f.id;
    perform public._bonus(f.referrer_id, p_rest, (c->>'bonus')::int, 'Polecenie: znajomy zrobił zakupy');
  end if;
end $$;

-- _award: po naliczeniu sprawdza polecenie
create or replace function public._award(p_cust uuid, p_rest uuid, p_order uuid, p_amount numeric, p_count int, p_staff uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare r public.restaurants; l jsonb; n int; pts int; need int; ins int;
begin
  select * into r from public.restaurants where id = p_rest;
  l := public._loy(r);
  if not (l->>'enabled')::boolean then return false; end if;
  insert into public.loyalty_cards(customer_id, restaurant_id) values (p_cust, p_rest) on conflict do nothing;
  if l->>'mode' = 'points' then
    pts := greatest(0, floor(coalesce(p_amount,0) * (l->>'per_zl')::numeric))::int;
    if pts = 0 then return false; end if;
    insert into public.loyalty_events(customer_id, restaurant_id, kind, delta, order_id, staff)
      values (p_cust, p_rest, 'points', pts, p_order, p_staff) on conflict do nothing;
    get diagnostics ins = row_count; if ins = 0 then return false; end if;
    update public.loyalty_cards set points = points + pts, updated_at = now() where customer_id = p_cust and restaurant_id = p_rest;
  else
    n := greatest(1, least(10, coalesce(p_count,1)));
    need := (l->>'need')::int;
    insert into public.loyalty_events(customer_id, restaurant_id, kind, delta, order_id, staff)
      values (p_cust, p_rest, 'stamp', n, p_order, p_staff) on conflict do nothing;
    get diagnostics ins = row_count; if ins = 0 then return false; end if;
    update public.loyalty_cards set rewards = rewards + (stamps + n) / need, stamps = (stamps + n) % need,
      total_stamps = total_stamps + n, updated_at = now() where customer_id = p_cust and restaurant_id = p_rest;
  end if;
  perform public._ref_award(p_cust, p_rest);
  return true;
end $$;

-- klient przyjmuje zaproszenie (tylko nowe konto, bez wcześniejszych zakupów w tym lokalu)
create or replace function public.cust_claim_referral(p_token text, p_restaurant text, p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare cid uuid; me public.customers; ref public.customers; r public.restaurants; c jsonb;
begin
  cid := public._session(p_token);
  select * into me from public.customers where id = cid;
  select * into r from public.restaurants where slug = p_restaurant;
  if r.id is null then raise exception 'Nie ma takiego lokalu'; end if;
  c := public._ref_cfg(r);
  if not (c->>'enabled')::boolean then return jsonb_build_object('ok', false, 'reason', 'Ten lokal nie prowadzi teraz poleceń'); end if;
  select * into ref from public.customers where code = upper(btrim(p_code));
  if ref.id is null then return jsonb_build_object('ok', false, 'reason', 'Nieznany kod zaproszenia'); end if;
  if ref.id = cid then return jsonb_build_object('ok', false, 'reason', 'Nie możesz polecić samego siebie'); end if;
  if exists (select 1 from public.referrals where restaurant_id = r.id and referred_id = cid) then
    return jsonb_build_object('ok', false, 'reason', 'Zaproszenie zostało już przyjęte'); end if;
  if me.created_at < now() - interval '7 days'
     or exists (select 1 from public.loyalty_events e where e.customer_id = cid and e.restaurant_id = r.id)
     or exists (select 1 from public.orders o where o.customer_id = cid and o.restaurant_id = r.id and o.status <> 'cancelled') then
    return jsonb_build_object('ok', false, 'reason', 'Zaproszenia działają tylko dla nowych klientów'); end if;
  insert into public.referrals(restaurant_id, referrer_id, referred_id) values (r.id, ref.id, cid);
  return jsonb_build_object('ok', true, 'from', coalesce(ref.name, 'znajomy'), 'bonus', c->'bonus', 'mode', public._loy(r)->'mode');
end $$;

-- statystyka poleceń dla klienta
create or replace function public.cust_referrals(p_token text, p_restaurant text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare cid uuid; r public.restaurants; c jsonb;
begin
  cid := public._session(p_token);
  select * into r from public.restaurants where slug = p_restaurant;
  if r.id is null then raise exception 'Nie ma takiego lokalu'; end if;
  c := public._ref_cfg(r);
  return c || jsonb_build_object('mode', public._loy(r)->'mode',
    'code', (select code from public.customers where id = cid),
    'used', (select count(*) from public.referrals x where x.referrer_id = cid and x.restaurant_id = r.id and x.referrer_rewarded and x.rewarded_at >= date_trunc('month', now())),
    'pending', (select count(*) from public.referrals x where x.referrer_id = cid and x.restaurant_id = r.id and x.rewarded_at is null));
end $$;

revoke execute on function public._ref_cfg(public.restaurants), public._bonus(uuid,uuid,int,text), public._ref_award(uuid,uuid), public._award(uuid,uuid,uuid,numeric,int,uuid) from public, anon, authenticated;
grant execute on function public.cust_claim_referral(text,text,text), public.cust_referrals(text,text) to anon, authenticated;
