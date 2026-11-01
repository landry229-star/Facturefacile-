alter table public.platform_audit_logs
  add column if not exists ip_address inet;

create index if not exists platform_audit_logs_resource_idx
  on public.platform_audit_logs (resource_type, resource_id, created_at desc);

create or replace function public.write_platform_audit(
  p_action text,
  p_resource_type text,
  p_resource_id uuid default null,
  p_result text default 'success',
  p_context jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  request_headers jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  forwarded_ip text := coalesce(request_headers ->> 'x-forwarded-for', request_headers ->> 'x-real-ip');
begin
  if not exists (select 1 from public.platform_admins where user_id = auth.uid()) then
    raise exception 'Accès administrateur requis.';
  end if;
  insert into public.platform_audit_logs(actor_id, action, resource_type, resource_id, result, ip_address, context)
  values (
    auth.uid(),
    p_action,
    p_resource_type,
    p_resource_id,
    p_result,
    nullif(split_part(forwarded_ip, ',', 1), '')::inet,
    jsonb_build_object(
      'user_agent', request_headers ->> 'user-agent',
      'before', coalesce(p_context -> 'before', null),
      'after', coalesce(p_context -> 'after', null),
      'details', coalesce(p_context - 'before' - 'after', '{}'::jsonb)
    )
  );
end;
$$;

drop function if exists public.list_platform_audit_logs(integer, integer);

create or replace function public.list_platform_audit_logs(p_limit integer default 100, p_offset integer default 0)
returns table (
  id uuid, actor_id uuid, actor_email text, action text, resource_type text,
  resource_id uuid, result text, ip_address inet, context jsonb, created_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('audit') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select l.id, l.actor_id, u.email::text, l.action, l.resource_type, l.resource_id,
      l.result, l.ip_address, l.context, l.created_at
    from public.platform_audit_logs l
    left join auth.users u on u.id = l.actor_id
    order by l.created_at desc
    limit greatest(1, least(p_limit, 200)) offset greatest(p_offset, 0);
end;
$$;

revoke all on function public.write_platform_audit(text, text, uuid, text, jsonb) from public, anon;
grant execute on function public.write_platform_audit(text, text, uuid, text, jsonb) to authenticated;
revoke all on function public.list_platform_audit_logs(integer, integer) from public, anon;
grant execute on function public.list_platform_audit_logs(integer, integer) to authenticated;
notify pgrst, 'reload schema';
