create or replace function public.list_platform_admin_accounts()
returns table (user_id uuid, email text, created_at timestamptz, role text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('admin_management') then raise exception 'Accès super administrateur requis.'; end if;
  return query select u.id, u.email::text, u.created_at, pa.role
    from public.platform_admins pa join auth.users u on u.id = pa.user_id order by u.created_at desc;
end;
$$;

create or replace function public.update_platform_admin_role(p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public
as $$
declare current_role text;
begin
  if not public.has_platform_admin_permission('admin_management') then raise exception 'Accès super administrateur requis.'; end if;
  if p_role not in ('super_admin', 'admin', 'support', 'finance', 'analyst') then raise exception 'Rôle administrateur invalide.'; end if;
  select role into current_role from public.platform_admins where user_id = p_user_id;
  if current_role is null then raise exception 'Administrateur introuvable.'; end if;
  if p_user_id = auth.uid() and p_role <> 'super_admin' and current_role = 'super_admin' then raise exception 'Un super administrateur ne peut pas retirer son propre accès maximal.'; end if;
  update public.platform_admins set role = p_role where user_id = p_user_id;
  perform public.write_platform_audit('change_role', 'platform_admin', p_user_id, 'success', jsonb_build_object('previous_role', current_role, 'new_role', p_role));
end;
$$;

revoke all on function public.list_platform_admin_accounts() from public, anon;
revoke all on function public.update_platform_admin_role(uuid, text) from public, anon;
grant execute on function public.list_platform_admin_accounts() to authenticated;
grant execute on function public.update_platform_admin_role(uuid, text) to authenticated;
notify pgrst, 'reload schema';
create or replace function public.has_platform_admin_permission(p_permission text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins
    where user_id = auth.uid() and (
      role = 'super_admin' or (role = 'admin' and p_permission <> 'admin_management')
      or (role = 'support' and p_permission in ('overview', 'users', 'businesses', 'subscriptions', 'support', 'notifications'))
      or (role = 'finance' and p_permission in ('overview', 'subscriptions', 'subscription_payments'))
      or (role = 'analyst' and p_permission in ('overview', 'users', 'businesses', 'subscriptions', 'subscription_payments', 'analytics'))
    )
  );
$$;
