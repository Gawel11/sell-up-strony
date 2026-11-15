-- 018: pieczątka za każdą sztukę (settings.loyalty.per_item) + ustawienia kart w demach
create or replace function public._order_award() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n int := 1;
begin
  if new.customer_id is not null and new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done' or old.customer_id is null) then
    if coalesce((select (r.settings #>> '{loyalty,per_item}')::boolean from public.restaurants r where r.id = new.restaurant_id), false) then
      select coalesce(sum(greatest(1, coalesce((x->>'qty')::int, 1))), 1) into n from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) x;
    end if;
    perform public._award(new.customer_id, new.restaurant_id, new.id, new.total, least(n, 10), null);
  end if;
  return new;
end $$;
revoke execute on function public._order_award() from public, anon, authenticated;

update public.restaurants set settings = settings || '{"loyalty":{"mode":"stamps","need":12,"per_item":true,"reward":"Cała pizza gratis"}}' where slug = 'forno450';
update public.restaurants set settings = settings || '{"loyalty":{"mode":"stamps","need":10,"reward":"Dowolny burger gratis"}}' where slug = 'dym-burger';
update public.restaurants set settings = settings || '{"loyalty":{"mode":"stamps","need":10,"reward":"Kebab gratis"}}' where slug in ('zar','rozen24');
update public.restaurants set settings = settings || '{"loyalty":{"mode":"stamps","need":10,"reward":"Obiad dnia gratis"}}' where slug = 'obiady-domowe';
update public.restaurants set settings = settings || '{"loyalty":{"mode":"points","per_zl":0.5,"rewards":[{"id":"drozdz","name":"Drożdżówka","cost":35},{"id":"paczki","name":"6 mini pączków","cost":40},{"id":"kawa","name":"Kawa na wynos","cost":70},{"id":"pizza","name":"Kawałek pizzy","cost":120}]}}' where slug = 'bulkaikromka';
