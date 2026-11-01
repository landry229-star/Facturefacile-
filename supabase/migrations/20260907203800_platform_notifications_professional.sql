alter table public.platform_notifications
  add column if not exists recipient_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists recipient_role text,
  add column if not exists resource_type text,
  add column if not exists resource_id uuid,
  add column if not exists source_event_id text,
  add column if not exists archived_at timestamptz,
  add column if not exists email_sent_at timestamptz,
  add column if not exists delivery_attempts integer not null default 0,
  add column if not exists last_delivery_error text;

create unique index if not exists platform_notifications_source_event_uidx
  on public.platform_notifications(type, source_event_id)
  where source_event_id is not null;

create table if not exists public.platform_notification_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  sms_enabled boolean not null default false,
  webhook_enabled boolean not null default false,
  critical_only boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, notification_type)
);

alter table public.platform_notification_preferences enable row level security;

create or replace function public.list_platform_notifications(
  p_limit integer default 50,
  p_offset integer default 0,
  p_query text default null,
  p_type text default null,
  p_severity text default null,
  p_unread_only boolean default false,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  id uuid, type text, title text, message text, severity text, read_at timestamptz,
  created_at timestamptz, resource_type text, resource_id uuid, archived_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
declare current_role text;
begin
  select pa.role into current_role from public.platform_admins pa
    where pa.user_id = auth.uid() and pa.status = 'active';
  if current_role is null then raise exception 'Accès administrateur requis.'; end if;
  return query
    select n.id, n.type, n.title, n.message, n.severity, n.read_at, n.created_at,
      n.resource_type, n.resource_id, n.archived_at
    from public.platform_notifications n
    where n.archived_at is null
      and (n.recipient_user_id is null or n.recipient_user_id = auth.uid())
      and (n.recipient_role is null or n.recipient_role = current_role or current_role = 'super_admin')
      and (p_query is null or concat_ws(' ', n.type, n.title, n.message)::text ilike '%' || p_query || '%')
      and (p_type is null or n.type = p_type)
      and (p_severity is null or n.severity = p_severity)
      and (not p_unread_only or n.read_at is null)
      and (p_from is null or n.created_at >= p_from)
      and (p_to is null or n.created_at < p_to)
    order by n.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.mark_platform_notification_read(p_notification_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.platform_notifications
    set read_at = coalesce(read_at, now())
    where id = p_notification_id and (recipient_user_id is null or recipient_user_id = auth.uid());
  perform public.write_platform_audit('mark_read', 'platform_notification', p_notification_id);
end;
$$;

create or replace function public.mark_platform_notification_unread(p_notification_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.platform_notifications
    set read_at = null
    where id = p_notification_id
      and (recipient_user_id is null or recipient_user_id = auth.uid());
  perform public.write_platform_audit('mark_unread', 'platform_notification', p_notification_id);
end;
$$;

create or replace function public.mark_all_platform_notifications_read()
returns integer language plpgsql security definer set search_path = public
as $$
declare changed integer;
begin
  update public.platform_notifications n
    set read_at = now()
    where n.read_at is null and n.archived_at is null
      and (n.recipient_user_id is null or n.recipient_user_id = auth.uid());
  get diagnostics changed = row_count;
  perform public.write_platform_audit('mark_all_read', 'platform_notification', null, 'success', jsonb_build_object('count', changed));
  return changed;
end;
$$;

create or replace function public.archive_platform_notification(p_notification_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('notifications') then raise exception 'Accès administrateur requis.'; end if;
  update public.platform_notifications set archived_at = now()
    where id = p_notification_id;
  perform public.write_platform_audit('archive', 'platform_notification', p_notification_id);
end;
$$;

create or replace function public.set_platform_notification_preference(
  p_type text, p_in_app boolean, p_email boolean, p_sms boolean, p_webhook boolean, p_critical_only boolean
)
returns void language plpgsql security definer set search_path = public
as $$
begin
  insert into public.platform_notification_preferences(user_id, notification_type, in_app_enabled, email_enabled, sms_enabled, webhook_enabled, critical_only)
  values (auth.uid(), p_type, p_in_app, p_email, p_sms, p_webhook, p_critical_only)
  on conflict (user_id, notification_type) do update set
    in_app_enabled = excluded.in_app_enabled, email_enabled = excluded.email_enabled,
    sms_enabled = excluded.sms_enabled, webhook_enabled = excluded.webhook_enabled,
    critical_only = excluded.critical_only, updated_at = now();
end;
$$;

create or replace function public.list_platform_notification_preferences()
returns table (notification_type text, in_app_enabled boolean, email_enabled boolean, sms_enabled boolean, webhook_enabled boolean, critical_only boolean)
language sql stable security definer set search_path = public
as $$
  select notification_type, in_app_enabled, email_enabled, sms_enabled, webhook_enabled, critical_only
  from public.platform_notification_preferences where user_id = auth.uid()
  order by notification_type
$$;

drop function if exists public.create_platform_notification(text, text, text, text);
create or replace function public.create_platform_notification(
  p_type text, p_title text, p_message text, p_severity text default 'info',
  p_recipient_role text default null, p_recipient_user_id uuid default null,
  p_resource_type text default null, p_resource_id uuid default null, p_source_event_id text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare notification_id uuid;
begin
  if p_severity not in ('info', 'warning', 'critical') then raise exception 'Gravité de notification invalide.'; end if;
  insert into public.platform_notifications(type, title, message, severity, recipient_role, recipient_user_id, resource_type, resource_id, source_event_id)
  values (p_type, left(p_title, 160), left(p_message, 1000), p_severity, p_recipient_role, p_recipient_user_id, p_resource_type, p_resource_id, p_source_event_id)
  on conflict (type, source_event_id) where source_event_id is not null do nothing
  returning id into notification_id;
  return notification_id;
end;
$$;

alter table public.platform_notifications replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'platform_notifications'
  ) then
    alter publication supabase_realtime add table public.platform_notifications;
  end if;
end;
$$;

revoke all on function public.list_platform_notifications(integer, integer, text, text, text, boolean, timestamptz, timestamptz) from public, anon;
revoke all on function public.mark_platform_notification_read(uuid) from public, anon;
revoke all on function public.mark_platform_notification_unread(uuid) from public, anon;
revoke all on function public.mark_all_platform_notifications_read() from public, anon;
revoke all on function public.archive_platform_notification(uuid) from public, anon;
revoke all on function public.set_platform_notification_preference(text, boolean, boolean, boolean, boolean, boolean) from public, anon;
revoke all on function public.list_platform_notification_preferences() from public, anon;
grant execute on function public.list_platform_notifications(integer, integer, text, text, text, boolean, timestamptz, timestamptz) to authenticated;
grant execute on function public.mark_platform_notification_read(uuid) to authenticated;
grant execute on function public.mark_platform_notification_unread(uuid) to authenticated;
grant execute on function public.mark_all_platform_notifications_read() to authenticated;
grant execute on function public.archive_platform_notification(uuid) to authenticated;
grant execute on function public.set_platform_notification_preference(text, boolean, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.list_platform_notification_preferences() to authenticated;
notify pgrst, 'reload schema';
