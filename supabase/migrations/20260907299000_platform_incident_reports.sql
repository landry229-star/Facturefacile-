alter table public.platform_incidents
  add column if not exists root_cause text,
  add column if not exists resolution_summary text,
  add column if not exists prevention_actions text;

drop function if exists public.list_platform_incidents(integer, integer);
create or replace function public.list_platform_incidents(p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid, title text, description text, service text, severity text, status text,
  owner_id uuid, owner_email text, started_at timestamptz, resolved_at timestamptz,
  root_cause text, resolution_summary text, prevention_actions text
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('incidents') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select i.id, i.title, i.description, i.service, i.severity, i.status, i.owner_id,
      u.email::text, i.started_at, i.resolved_at, i.root_cause, i.resolution_summary, i.prevention_actions
    from public.platform_incidents i
    left join auth.users u on u.id = i.owner_id
    order by i.started_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.update_platform_incident_report(
  p_incident_id uuid, p_root_cause text, p_resolution_summary text, p_prevention_actions text
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('incidents') then raise exception 'Accès administrateur requis.'; end if;
  if nullif(trim(coalesce(p_root_cause, '')), '') is null
    or nullif(trim(coalesce(p_resolution_summary, '')), '') is null
    or nullif(trim(coalesce(p_prevention_actions, '')), '') is null then
    raise exception 'Le compte rendu doit contenir la cause, la résolution et les actions préventives.';
  end if;
  update public.platform_incidents
    set root_cause = trim(p_root_cause), resolution_summary = trim(p_resolution_summary),
        prevention_actions = trim(p_prevention_actions)
    where id = p_incident_id;
  if not found then raise exception 'Incident introuvable.'; end if;
  perform public.write_platform_audit('update_report', 'platform_incident', p_incident_id);
end;
$$;

revoke all on function public.list_platform_incidents(integer, integer) from public, anon;
revoke all on function public.update_platform_incident_report(uuid, text, text, text) from public, anon;
grant execute on function public.list_platform_incidents(integer, integer) to authenticated;
grant execute on function public.update_platform_incident_report(uuid, text, text, text) to authenticated;
