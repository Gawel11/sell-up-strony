-- 023: CRM dla obsługi/właściciela – klienci lokalu z liczbą zamówień, kwotą, ostatnią wizytą, kartą i poleceniami
create or replace function public.staff_customers(p_restaurant uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff(p_restaurant) then raise exception 'Brak dostępu'; end if;
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
revoke execute on function public.staff_customers(uuid) from public, anon;
grant execute on function public.staff_customers(uuid) to authenticated;
