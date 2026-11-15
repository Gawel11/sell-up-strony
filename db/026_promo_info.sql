-- 026: publiczna informacja o promocji (baner) i daniu dnia z settings.promo / settings.special
create or replace function public.promo_info(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'promo', case when coalesce((r.settings #>> '{promo,active}')::boolean, false)
                   and (r.settings #>> '{promo,until}' is null or (r.settings #>> '{promo,until}')::timestamptz > now())
              then jsonb_build_object('title', r.settings #>> '{promo,title}', 'text', r.settings #>> '{promo,text}', 'code', r.settings #>> '{promo,code}',
                                      'until', r.settings #>> '{promo,until}', 'v', r.settings #>> '{promo,v}') end,
    'special', case when coalesce((r.settings #>> '{special,active}')::boolean, false)
                   and (r.settings #>> '{special,until}' is null or (r.settings #>> '{special,until}')::timestamptz > now())
              then jsonb_build_object('name', r.settings #>> '{special,name}', 'text', r.settings #>> '{special,text}', 'price', r.settings #>> '{special,price}',
                                      'until', r.settings #>> '{special,until}', 'v', r.settings #>> '{special,v}') end)
  from public.restaurants r where r.slug = p_slug;
$$;
grant execute on function public.promo_info(text) to anon, authenticated;
