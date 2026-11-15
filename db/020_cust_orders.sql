-- 020: „Moje zamówienia” – historia i aktywne zamówienia zalogowanego klienta w danym lokalu
create or replace function public.cust_orders(p_token text, p_restaurant text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare cid uuid; rid uuid;
begin
  cid := public._session(p_token);
  select id into rid from public.restaurants where slug = p_restaurant;
  if rid is null then raise exception 'Nie ma takiego lokalu'; end if;
  return coalesce((select jsonb_agg(x order by x.created_at desc) from (
    select o.id, o.number, o.status, o.status_at, o.created_at, o.total, o.mode, o.track_token,
           (select jsonb_agg(jsonb_build_object('name', coalesce(nullif(i->>'label',''), i->>'name'), 'variant', i->>'variant', 'qty', (i->>'qty')::int,
                    'options', (select jsonb_agg(op->>'name') from jsonb_array_elements(coalesce(i->'options','[]'::jsonb)) op)))
              from jsonb_array_elements(o.items) i) as items
      from public.orders o
     where o.customer_id = cid and o.restaurant_id = rid
     order by o.created_at desc limit 20) x), '[]'::jsonb);
end $$;
grant execute on function public.cust_orders(text, text) to anon, authenticated;
