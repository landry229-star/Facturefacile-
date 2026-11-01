-- Suspended and disabled platform administrators must lose access immediately,
-- including when an existing JWT remains valid in the browser.
create or replace function public.get_platform_admin_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.platform_admins
  where user_id = auth.uid()
    and status = 'active'
$$;

create or replace function public.is_platform_admin()
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
      and status = 'active'
  )
$$;

create or replace function public.is_platform_super_admin()
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
      and role = 'super_admin'
      and status = 'active'
  )
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
      and status = 'active'
      and (
        role in ('super_admin', 'admin')
        or (role = 'support' and p_permission in ('overview', 'users', 'businesses', 'subscriptions'))
        or (role = 'finance' and p_permission in ('overview', 'subscriptions', 'subscription_payments'))
        or (role = 'analyst' and p_permission in ('overview', 'users', 'businesses', 'subscriptions', 'subscription_payments'))
      )
  )
$$;
