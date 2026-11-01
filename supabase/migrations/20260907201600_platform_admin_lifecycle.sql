alter table public.platform_admins add column if not exists status text not null default 'active';
alter table public.platform_admins drop constraint if exists platform_admins_status_check;
alter table public.platform_admins add constraint platform_admins_status_check check (status in ('active', 'suspended', 'disabled'));

drop function if exists public.list_platform_admin_accounts();
create or replace function public.list_platform_admin_accounts()
returns table (user_id uuid, email text, full_name text, phone text, created_at timestamptz, last_sign_in_at timestamptz, email_confirmed_at timestamptz, status text, role text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('admin_management') then raise exception 'Accès super administrateur requis.'; end if;
  return query select u.id, u.email::text, coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'), u.phone, u.created_at, u.last_sign_in_at, u.email_confirmed_at, pa.status, pa.role
    from public.platform_admins pa join auth.users u on u.id = pa.user_id order by u.created_at desc;
end;
$$;

revoke all on function public.list_platform_admin_accounts() from public, anon;
grant execute on function public.list_platform_admin_accounts() to authenticated;
notify pgrst, 'reload schema';
