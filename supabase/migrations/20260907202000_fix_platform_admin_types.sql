create or replace function public.list_platform_admin_users(p_limit integer default 50, p_offset integer default 0)
returns table (user_id uuid, email text, created_at timestamptz, platform_role text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('users') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select u.id, u.email::text, u.created_at, pa.role
    from auth.users u
    left join public.platform_admins pa on pa.user_id = u.id
    order by u.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.list_platform_admin_businesses(p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, name text, owner_id uuid, owner_email text, created_at timestamptz, plan text, subscription_status text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('businesses') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select b.id, b.name, b.owner_id, u.email::text, b.created_at,
      coalesce(bs.plan, 'free'), coalesce(bs.status, 'active')
    from public.businesses b
    left join auth.users u on u.id = b.owner_id
    left join public.business_subscriptions bs on bs.business_id = b.id
    order by b.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

notify pgrst, 'reload schema';
