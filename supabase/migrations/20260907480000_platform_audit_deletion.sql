create or replace function public.delete_platform_audit_logs(p_log_ids uuid[])
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  deleted_count integer;
begin
  if not exists (
    select 1 from public.platform_admins
    where user_id = auth.uid() and role = 'super_admin'
  ) then
    raise exception 'Seul le super administrateur peut supprimer les journaux.';
  end if;
  if coalesce(array_length(p_log_ids, 1), 0) = 0
    or array_length(p_log_ids, 1) > 100 then
    raise exception 'La sélection doit contenir entre 1 et 100 journaux.';
  end if;

  perform public.write_platform_audit(
    'delete',
    'platform_audit_logs',
    null,
    'success',
    jsonb_build_object('details', jsonb_build_object('deleted_ids', to_jsonb(p_log_ids), 'count', array_length(p_log_ids, 1)))
  );

  delete from public.platform_audit_logs where id = any(p_log_ids);
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.delete_platform_audit_logs(uuid[]) from public, anon;
grant execute on function public.delete_platform_audit_logs(uuid[]) to authenticated;
notify pgrst, 'reload schema';
