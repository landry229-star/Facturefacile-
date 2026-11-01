-- Keep every platform permission explicit; unknown permissions must never grant access.
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
        role = 'super_admin'
        or (
          role = 'admin'
          and p_permission in (
            'overview', 'users', 'user_management', 'businesses',
            'subscriptions', 'subscription_payments', 'support',
            'notifications', 'analytics', 'audit', 'content',
            'integrations', 'incidents'
          )
        )
        or (role = 'support' and p_permission in ('overview', 'users', 'businesses', 'support', 'notifications'))
        or (role = 'finance' and p_permission in ('overview', 'subscriptions', 'subscription_payments', 'finance'))
        or (role = 'analyst' and p_permission in ('overview', 'analytics', 'reports'))
      )
  )
$$;

revoke all on function public.has_platform_admin_permission(text) from public, anon;
grant execute on function public.has_platform_admin_permission(text) to authenticated;
notify pgrst, 'reload schema';
