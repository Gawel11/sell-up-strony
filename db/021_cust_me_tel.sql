-- 021: cust_me zwraca własny numer klienta (tel, 9 cyfr) do uzupełniania formularza zamówienia
CREATE OR REPLACE FUNCTION public.cust_me(p_token text, p_restaurant text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
declare cid uuid; c public.customers; r public.restaurants; res jsonb;
begin
  cid := public._session(p_token);
  update public.customers set last_seen = now() where id = cid returning * into c;
  res := jsonb_build_object('name', c.name, 'phone', public._mask_phone(c.phone), 'code', c.code,
    'tel', case when length(c.phone) = 11 and left(c.phone, 2) = '48' then right(c.phone, 9) else c.phone end);
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
end $function$;
