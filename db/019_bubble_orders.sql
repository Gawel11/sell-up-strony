-- 019: bubble tea zamawiane w aplikacji (menu w bazie) + zamówienie zalogowanego klienta bez formularza
insert into public.menu_items(restaurant_id, kind, code, category, name, price, variants, max_qty, sort)
select r.id, 'product', 'bt', 'Bubble tea', 'Bubble tea', 15,
  '[{"id":"M","name":"M 500 ml","price":15},{"id":"L","name":"L 700 ml","price":19}]'::jsonb, 20, 0
from public.restaurants r where r.slug = 'bubble-tea'
  and not exists (select 1 from public.menu_items m where m.restaurant_id = r.id and m.code = 'bt');

insert into public.menu_items(restaurant_id, kind, code, name, price, category, max_qty, sort)
select r.id, 'option', v.code, v.name, v.price, v.cat, 1, v.s + 10
from public.restaurants r, (values
  ('base_czarna','Herbata czarna',0,'Herbata',0),
  ('base_jasmin','Herbata zielona jaśminowa',0,'Herbata',1),
  ('base_matcha','Matcha',3,'Herbata',2),
  ('base_taro','Taro',2,'Herbata',3),
  ('base_thai','Thai',1,'Herbata',4),
  ('base_mango','Owocowa mango',1,'Herbata',5),
  ('base_truskawka','Owocowa truskawka',1,'Herbata',6),
  ('milk_krowie','Mleko krowie',0,'Mleko',7),
  ('milk_owsiane','Mleko owsiane',2,'Mleko',8),
  ('milk_kokos','Mleko kokosowe',2,'Mleko',9),
  ('milk_none','Bez mleka',0,'Mleko',10),
  ('sweet_0','Słodkość 0%',0,'Słodkość',11),
  ('sweet_30','Słodkość 30%',0,'Słodkość',12),
  ('sweet_50','Słodkość 50%',0,'Słodkość',13),
  ('sweet_70','Słodkość 70%',0,'Słodkość',14),
  ('sweet_100','Słodkość 100%',0,'Słodkość',15),
  ('pearl_tapioka','Kulki tapioka',0,'Kulki',16),
  ('pearl_brownsugar','Tapioka brown sugar',1,'Kulki',17),
  ('pearl_popmango','Popping mango',1,'Kulki',18),
  ('pearl_poptrusk','Popping truskawka',1,'Kulki',19),
  ('pearl_liczi','Galaretka liczi',1,'Kulki',20),
  ('pearl_none','Bez kulek',0,'Kulki',21),
  ('top_pianka','Pianka serowa',3,'Na wierzch',22),
  ('top_syrop','Syrop brown sugar',2,'Na wierzch',23),
  ('ice_normal','Z lodem',0,'Lód',24),
  ('ice_malo','Mało lodu',0,'Lód',25),
  ('ice_none','Bez lodu',0,'Lód',26)
) as v(code, name, price, cat, s)
where r.slug = 'bubble-tea'
  and not exists (select 1 from public.menu_items m where m.restaurant_id = r.id and m.code = v.code);

update public.restaurants set settings = settings || '{"loyalty":{"mode":"stamps","need":8,"per_item":true,"reward":"Darmowa herbata"},"eta":{"pickup":"5–8 min"}}' where slug = 'bubble-tea';

-- zamówienie zalogowanego klienta: imię i numer z konta, od razu przypięte do karty
create or replace function public.cust_place_order(p_token text, p_restaurant text, p_items jsonb, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare cid uuid; c public.customers; res jsonb;
begin
  cid := public._session(p_token);
  select * into c from public.customers where id = cid;
  res := public.place_order(p_restaurant, p_items, 'pickup', coalesce(c.name, 'Klient'),
           case when length(c.phone) = 11 and left(c.phone, 2) = '48' then right(c.phone, 9) else c.phone end,
           null, p_note, 'cash', null, null);
  update public.orders set customer_id = cid where id = (res->>'id')::uuid;
  return res;
end $$;
grant execute on function public.cust_place_order(text, text, jsonb, text) to anon, authenticated;
