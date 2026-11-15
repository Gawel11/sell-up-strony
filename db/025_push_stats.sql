-- 025: liczba urządzeń z powiadomieniami i ostatnie wiadomości (panel)
create or replace function public.staff_push_stats(p_restaurant uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff(p_restaurant) then raise exception 'Brak dostępu'; end if;
  return jsonb_build_object(
    'devices', (select count(*) from public.push_subscriptions where restaurant_id = p_restaurant),
    'last', (select jsonb_agg(jsonb_build_object('title', c.title, 'body', c.body, 'sent', c.sent, 'at', c.created_at) order by c.created_at desc)
             from (select * from public.push_campaigns where restaurant_id = p_restaurant order by created_at desc limit 5) c));
end $$;
revoke execute on function public.staff_push_stats(uuid) from public, anon;
grant execute on function public.staff_push_stats(uuid) to authenticated;
