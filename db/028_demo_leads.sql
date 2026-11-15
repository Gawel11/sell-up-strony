-- Leady z dem: testowe zamówienie wymaga numeru potwierdzonego SMS-em.
alter table public.leads add column if not exists customer_id uuid references public.customers(id) on delete set null;
alter table public.leads add column if not exists order_id uuid references public.orders(id) on delete set null;
alter table public.leads add column if not exists has_venue text;
alter table public.leads add column if not exists sms_at timestamptz;
alter table public.leads add column if not exists alert_at timestamptz;
create index if not exists leads_customer_idx on public.leads(customer_id, created_at desc);

-- Zapis leada z dema (jeden na klienta na dobę; kolejne zamówienia go aktualizują).
create or replace function public.cust_demo_lead(p_token text, p_slug text, p_venue text, p_consent boolean, p_order uuid default null, p_track uuid default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare c public.customers; r public.restaurants; o public.orders; v_id uuid; v_new boolean := false;
  v_venue text := case when p_venue in ('tak','planuje','nie') then p_venue else null end;
begin
  select * into c from public.customers where id = public._session(p_token);
  if c.id is null then raise exception 'Zaloguj się ponownie' using errcode = '28000'; end if;
  select * into r from public.restaurants where slug = p_slug;
  if r.id is null or not coalesce((r.settings->>'demo')::boolean, false) then return jsonb_build_object('ok', false); end if;
  if p_order is not null then
    select * into o from public.orders where id = p_order and track_token = p_track and restaurant_id = r.id;
  end if;
  select id into v_id from public.leads where customer_id = c.id and created_at > now() - interval '1 day' order by created_at desc limit 1;
  if v_id is null then
    insert into public.leads(name, phone, segment, source, consent, consent_text, customer_id, order_id, has_venue, message, status)
    values (c.name, c.phone, case v_venue when 'tak' then 'Ma lokal' when 'planuje' then 'Planuje lokal' when 'nie' then 'Klient / ciekawski' end,
      'demo:' || p_slug, coalesce(p_consent, false),
      case when coalesce(p_consent, false) then 'Chcę, żeby Sell-UP zadzwonił do mnie z ofertą.' end,
      c.id, o.id, v_venue, case when o.id is not null then 'Testowe zamówienie nr ' || o.number || ' w demo ' || r.name end, 'nowy')
    returning id into v_id; v_new := true;
  else
    update public.leads set
      name = coalesce(c.name, name),
      has_venue = coalesce(v_venue, has_venue),
      segment = coalesce(case v_venue when 'tak' then 'Ma lokal' when 'planuje' then 'Planuje lokal' when 'nie' then 'Klient / ciekawski' end, segment),
      consent = consent or coalesce(p_consent, false),
      consent_text = case when consent or coalesce(p_consent, false) then 'Chcę, żeby Sell-UP zadzwonił do mnie z ofertą.' end,
      order_id = coalesce(o.id, order_id),
      source = case when source like '%demo:' || p_slug || '%' then source else left(source || ', demo:' || p_slug, 80) end,
      message = case when o.id is not null then left(coalesce(message || '; ', '') || 'zamówienie nr ' || o.number || ' (' || r.name || ')', 1000) else message end
    where id = v_id;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id, 'new', v_new);
end $$;
revoke all on function public.cust_demo_lead(text, text, text, boolean, uuid, uuid) from public;
grant execute on function public.cust_demo_lead(text, text, text, boolean, uuid, uuid) to anon, authenticated;

-- Czy klient już odpowiadał na pytania leada (żeby nie pytać drugi raz).
create or replace function public.cust_demo_asked(p_token text)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.leads l where l.customer_id = public._session(p_token) and l.has_venue is not null);
$$;
grant execute on function public.cust_demo_asked(text) to anon, authenticated;

-- Podgląd kuchni dla testującego: tylko jego zamówienie (po track_token) i tylko w demach.
create or replace function public.demo_kitchen(p_token uuid)
returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object('id', o.id, 'number', o.number, 'status', o.status, 'mode', o.mode, 'items', o.items, 'total', o.total,
    'note', o.note, 'name', o.customer_name, 'created_at', o.created_at, 'status_at', o.status_at, 'restaurant', r.name, 'slug', r.slug)
  from public.orders o join public.restaurants r on r.id = o.restaurant_id
  where o.track_token = p_token and coalesce((r.settings->>'demo')::boolean, false);
$$;
grant execute on function public.demo_kitchen(uuid) to anon, authenticated;

create or replace function public.demo_kitchen_set(p_token uuid, p_status text)
returns text language plpgsql security definer set search_path to '' as $$
declare v uuid;
begin
  select o.id into v from public.orders o join public.restaurants r on r.id = o.restaurant_id
   where o.track_token = p_token and coalesce((r.settings->>'demo')::boolean, false);
  if v is null then raise exception 'To nie jest zamówienie demo'; end if;
  return public.demo_set_status(v, p_status);
end $$;
grant execute on function public.demo_kitchen_set(uuid, text) to anon, authenticated;

-- 029: lista leadów dla admina Sell-UP
alter table public.leads add column if not exists admin_note text;
-- admin_leads() i admin_lead_set(p_id, p_status, p_note): tylko public.is_admin()

-- 030: admin_lead_delete(p_id) – usuwanie leada przez admina
