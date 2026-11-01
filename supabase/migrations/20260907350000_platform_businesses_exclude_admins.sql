drop function if exists public.list_platform_businesses_detailed(integer, integer);
create or replace function public.list_platform_businesses_detailed(p_limit integer default 100, p_offset integer default 0)
returns table (
  id uuid, name text, sector text, owner_id uuid, owner_email text, user_count bigint, plan text,
  subscription_status text, account_status text, created_at timestamptz, last_activity_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('businesses') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select b.id, b.name, b.sector, b.owner_id, u.email::text,
      1 + (select count(*) from public.business_members m where m.business_id = b.id),
      coalesce(bs.plan, 'free'), coalesce(bs.status, 'active'), b.platform_status, b.created_at,
      greatest(b.updated_at, bs.updated_at, (select max(l.created_at) from public.platform_audit_logs l where l.resource_id = b.id))
    from public.businesses b
    left join auth.users u on u.id = b.owner_id
    left join public.business_subscriptions bs on bs.business_id = b.id
    where not exists (select 1 from public.platform_admins pa where pa.user_id = b.owner_id)
    order by b.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

revoke all on function public.list_platform_businesses_detailed(integer, integer) from public, anon;
grant execute on function public.list_platform_businesses_detailed(integer, integer) to authenticated;
notify pgrst, 'reload schema';
