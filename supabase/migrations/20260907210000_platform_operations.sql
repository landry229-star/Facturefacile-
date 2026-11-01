create table if not exists public.platform_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  result text not null default 'success' check (result in ('success', 'failure')),
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_audit_logs_created_idx
  on public.platform_audit_logs (created_at desc);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  subject text not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_status_idx
  on public.support_tickets (status, priority, updated_at desc);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null,
  internal boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  message text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists platform_notifications_unread_idx
  on public.platform_notifications (read_at, created_at desc);

create table if not exists public.platform_incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  service text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'detected' check (status in ('detected', 'investigating', 'identified', 'fixing', 'verifying', 'resolved')),
  owner_id uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.platform_integrations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  service_type text not null,
  environment text not null default 'production',
  status text not null default 'not_configured' check (status in ('connected', 'operational', 'not_configured', 'attention', 'unavailable')),
  last_checked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.platform_audit_logs enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;
alter table public.platform_notifications enable row level security;
alter table public.platform_incidents enable row level security;
alter table public.platform_integrations enable row level security;

create or replace function public.has_platform_admin_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins
    where user_id = auth.uid()
      and (
        role in ('super_admin', 'admin')
        or (role = 'support' and p_permission in ('overview', 'users', 'businesses', 'subscriptions', 'support', 'notifications'))
        or (role = 'finance' and p_permission in ('overview', 'subscriptions', 'subscription_payments'))
        or (role = 'analyst' and p_permission in ('overview', 'users', 'businesses', 'subscriptions', 'subscription_payments', 'analytics'))
      )
  );
$$;

create or replace function public.write_platform_audit(
  p_action text,
  p_resource_type text,
  p_resource_id uuid default null,
  p_result text default 'success',
  p_context jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.platform_admins where user_id = auth.uid()) then
    raise exception 'Accès administrateur requis.';
  end if;
  insert into public.platform_audit_logs(actor_id, action, resource_type, resource_id, result, context)
  values (auth.uid(), p_action, p_resource_type, p_resource_id, p_result, coalesce(p_context, '{}'::jsonb));
end;
$$;

create or replace function public.list_platform_support_tickets(p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid, business_id uuid, business_name text, user_id uuid, user_email text,
  subject text, priority text, status text, assigned_to uuid, created_at timestamptz, updated_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('support') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select t.id, t.business_id, b.name, t.user_id, u.email::text, t.subject, t.priority, t.status,
      t.assigned_to, t.created_at, t.updated_at
    from public.support_tickets t
    left join public.businesses b on b.id = t.business_id
    left join auth.users u on u.id = t.user_id
    order by t.updated_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.list_platform_notifications(p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, type text, title text, message text, severity text, read_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('notifications') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select n.id, n.type, n.title, n.message, n.severity, n.read_at, n.created_at
    from public.platform_notifications n order by n.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.list_platform_audit_logs(p_limit integer default 100, p_offset integer default 0)
returns table (id uuid, actor_id uuid, actor_email text, action text, resource_type text, resource_id uuid, result text, context jsonb, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('audit') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select l.id, l.actor_id, u.email::text, l.action, l.resource_type, l.resource_id, l.result, l.context, l.created_at
    from public.platform_audit_logs l left join auth.users u on u.id = l.actor_id
    order by l.created_at desc
    limit greatest(1, least(p_limit, 200)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.list_platform_incidents(p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, title text, description text, service text, severity text, status text, owner_id uuid, started_at timestamptz, resolved_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('incidents') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select i.id, i.title, i.description, i.service, i.severity, i.status, i.owner_id, i.started_at, i.resolved_at
    from public.platform_incidents i order by i.started_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.list_platform_integrations()
returns table (id uuid, name text, service_type text, environment text, status text, last_checked_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('integrations') then raise exception 'Accès administrateur requis.'; end if;
  return query select i.id, i.name, i.service_type, i.environment, i.status, i.last_checked_at
    from public.platform_integrations i order by i.name;
end;
$$;

create or replace function public.update_platform_ticket_status(p_ticket_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public
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
returns uuid
language plpgsql security definer set search_path = public
as $$
declare message_id uuid;
begin
  if not public.has_platform_admin_permission('support') then raise exception 'Accès administrateur requis.'; end if;
  if nullif(trim(p_body), '') is null then raise exception 'Le message ne peut pas être vide.'; end if;
  insert into public.support_ticket_messages(ticket_id, author_id, body, internal)
  values (p_ticket_id, auth.uid(), trim(p_body), p_internal)
  returning id into message_id;
  update public.support_tickets set updated_at = now(), status = case when status = 'open' then 'in_progress' else status end where id = p_ticket_id;
  perform public.write_platform_audit('reply', 'support_ticket', p_ticket_id, 'success', jsonb_build_object('internal', p_internal));
  return message_id;
end;
$$;

create or replace function public.mark_platform_notification_read(p_notification_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('notifications') then raise exception 'Accès administrateur requis.'; end if;
  update public.platform_notifications set read_at = coalesce(read_at, now()) where id = p_notification_id;
  perform public.write_platform_audit('mark_read', 'platform_notification', p_notification_id);
end;
$$;

create or replace function public.create_platform_incident(
  p_title text, p_description text, p_service text, p_severity text default 'medium'
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare incident_id uuid;
begin
  if not public.has_platform_admin_permission('incidents') then raise exception 'Accès administrateur requis.'; end if;
  if nullif(trim(p_title), '') is null or nullif(trim(p_description), '') is null or nullif(trim(p_service), '') is null then
    raise exception 'Titre, description et service sont obligatoires.';
  end if;
  if p_severity not in ('low', 'medium', 'high', 'critical') then raise exception 'Gravité invalide.'; end if;
  insert into public.platform_incidents(title, description, service, severity, owner_id)
  values (trim(p_title), trim(p_description), trim(p_service), p_severity, auth.uid())
  returning id into incident_id;
  perform public.write_platform_audit('create', 'platform_incident', incident_id);
  return incident_id;
end;
$$;

create or replace function public.update_platform_incident_status(p_incident_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public
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

revoke all on function public.write_platform_audit(text, text, uuid, text, jsonb) from public, anon;
revoke all on function public.list_platform_support_tickets(integer, integer) from public, anon;
revoke all on function public.list_platform_notifications(integer, integer) from public, anon;
revoke all on function public.list_platform_audit_logs(integer, integer) from public, anon;
revoke all on function public.list_platform_incidents(integer, integer) from public, anon;
revoke all on function public.list_platform_integrations() from public, anon;
revoke all on function public.update_platform_ticket_status(uuid, text) from public, anon;
revoke all on function public.add_platform_ticket_message(uuid, text, boolean) from public, anon;
revoke all on function public.mark_platform_notification_read(uuid) from public, anon;
revoke all on function public.create_platform_incident(text, text, text, text) from public, anon;
revoke all on function public.update_platform_incident_status(uuid, text) from public, anon;
grant execute on function public.write_platform_audit(text, text, uuid, text, jsonb) to authenticated;
grant execute on function public.list_platform_support_tickets(integer, integer) to authenticated;
grant execute on function public.list_platform_notifications(integer, integer) to authenticated;
grant execute on function public.list_platform_audit_logs(integer, integer) to authenticated;
grant execute on function public.list_platform_incidents(integer, integer) to authenticated;
grant execute on function public.list_platform_integrations() to authenticated;
grant execute on function public.update_platform_ticket_status(uuid, text) to authenticated;
grant execute on function public.add_platform_ticket_message(uuid, text, boolean) to authenticated;
grant execute on function public.mark_platform_notification_read(uuid) to authenticated;
grant execute on function public.create_platform_incident(text, text, text, text) to authenticated;
grant execute on function public.update_platform_incident_status(uuid, text) to authenticated;

insert into public.platform_integrations (name, service_type, status)
values
  ('Supabase', 'database', 'connected'),
  ('PayDunya', 'payment', 'attention'),
  ('Resend', 'email', 'attention')
on conflict (name) do nothing;

create or replace function public.get_platform_admin_overview()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('overview') then
    raise exception 'Accès administrateur requis.';
  end if;
  return jsonb_build_object(
    'business_count', (select count(*) from public.businesses),
    'member_count', (select count(distinct user_id) from public.business_members),
    'invoice_count', (select count(*) from public.invoices),
    'revenue', coalesce((select sum(amount) from public.payments), 0),
    'subscription_revenue', coalesce((select sum(amount) from public.subscription_payments where status = 'completed'), 0),
    'active_subscriptions', (select count(*) from public.business_subscriptions where status in ('active', 'trialing')),
    'pending_payments', (select count(*) from public.subscription_payments where status = 'pending'),
    'open_ticket_count', (select count(*) from public.support_tickets where status in ('open', 'in_progress', 'waiting')),
    'security_alert_count', (select count(*) from public.platform_notifications where severity = 'critical' and read_at is null),
    'recent_businesses', coalesce((
      select jsonb_agg(row_to_json(recent)) from (
        select b.id, b.name, b.created_at, coalesce(bs.plan, 'free') as plan,
          coalesce(bs.status, 'active') as subscription_status
        from public.businesses b
        left join public.business_subscriptions bs on bs.business_id = b.id
        order by b.created_at desc limit 10
      ) recent
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_platform_admin_overview() from public, anon;
grant execute on function public.get_platform_admin_overview() to authenticated;

notify pgrst, 'reload schema';
