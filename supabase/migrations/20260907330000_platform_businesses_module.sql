alter table public.businesses add column if not exists sector text;
alter table public.businesses add column if not exists platform_status text not null default 'active';
alter table public.businesses drop constraint if exists businesses_platform_status_check;
alter table public.businesses add constraint businesses_platform_status_check check (platform_status in ('active', 'inactive', 'suspended', 'pending', 'archived'));

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
    order by b.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.get_platform_business_detail(p_business_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare result jsonb;
begin
  if not public.has_platform_admin_permission('businesses') then raise exception 'Accès administrateur requis.'; end if;
  select jsonb_build_object(
    'id', b.id, 'name', b.name, 'sector', b.sector, 'owner_id', b.owner_id, 'owner_email', owner_user.email,
    'user_count', 1 + (select count(*) from public.business_members m where m.business_id = b.id),
    'plan', coalesce(bs.plan, 'free'), 'subscription_status', coalesce(bs.status, 'active'), 'account_status', b.platform_status,
    'created_at', b.created_at, 'last_activity_at', greatest(b.updated_at, bs.updated_at),
    'logo_url', b.logo_url, 'phone', b.phone, 'email', b.email, 'address', b.address, 'city', b.city, 'country', b.country,
    'users', coalesce((select jsonb_agg(jsonb_build_object('user_id', x.user_id, 'email', x.email, 'name', x.name, 'role', x.role)) from (
      select b.owner_id as user_id, owner_user.email::text, owner_user.raw_user_meta_data->>'full_name' as name, 'owner'::text as role
      union all select m.user_id, member_user.email::text, member_user.raw_user_meta_data->>'full_name', m.role from public.business_members m join auth.users member_user on member_user.id = m.user_id where m.business_id = b.id
    ) x), '[]'::jsonb),
    'subscription', case when bs.id is null then null else jsonb_build_object('plan', bs.plan, 'status', bs.status, 'created_at', bs.created_at, 'expires_at', bs.expires_at) end,
    'activity', jsonb_build_object('invoices', (select count(*) from public.invoices i where i.business_id = b.id), 'clients', (select count(*) from public.clients c where c.business_id = b.id), 'products', (select count(*) from public.products p where p.business_id = b.id), 'last_activity_at', greatest(b.updated_at, bs.updated_at)),
    'tickets', coalesce((select jsonb_agg(t) from (select id, subject, status, priority, created_at from public.support_tickets where business_id = b.id order by created_at desc limit 20) t), '[]'::jsonb),
    'audit', coalesce((select jsonb_agg(a) from (select action, resource_type, result, created_at from public.platform_audit_logs where resource_id = b.id order by created_at desc limit 30) a), '[]'::jsonb)
  ) into result
  from public.businesses b
  left join auth.users owner_user on owner_user.id = b.owner_id
  left join public.business_subscriptions bs on bs.business_id = b.id
  where b.id = p_business_id;
  if result is null then raise exception 'Entreprise introuvable.'; end if;
  return result;
end;
$$;

create or replace function public.set_platform_business_status(p_business_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('businesses') then raise exception 'Accès administrateur requis.'; end if;
  if p_status not in ('active', 'inactive', 'suspended', 'pending', 'archived') then raise exception 'Statut invalide.'; end if;
  update public.businesses set platform_status = p_status, updated_at = now() where id = p_business_id;
  if not found then raise exception 'Entreprise introuvable.'; end if;
  perform public.write_platform_audit('update_status', 'business', p_business_id, 'success', jsonb_build_object('status', p_status));
end;
$$;

revoke all on function public.list_platform_businesses_detailed(integer, integer) from public, anon;
revoke all on function public.get_platform_business_detail(uuid) from public, anon;
revoke all on function public.set_platform_business_status(uuid, text) from public, anon;
grant execute on function public.list_platform_businesses_detailed(integer, integer) to authenticated;
grant execute on function public.get_platform_business_detail(uuid) to authenticated;
grant execute on function public.set_platform_business_status(uuid, text) to authenticated;
notify pgrst, 'reload schema';
