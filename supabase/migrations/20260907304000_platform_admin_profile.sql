insert into storage.buckets (id, name, public)
values ('admin-avatars', 'admin-avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "admin avatars are publicly readable" on storage.objects;
create policy "admin avatars are publicly readable" on storage.objects
  for select using (bucket_id = 'admin-avatars');

drop policy if exists "admins upload own avatar" on storage.objects;
create policy "admins upload own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'admin-avatars' and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.platform_admins where user_id = auth.uid()));

drop policy if exists "admins update own avatar" on storage.objects;
create policy "admins update own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'admin-avatars' and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.platform_admins where user_id = auth.uid()))
  with check (bucket_id = 'admin-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.get_platform_admin_profile()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare result jsonb;
begin
  if not exists (select 1 from public.platform_admins where user_id = auth.uid()) then
    raise exception 'Accès administrateur requis.';
  end if;
  select jsonb_build_object(
    'full_name', coalesce(u.raw_user_meta_data->>'full_name', ''),
    'first_name', split_part(coalesce(u.raw_user_meta_data->>'full_name', ''), ' ', 1),
    'last_name', nullif(regexp_replace(coalesce(u.raw_user_meta_data->>'full_name', ''), '^[^ ]+ ?', ''), ''),
    'email', u.email::text,
    'avatar_url', u.raw_user_meta_data->>'avatar_url',
    'last_sign_in_at', u.last_sign_in_at,
    'sessions', coalesce((select jsonb_agg(jsonb_build_object(
      'created_at', recent.created_at, 'updated_at', recent.updated_at,
      'user_agent', recent.user_agent, 'ip', recent.ip::text
    ) order by recent.updated_at desc) from (
      select s.created_at, s.updated_at, s.user_agent, s.ip
      from auth.sessions s
      where s.user_id = u.id
      order by s.updated_at desc
      limit 10
    ) recent), '[]'::jsonb)
  ) into result
  from auth.users u where u.id = auth.uid();
  return result;
end;
$$;

revoke all on function public.get_platform_admin_profile() from public, anon;
grant execute on function public.get_platform_admin_profile() to authenticated;
