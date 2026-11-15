-- 016: konta klientów, karta pieczątek / punkty, ulubione (dzień 1)
-- Dostęp tylko przez funkcje SECURITY DEFINER; tabele mają RLS bez polityk.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique check (phone ~ '^[0-9]{8,15}$'),
  name text check (name is null or length(name) between 1 and 60),
  code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create table if not exists public.customer_sessions (
  token_hash text primary key,
  customer_id uuid not null references public.customers(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '180 days'
);
create index if not exists customer_sessions_cust on public.customer_sessions(customer_id);

create table if not exists public.otp_codes (
  id bigserial primary key,
  phone text not null,
  code_hash text not null,
  ip text,
  attempts int not null default 0,
  used boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '5 minutes'
);
create index if not exists otp_codes_phone on public.otp_codes(phone, created_at desc);
create index if not exists otp_codes_ip on public.otp_codes(ip, created_at desc);

create table if not exists public.loyalty_cards (
  customer_id uuid not null references public.customers(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  stamps int not null default 0 check (stamps >= 0),
  rewards int not null default 0 check (rewards >= 0),
  points int not null default 0 check (points >= 0),
  total_stamps int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (customer_id, restaurant_id)
);
create index if not exists loyalty_cards_rest on public.loyalty_cards(restaurant_id);

create table if not exists public.loyalty_events (
  id bigserial primary key,
  customer_id uuid not null references public.customers(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  kind text not null check (kind in ('stamp','points','redeem','adjust')),
  delta int not null,
  order_id uuid references public.orders(id) on delete set null,
  staff uuid,
  note text,
  created_at timestamptz not null default now()
);
create unique index if not exists loyalty_events_order_once on public.loyalty_events(order_id, kind) where order_id is not null;
create index if not exists loyalty_events_card on public.loyalty_events(customer_id, restaurant_id, created_at desc);

create table if not exists public.customer_favorites (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) < 4000),
  created_at timestamptz not null default now()
);
create index if not exists customer_favorites_cust on public.customer_favorites(customer_id, restaurant_id);

alter table public.orders add column if not exists customer_id uuid references public.customers(id) on delete set null;
create index if not exists orders_customer on public.orders(customer_id);

alter table public.customers enable row level security;
alter table public.customer_sessions enable row level security;
alter table public.otp_codes enable row level security;
alter table public.loyalty_cards enable row level security;
alter table public.loyalty_events enable row level security;
alter table public.customer_favorites enable row level security;
revoke all on public.customers, public.customer_sessions, public.otp_codes, public.loyalty_cards, public.loyalty_events, public.customer_favorites from anon, authenticated;

-- ===== pomocnicze =====
create or replace function public._session(p_token text) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare cid uuid;
begin
  if p_token is null or length(p_token) < 32 then raise exception 'Zaloguj się ponownie' using errcode = '28000'; end if;
  select s.customer_id into cid from public.customer_sessions s
   where s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and s.expires_at > now();
  if cid is null then raise exception 'Zaloguj się ponownie' using errcode = '28000'; end if;
  return cid;
end $$;

create or replace function public._loy(r public.restaurants) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'mode', coalesce(r.settings #>> '{loyalty,mode}', 'stamps'),
    'need', greatest(2, least(30, coalesce((r.settings #>> '{loyalty,need}')::int, 8))),
    'reward', coalesce(r.settings #>> '{loyalty,reward}', 'Nagroda gratis'),
    'per_zl', coalesce((r.settings #>> '{loyalty,per_zl}')::numeric, 1),
    'rewards', coalesce(r.settings #> '{loyalty,rewards}', '[]'::jsonb),
    'enabled', coalesce((r.settings #>> '{loyalty,enabled}')::boolean, true)
  );
$$;

create or replace function public._card_json(p_cust uuid, p_rest uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r public.restaurants; c public.loyalty_cards; l jsonb;
begin
  select * into r from public.restaurants where id = p_rest;
  select * into c from public.loyalty_cards where customer_id = p_cust and restaurant_id = p_rest;
  l := public._loy(r);
  return jsonb_build_object('mode', l->'mode', 'need', l->'need', 'reward', l->'reward', 'rewards_catalog', l->'rewards',
    'stamps', coalesce(c.stamps,0), 'rewards', coalesce(c.rewards,0), 'points', coalesce(c.points,0), 'total', coalesce(c.total_stamps,0));
end $$;

-- nalicza pieczątki/punkty; zwraca true gdy naliczono
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
    update public.loyalty_cards set
      rewards = rewards + (stamps + n) / need,
      stamps = (stamps + n) % need,
      total_stamps = total_stamps + n,
      updated_at = now()
     where customer_id = p_cust and restaurant_id = p_rest;
  end if;
  return true;
end $$;

-- automatyczne naliczanie po wydaniu zamówienia
create or replace function public._order_award() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.customer_id is not null and new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done' or old.customer_id is null) then
    perform public._award(new.customer_id, new.restaurant_id, new.id, new.total, 1, null);
  end if;
  return new;
end $$;
drop trigger if exists orders_award on public.orders;
create trigger orders_award after insert or update of status, customer_id on public.orders
  for each row execute function public._order_award();

-- ===== API klienta (token sesji z funkcji customer-auth) =====
create or replace function public.cust_me(p_token text, p_restaurant text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare cid uuid; c public.customers; r public.restaurants; res jsonb;
begin
  cid := public._session(p_token);
  update public.customers set last_seen = now() where id = cid returning * into c;
  res := jsonb_build_object('name', c.name, 'phone', public._mask_phone(c.phone), 'code', c.code);
  if p_restaurant is not null then
    select * into r from public.restaurants where slug = p_restaurant;
    if r.id is not null then
      res := res || jsonb_build_object(
        'card', public._card_json(cid, r.id),
        'favorites', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'data', f.data) order by f.created_at)
                                from public.customer_favorites f where f.customer_id = cid and f.restaurant_id = r.id), '[]'::jsonb),
        'history', coalesce((select jsonb_agg(jsonb_build_object('kind', e.kind, 'delta', e.delta, 'at', e.created_at) order by e.created_at desc)
                              from (select * from public.loyalty_events e2 where e2.customer_id = cid and e2.restaurant_id = r.id order by e2.created_at desc limit 20) e), '[]'::jsonb));
    end if;
  end if;
  return res;
end $$;

create or replace function public.cust_set_name(p_token text, p_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  cid := public._session(p_token);
  update public.customers set name = nullif(btrim(left(p_name, 60)), '') where id = cid;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.cust_logout(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.customer_sessions where token_hash = encode(extensions.digest(coalesce(p_token,''), 'sha256'), 'hex');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.cust_fav_save(p_token text, p_restaurant text, p_name text, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare cid uuid; rid uuid; fid uuid;
begin
  cid := public._session(p_token);
  select id into rid from public.restaurants where slug = p_restaurant;
  if rid is null then raise exception 'Nie ma takiego lokalu'; end if;
  if (select count(*) from public.customer_favorites where customer_id = cid and restaurant_id = rid) >= 8 then
    raise exception 'Masz już 8 ulubionych. Usuń jedną, żeby dodać nową.';
  end if;
  insert into public.customer_favorites(customer_id, restaurant_id, name, data)
    values (cid, rid, left(btrim(p_name), 80), coalesce(p_data, '{}'::jsonb)) returning id into fid;
  return jsonb_build_object('id', fid);
end $$;

create or replace function public.cust_fav_delete(p_token text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  cid := public._session(p_token);
  delete from public.customer_favorites where id = p_id and customer_id = cid;
  return jsonb_build_object('ok', true);
end $$;

-- przypina świeże zamówienie (z track_token) do konta klienta
create or replace function public.cust_attach_order(p_token text, p_order uuid, p_track uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare cid uuid; o public.orders;
begin
  cid := public._session(p_token);
  select * into o from public.orders where id = p_order and track_token = p_track;
  if o.id is null then raise exception 'Nie znaleziono zamówienia'; end if;
  if o.customer_id is not null and o.customer_id <> cid then raise exception 'Zamówienie należy do innego konta'; end if;
  if o.created_at < now() - interval '2 hours' then raise exception 'Za późno, żeby przypiąć to zamówienie'; end if;
  update public.orders set customer_id = cid where id = o.id;
  update public.customers set name = coalesce(name, o.customer_name) where id = cid;
  return jsonb_build_object('ok', true, 'card', public._card_json(cid, o.restaurant_id));
end $$;

-- ===== API obsługi (panel kuchni / lada) =====
create or replace function public._can_serve(rid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_staff(rid) or exists (select 1 from public.restaurants r where r.id = rid and coalesce((r.settings->>'demo')::boolean, false));
$$;

create or replace function public.staff_card(p_restaurant text, p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.restaurants; c public.customers;
begin
  select * into r from public.restaurants where slug = p_restaurant;
  if r.id is null or not public._can_serve(r.id) then raise exception 'Brak dostępu'; end if;
  select * into c from public.customers where code = upper(btrim(p_code));
  if c.id is null then raise exception 'Nie znaleziono karty klienta'; end if;
  return jsonb_build_object('name', coalesce(c.name, 'Klient'), 'phone', public._mask_phone(c.phone), 'code', c.code, 'card', public._card_json(c.id, r.id));
end $$;

create or replace function public.staff_stamp(p_restaurant text, p_code text, p_count int default 1, p_amount numeric default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.restaurants; c public.customers; recent int; demo boolean;
begin
  select * into r from public.restaurants where slug = p_restaurant;
  if r.id is null or not public._can_serve(r.id) then raise exception 'Brak dostępu'; end if;
  demo := coalesce((r.settings->>'demo')::boolean, false) and not public.is_staff(r.id);
  select * into c from public.customers where code = upper(btrim(p_code));
  if c.id is null then raise exception 'Nie znaleziono karty klienta'; end if;
  -- ochrona przed podwójnym skanem: ta sama karta w tym lokalu najwyżej co 60 s
  select count(*) into recent from public.loyalty_events e
   where e.customer_id = c.id and e.restaurant_id = r.id and e.kind in ('stamp','points') and e.order_id is null and e.created_at > now() - interval '60 seconds';
  if recent > 0 then raise exception 'Ta karta była skanowana przed chwilą. Odczekaj minutę.'; end if;
  if demo and coalesce(p_count,1) > 2 then raise exception 'W demo maksymalnie 2 pieczątki naraz'; end if;
  perform public._award(c.id, r.id, null, p_amount, p_count, auth.uid());
  return jsonb_build_object('name', coalesce(c.name, 'Klient'), 'card', public._card_json(c.id, r.id));
end $$;

create or replace function public.staff_redeem(p_restaurant text, p_code text, p_reward text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.restaurants; c public.customers; card public.loyalty_cards; l jsonb; cost int; rname text;
begin
  select * into r from public.restaurants where slug = p_restaurant;
  if r.id is null or not public._can_serve(r.id) then raise exception 'Brak dostępu'; end if;
  select * into c from public.customers where code = upper(btrim(p_code));
  if c.id is null then raise exception 'Nie znaleziono karty klienta'; end if;
  select * into card from public.loyalty_cards where customer_id = c.id and restaurant_id = r.id for update;
  l := public._loy(r);
  if l->>'mode' = 'points' then
    select (x->>'cost')::int, x->>'name' into cost, rname from jsonb_array_elements(l->'rewards') x where x->>'id' = p_reward;
    if cost is null then raise exception 'Wybierz nagrodę'; end if;
    if coalesce(card.points,0) < cost then raise exception 'Za mało punktów'; end if;
    update public.loyalty_cards set points = points - cost, updated_at = now() where customer_id = c.id and restaurant_id = r.id;
    insert into public.loyalty_events(customer_id, restaurant_id, kind, delta, staff, note) values (c.id, r.id, 'redeem', -cost, auth.uid(), rname);
  else
    if coalesce(card.rewards,0) < 1 then raise exception 'Klient nie ma jeszcze nagrody do odbioru'; end if;
    update public.loyalty_cards set rewards = rewards - 1, updated_at = now() where customer_id = c.id and restaurant_id = r.id;
    insert into public.loyalty_events(customer_id, restaurant_id, kind, delta, staff, note) values (c.id, r.id, 'redeem', -1, auth.uid(), l->>'reward');
  end if;
  return jsonb_build_object('name', coalesce(c.name, 'Klient'), 'card', public._card_json(c.id, r.id));
end $$;

-- uprawnienia: tylko funkcje publiczne
revoke execute on function public._session(text), public._award(uuid,uuid,uuid,numeric,int,uuid), public._card_json(uuid,uuid), public._order_award(), public._can_serve(uuid), public._loy(public.restaurants) from public, anon, authenticated;
grant execute on function public.cust_me(text,text), public.cust_set_name(text,text), public.cust_logout(text),
  public.cust_fav_save(text,text,text,jsonb), public.cust_fav_delete(text,uuid), public.cust_attach_order(text,uuid,uuid),
  public.staff_card(text,text), public.staff_stamp(text,text,int,numeric), public.staff_redeem(text,text,text) to anon, authenticated;

-- lokale demo bez zamówień online: bubble tea i piekarnia (do kart)
insert into public.restaurants(slug, name, module, is_open, settings)
values ('bubble-tea', 'Bubble tea', 'inne', true, '{"demo":true,"loyalty":{"mode":"stamps","need":8,"reward":"Darmowa herbata"}}'),
       ('bulkaikromka', 'Bułka i Kromka', 'piekarnia', true, '{"demo":true,"loyalty":{"mode":"points","per_zl":1,"rewards":[{"id":"kawa","name":"Kawa","cost":150},{"id":"drozdzowka","name":"Drożdżówka","cost":200},{"id":"chleb","name":"Chleb","cost":300}]}}')
on conflict (slug) do nothing;
