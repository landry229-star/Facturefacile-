create or replace function public.assign_platform_ticket(p_ticket_id uuid, p_agent_id uuid default null)
returns void language plpgsql security definer set search_path = public
as $$
declare target_agent uuid := coalesce(p_agent_id, auth.uid());
begin
  if not public.has_platform_admin_permission('support') then raise exception 'Accès administrateur requis.'; end if;
  if not exists (select 1 from public.platform_admins where user_id = target_agent) then raise exception 'Agent support invalide.'; end if;
  update public.support_tickets set assigned_to = target_agent, updated_at = now() where id = p_ticket_id;
  if not found then raise exception 'Ticket introuvable.'; end if;
  perform public.write_platform_audit('assign', 'support_ticket', p_ticket_id, 'success', jsonb_build_object('assigned_to', target_agent));
end;
$$;

revoke all on function public.assign_platform_ticket(uuid, uuid) from public, anon;
grant execute on function public.assign_platform_ticket(uuid, uuid) to authenticated;
notify pgrst, 'reload schema';
