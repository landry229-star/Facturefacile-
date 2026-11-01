create or replace function public.get_public_site_config()
returns jsonb language sql stable security definer set search_path = public
as $$
  select coalesce(value::jsonb, '{}'::jsonb)
  from public.platform_settings
  where key = 'public_site_config'
$$;

create or replace function public.update_public_site_config(p_config jsonb)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.platform_admins
    where user_id = auth.uid() and role = 'super_admin'
  ) then
    raise exception 'Accès réservé au super administrateur.';
  end if;
  if jsonb_typeof(p_config) <> 'object' then
    raise exception 'Configuration publique invalide.';
  end if;
  insert into public.platform_settings(key, value, updated_by, updated_at)
  values ('public_site_config', p_config::text, auth.uid(), now())
  on conflict (key) do update set value = excluded.value, updated_by = auth.uid(), updated_at = now();
  perform public.write_platform_audit('update', 'public_site_config', null, 'success');
end;
$$;

revoke all on function public.get_public_site_config() from public, authenticated;
grant execute on function public.get_public_site_config() to anon, authenticated;
revoke all on function public.update_public_site_config(jsonb) from public, anon;
grant execute on function public.update_public_site_config(jsonb) to authenticated;
notify pgrst, 'reload schema';
