alter table public.platform_admins
  add column if not exists role text not null default 'admin';

alter table public.platform_admins
  drop constraint if exists platform_admins_role_check;

alter table public.platform_admins
  add constraint platform_admins_role_check
  check (role in ('super_admin', 'admin', 'support', 'finance', 'analyst'));

create or replace function public.get_platform_admin_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.platform_admins where user_id = auth.uid()
$$;

create or replace function public.has_platform_admin_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins
    where user_id = auth.uid()
      and (
        role in ('super_admin', 'admin')
        or (role = 'support' and p_permission in ('overview', 'users', 'businesses', 'subscriptions'))
        or (role = 'finance' and p_permission in ('overview', 'subscriptions', 'subscription_payments'))
        or (role = 'analyst' and p_permission in ('overview', 'users', 'businesses', 'subscriptions', 'subscription_payments'))
      )
  )
$$;

revoke all on function public.get_platform_admin_role() from public, anon;
revoke all on function public.has_platform_admin_permission(text) from public, anon;
grant execute on function public.get_platform_admin_role() to authenticated;
grant execute on function public.has_platform_admin_permission(text) to authenticated;

create or replace function public.list_platform_admin_users(p_limit integer default 50, p_offset integer default 0)
returns table (user_id uuid, email text, created_at timestamptz, platform_role text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('users') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select u.id, u.email, u.created_at, pa.role
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
    select b.id, b.name, b.owner_id, u.email, b.created_at,
      coalesce(bs.plan, 'free'), coalesce(bs.status, 'active')
    from public.businesses b
    left join auth.users u on u.id = b.owner_id
    left join public.business_subscriptions bs on bs.business_id = b.id
    order by b.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.list_platform_admin_subscriptions(p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, business_id uuid, business_name text, plan text, status text, monthly_invoice_limit integer, expires_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('subscriptions') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select s.id, s.business_id, b.name, s.plan, s.status, s.monthly_invoice_limit, s.expires_at, s.created_at
    from public.business_subscriptions s join public.businesses b on b.id = s.business_id
    order by s.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.list_platform_subscription_payments(p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, business_id uuid, business_name text, plan text, amount numeric, currency text, status text, provider text, created_at timestamptz, completed_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('subscription_payments') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select p.id, p.business_id, b.name, p.plan, p.amount, p.currency, p.status, p.provider, p.created_at, p.completed_at
    from public.subscription_payments p join public.businesses b on b.id = p.business_id
    order by p.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

revoke all on function public.list_platform_admin_users(integer, integer) from public, anon;
revoke all on function public.list_platform_admin_businesses(integer, integer) from public, anon;
revoke all on function public.list_platform_admin_subscriptions(integer, integer) from public, anon;
revoke all on function public.list_platform_subscription_payments(integer, integer) from public, anon;
grant execute on function public.list_platform_admin_users(integer, integer) to authenticated;
grant execute on function public.list_platform_admin_businesses(integer, integer) to authenticated;
grant execute on function public.list_platform_admin_subscriptions(integer, integer) to authenticated;
grant execute on function public.list_platform_subscription_payments(integer, integer) to authenticated;

notify pgrst, 'reload schema';
