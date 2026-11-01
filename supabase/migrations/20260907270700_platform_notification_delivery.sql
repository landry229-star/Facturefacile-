create table if not exists public.platform_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.platform_notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms', 'webhook')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (notification_id, user_id, channel)
);

create index if not exists platform_notification_deliveries_queue_idx
  on public.platform_notification_deliveries(status, next_attempt_at);

alter table public.platform_notification_deliveries enable row level security;

create or replace function public.notification_visible_to_current_admin(p_notification_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.platform_notifications n
    join public.platform_admins pa on pa.user_id = auth.uid() and pa.status = 'active'
    where n.id = p_notification_id
      and (n.recipient_user_id is null or n.recipient_user_id = auth.uid())
      and (n.recipient_role is null or n.recipient_role = pa.role or pa.role = 'super_admin')
  )
$$;

create or replace function public.mark_platform_notification_read(p_notification_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.notification_visible_to_current_admin(p_notification_id) then
    raise exception 'Notification inaccessible.';
  end if;
  update public.platform_notifications set read_at = coalesce(read_at, now())
    where id = p_notification_id;
  perform public.write_platform_audit('mark_read', 'platform_notification', p_notification_id);
end;
$$;

create or replace function public.mark_platform_notification_unread(p_notification_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.notification_visible_to_current_admin(p_notification_id) then
    raise exception 'Notification inaccessible.';
  end if;
  update public.platform_notifications set read_at = null where id = p_notification_id;
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
      and public.notification_visible_to_current_admin(n.id);
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
  if not public.notification_visible_to_current_admin(p_notification_id) then raise exception 'Notification inaccessible.'; end if;
  update public.platform_notifications set archived_at = now() where id = p_notification_id;
  perform public.write_platform_audit('archive', 'platform_notification', p_notification_id);
end;
$$;

create or replace function public.create_platform_notification(
  p_type text, p_title text, p_message text, p_severity text default 'info',
  p_recipient_role text default null, p_recipient_user_id uuid default null,
  p_resource_type text default null, p_resource_id uuid default null, p_source_event_id text default null
) returns uuid language plpgsql security definer set search_path = public
as $$
declare
  notification_id uuid;
  target record;
begin
  if p_severity not in ('info', 'warning', 'critical') then raise exception 'Gravité de notification invalide.'; end if;
  insert into public.platform_notifications(type, title, message, severity, recipient_role, recipient_user_id, resource_type, resource_id, source_event_id)
  values (p_type, left(p_title, 160), left(p_message, 1000), p_severity, p_recipient_role, p_recipient_user_id, p_resource_type, p_resource_id, p_source_event_id)
  on conflict (type, source_event_id) where source_event_id is not null do nothing
  returning id into notification_id;
  if notification_id is null then return null; end if;

  for target in
    select pa.user_id, p.email_enabled, p.sms_enabled, p.webhook_enabled
    from public.platform_admins pa
    left join public.platform_notification_preferences p
      on p.user_id = pa.user_id and p.notification_type = p_type
    where pa.status = 'active'
      and (p_recipient_user_id is null or pa.user_id = p_recipient_user_id)
      and (p_recipient_role is null or pa.role = p_recipient_role or pa.role = 'super_admin')
      and (p.critical_only is null or not p.critical_only or p_severity = 'critical')
  loop
    if coalesce(target.email_enabled, false) then
      insert into public.platform_notification_deliveries(notification_id, user_id, channel)
      values (notification_id, target.user_id, 'email') on conflict do nothing;
    end if;
    if coalesce(target.sms_enabled, false) then
      insert into public.platform_notification_deliveries(notification_id, user_id, channel)
      values (notification_id, target.user_id, 'sms') on conflict do nothing;
    end if;
    if coalesce(target.webhook_enabled, false) then
      insert into public.platform_notification_deliveries(notification_id, user_id, channel)
      values (notification_id, target.user_id, 'webhook') on conflict do nothing;
    end if;
  end loop;
  return notification_id;
end;
$$;

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
      and coalesce((select p.in_app_enabled from public.platform_notification_preferences p
        where p.user_id = auth.uid() and p.notification_type = n.type), true)
      and (p_query is null or concat_ws(' ', n.type, n.title, n.message) ilike '%' || p_query || '%')
      and (p_type is null or n.type = p_type)
      and (p_severity is null or n.severity = p_severity)
      and (not p_unread_only or n.read_at is null)
      and (p_from is null or n.created_at >= p_from)
      and (p_to is null or n.created_at < p_to)
    order by n.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.claim_platform_notification_deliveries(p_limit integer default 25)
returns setof public.platform_notification_deliveries
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('notifications') then raise exception 'Accès administrateur requis.'; end if;
  return query
    update public.platform_notification_deliveries d
    set status = 'processing', attempts = d.attempts + 1
    where d.id in (
      select q.id from public.platform_notification_deliveries q
      where q.status in ('pending', 'failed') and q.next_attempt_at <= now()
      order by q.next_attempt_at
      limit greatest(1, least(p_limit, 100))
      for update skip locked
    )
    returning d.*;
end;
$$;

revoke all on function public.claim_platform_notification_deliveries(integer) from public, anon, authenticated;
notify pgrst, 'reload schema';
