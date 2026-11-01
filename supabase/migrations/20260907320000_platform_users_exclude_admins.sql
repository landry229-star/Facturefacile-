drop function if exists public.list_platform_users_detailed(integer, integer, text, text, uuid, text, text);
create or replace function public.list_platform_users_detailed(
  p_limit integer default 50, p_offset integer default 0, p_query text default null,
  p_status text default null, p_business_id uuid default null, p_role text default null, p_plan text default null
)
returns table (
  user_id uuid, first_name text, last_name text, full_name text, email text, phone text, avatar_url text,
  business_id uuid, business_name text, business_plan text, business_role text, platform_role text,
  account_status text, created_at timestamptz, last_sign_in_at timestamptz, last_activity_at timestamptz, connection_count bigint
)
language plpgsql stable security definer set search_path = public
as $$
declare q text := lower(trim(coalesce(p_query, '')));
begin
  if not public.has_platform_admin_permission('users') then raise exception 'Accès administrateur requis.'; end if;
  return query
    with memberships as (
      select m.user_id, m.business_id, m.role, row_number() over (partition by m.user_id order by m.created_at) as rank
      from public.business_members m
    ), activity as (
      select l.actor_id, max(l.created_at) as last_activity_at from public.platform_audit_logs l group by l.actor_id
    )
    select u.id, split_part(coalesce(u.raw_user_meta_data->>'full_name', ''), ' ', 1),
      nullif(regexp_replace(coalesce(u.raw_user_meta_data->>'full_name', ''), '^[^ ]+ ?', ''), ''),
      nullif(u.raw_user_meta_data->>'full_name', ''), u.email::text,
      u.raw_user_meta_data->>'phone', u.raw_user_meta_data->>'avatar_url',
      coalesce(m.business_id, b.id), coalesce(bm.name, b.name), coalesce(bs.plan, 'free'),
      case when b.owner_id = u.id then 'owner' else coalesce(m.role, 'none') end, pa.role,
      case when u.banned_until is not null and u.banned_until > now() then 'disabled' else 'active' end,
      u.created_at, u.last_sign_in_at, greatest(u.last_sign_in_at, activity.last_activity_at), 0::bigint
    from auth.users u
    left join memberships m on m.user_id = u.id and m.rank = 1
    left join public.businesses b on b.owner_id = u.id
    left join public.businesses bm on bm.id = m.business_id
    left join public.business_subscriptions bs on bs.business_id = coalesce(m.business_id, b.id)
    left join public.platform_admins pa on pa.user_id = u.id
    left join activity on activity.actor_id = u.id
    where pa.user_id is null
      and (q = '' or lower(concat_ws(' ', u.raw_user_meta_data->>'full_name', u.email::text)) like '%' || q || '%')
      and (p_status is null or p_status = '' or (p_status = 'disabled' and u.banned_until is not null and u.banned_until > now()) or (p_status = 'active' and (u.banned_until is null or u.banned_until <= now())))
      and (p_business_id is null or coalesce(m.business_id, b.id) = p_business_id)
      and (p_role is null or p_role = '' or case when b.owner_id = u.id then 'owner' else coalesce(m.role, 'none') end = p_role)
      and (p_plan is null or p_plan = '' or coalesce(bs.plan, 'free') = p_plan)
    order by u.created_at desc limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

revoke all on function public.list_platform_users_detailed(integer, integer, text, text, uuid, text, text) from public, anon;
grant execute on function public.list_platform_users_detailed(integer, integer, text, text, uuid, text, text) to authenticated;
notify pgrst, 'reload schema';
