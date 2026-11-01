create or replace function public.get_platform_operational_summary()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  checked_at timestamptz := clock_timestamp();
begin
  if not public.has_platform_admin_permission('overview') then
    raise exception 'Accès administrateur requis.';
  end if;
  return jsonb_build_object(
    'health_checks', coalesce((select jsonb_agg(to_jsonb(h)) from public.check_platform_health() h), '[]'::jsonb),
    'active_incident', (select to_jsonb(i) from (
      select id, title, severity, status, started_at from public.platform_incidents
      where status <> 'resolved' order by started_at desc limit 1
    ) i),
    'latest_admin_logins', coalesce((
      select jsonb_agg(jsonb_build_object('actor_email', u.email, 'created_at', l.created_at, 'result', l.result) order by l.created_at desc)
      from public.platform_audit_logs l left join auth.users u on u.id = l.actor_id
      where l.action ilike '%login%' limit 10
    ), '[]'::jsonb),
    'unusual_login_count', (select count(*) from public.platform_audit_logs where (action ilike '%login%' and context->>'unusual' = 'true') or action ilike '%unusual%'),
    'failed_login_count', (select count(*) from public.platform_audit_logs where action ilike '%login%' and result = 'failure' and created_at >= now() - interval '30 days'),
    'suspended_account_count', (select count(*) from public.platform_admins where status = 'suspended'),
    'recent_admin_count', (select count(*) from public.platform_admins where created_at >= now() - interval '30 days'),
    'active_session_count', (select count(*) from auth.sessions where not_after > now()),
    'mfa_enabled_count', (select count(distinct user_id) from auth.mfa_factors where status = 'verified' and user_id in (select user_id from public.platform_admins)),
    'mfa_total_count', (select count(*) from public.platform_admins),
    'recent_critical_actions', coalesce((
      select jsonb_agg(jsonb_build_object('action', l.action, 'resource_type', l.resource_type, 'actor_email', u.email, 'created_at', l.created_at, 'result', l.result) order by l.created_at desc)
      from public.platform_audit_logs l left join auth.users u on u.id = l.actor_id
      where l.action in ('disable', 'delete', 'update_role', 'access_denied') or l.resource_type ilike '%security%'
      limit 10
    ), '[]'::jsonb),
    'checked_at', checked_at
  );
end;
$$;

revoke all on function public.get_platform_operational_summary() from public, anon;
grant execute on function public.get_platform_operational_summary() to authenticated;
notify pgrst, 'reload schema';
