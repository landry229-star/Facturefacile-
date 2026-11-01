create or replace function public.get_platform_business_detail(p_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare result jsonb;
begin
  if not public.has_platform_admin_permission('businesses') then
    raise exception 'Accès administrateur requis.';
  end if;
  select jsonb_build_object(
    'id', b.id,
    'name', b.name,
    'sector', b.sector,
    'owner_id', b.owner_id,
    'owner_email', owner_user.email::text,
    'user_count', 1 + (select count(*) from public.business_members m where m.business_id = b.id),
    'plan', coalesce(bs.plan, 'free'),
    'subscription_status', coalesce(bs.status, 'active'),
    'account_status', b.platform_status,
    'created_at', b.created_at,
    'last_activity_at', b.updated_at,
    'logo_url', b.logo_url,
    'phone', b.phone,
    'email', b.email,
    'address', b.address,
    'city', b.city,
    'country', b.country,
    'users', coalesce((
      select jsonb_agg(x.item)
      from (
        select jsonb_build_object('user_id', b.owner_id, 'email', owner_user.email::text, 'name', owner_user.raw_user_meta_data->>'full_name', 'role', 'owner') as item
        union all
        select jsonb_build_object('user_id', m.user_id, 'email', member_user.email::text, 'name', member_user.raw_user_meta_data->>'full_name', 'role', m.role)
        from public.business_members m
        left join auth.users member_user on member_user.id = m.user_id
        where m.business_id = b.id
      ) x
    ), '[]'::jsonb),
    'subscription', case when bs.id is null then null else jsonb_build_object('plan', bs.plan, 'status', bs.status, 'created_at', bs.created_at, 'expires_at', bs.expires_at) end,
    'activity', jsonb_build_object('invoices', (select count(*) from public.invoices i where i.business_id = b.id), 'clients', (select count(*) from public.clients c where c.business_id = b.id), 'products', (select count(*) from public.products p where p.business_id = b.id), 'last_activity_at', b.updated_at),
    'tickets', '[]'::jsonb,
    'audit', '[]'::jsonb
  )
  into result
  from public.businesses b
  left join auth.users owner_user on owner_user.id = b.owner_id
  left join public.business_subscriptions bs on bs.business_id = b.id
  where b.id = p_business_id;
  if result is null then raise exception 'Entreprise introuvable.'; end if;
  return result;
end;
$$;

revoke all on function public.get_platform_business_detail(uuid) from public, anon;
grant execute on function public.get_platform_business_detail(uuid) to authenticated;
notify pgrst, 'reload schema';
