create or replace function public.delete_platform_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('user_management') then
    raise exception 'Permission insuffisante pour supprimer un utilisateur.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Vous ne pouvez pas supprimer votre propre compte administrateur.';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Utilisateur introuvable.';
  end if;
  perform public.write_platform_audit('delete', 'platform_user', p_user_id);
  delete from auth.users where id = p_user_id;
end;
$$;

revoke all on function public.delete_platform_user(uuid) from public, anon;
grant execute on function public.delete_platform_user(uuid) to authenticated;
notify pgrst, 'reload schema';
