-- 017: maskowanie numeru bez prefiksu 48 (np. 500 *** *00)
CREATE OR REPLACE FUNCTION public._mask_phone(p text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO '' AS $function$
  with d as (select regexp_replace(coalesce(p,''),'\D','','g') v),
       n as (select case when length(v) = 11 and left(v,2) = '48' then right(v,9) else v end v from d)
  select case when length(v) < 5 then '***' else left(v,3) || ' *** *' || right(v,2) end from n;
$function$;
