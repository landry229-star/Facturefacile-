create or replace function public.update_platform_ticket_status(p_ticket_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('support') then raise exception 'Accès administrateur requis.'; end if;
  if p_status not in ('open', 'in_progress', 'waiting', 'resolved', 'closed') then raise exception 'Statut de ticket invalide.'; end if;
  update public.support_tickets set status = p_status, updated_at = now() where id = p_ticket_id;
  if not found then raise exception 'Ticket introuvable.'; end if;
  perform public.write_platform_audit('update_status', 'support_ticket', p_ticket_id, 'success', jsonb_build_object('status', p_status));
end;
$$;

create or replace function public.add_platform_ticket_message(p_ticket_id uuid, p_body text, p_internal boolean default false)
returns uuid language plpgsql security definer set search_path = public
as $$
declare message_id uuid;
begin
  if not public.has_platform_admin_permission('support') then raise exception 'Accès administrateur requis.'; end if;
  if nullif(trim(p_body), '') is null then raise exception 'Le message ne peut pas être vide.'; end if;
  insert into public.support_ticket_messages(ticket_id, author_id, body, internal)
  values (p_ticket_id, auth.uid(), trim(p_body), p_internal) returning id into message_id;
  update public.support_tickets set updated_at = now(), status = case when status = 'open' then 'in_progress' else status end where id = p_ticket_id;
  perform public.write_platform_audit('reply', 'support_ticket', p_ticket_id, 'success', jsonb_build_object('internal', p_internal));
  return message_id;
end;
$$;

create or replace function public.mark_platform_notification_read(p_notification_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('notifications') then raise exception 'Accès administrateur requis.'; end if;
  update public.platform_notifications set read_at = coalesce(read_at, now()) where id = p_notification_id;
  perform public.write_platform_audit('mark_read', 'platform_notification', p_notification_id);
end;
$$;

create or replace function public.create_platform_incident(
  p_title text, p_description text, p_service text, p_severity text default 'medium'
) returns uuid language plpgsql security definer set search_path = public
as $$
declare incident_id uuid;
begin
  if not public.has_platform_admin_permission('incidents') then raise exception 'Accès administrateur requis.'; end if;
  if nullif(trim(p_title), '') is null or nullif(trim(p_description), '') is null or nullif(trim(p_service), '') is null then
    raise exception 'Titre, description et service sont obligatoires.';
  end if;
  if p_severity not in ('low', 'medium', 'high', 'critical') then raise exception 'Gravité invalide.'; end if;
  insert into public.platform_incidents(title, description, service, severity, owner_id)
  values (trim(p_title), trim(p_description), trim(p_service), p_severity, auth.uid()) returning id into incident_id;
  perform public.write_platform_audit('create', 'platform_incident', incident_id);
  return incident_id;
end;
$$;

create or replace function public.update_platform_incident_status(p_incident_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('incidents') then raise exception 'Accès administrateur requis.'; end if;
  if p_status not in ('detected', 'investigating', 'identified', 'fixing', 'verifying', 'resolved') then raise exception 'Statut d’incident invalide.'; end if;
  update public.platform_incidents
    set status = p_status, resolved_at = case when p_status = 'resolved' then coalesce(resolved_at, now()) else null end
    where id = p_incident_id;
  if not found then raise exception 'Incident introuvable.'; end if;
  perform public.write_platform_audit('update_status', 'platform_incident', p_incident_id, 'success', jsonb_build_object('status', p_status));
end;
$$;

revoke all on function public.update_platform_ticket_status(uuid, text) from public, anon;
revoke all on function public.add_platform_ticket_message(uuid, text, boolean) from public, anon;
revoke all on function public.mark_platform_notification_read(uuid) from public, anon;
revoke all on function public.create_platform_incident(text, text, text, text) from public, anon;
revoke all on function public.update_platform_incident_status(uuid, text) from public, anon;
grant execute on function public.update_platform_ticket_status(uuid, text) to authenticated;
grant execute on function public.add_platform_ticket_message(uuid, text, boolean) to authenticated;
grant execute on function public.mark_platform_notification_read(uuid) to authenticated;
grant execute on function public.create_platform_incident(text, text, text, text) to authenticated;
grant execute on function public.update_platform_incident_status(uuid, text) to authenticated;

notify pgrst, 'reload schema';
