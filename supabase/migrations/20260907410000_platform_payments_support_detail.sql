alter table public.subscription_payments add column if not exists internal_reference text;
alter table public.subscription_payments add column if not exists confirmation_data jsonb not null default '{}'::jsonb;
create unique index if not exists subscription_payments_internal_reference_idx on public.subscription_payments (internal_reference) where internal_reference is not null;

drop function if exists public.list_platform_subscription_payments(integer, integer);
create or replace function public.list_platform_subscription_payments(p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, business_id uuid, business_name text, plan text, amount numeric, currency text, status text, provider text, provider_token text, internal_reference text, created_at timestamptz, completed_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('subscription_payments') then raise exception 'Accès administrateur requis.'; end if;
  return query select p.id, p.business_id, b.name, p.plan, p.amount, p.currency, p.status, p.provider, p.provider_token, p.internal_reference, p.created_at, p.completed_at
    from public.subscription_payments p join public.businesses b on b.id = p.business_id
    where not exists (select 1 from public.platform_admins pa where pa.user_id = b.owner_id)
    order by p.created_at desc limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.get_platform_support_ticket_detail(p_ticket_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare result jsonb;
begin
  if not public.has_platform_admin_permission('support') then raise exception 'Accès administrateur requis.'; end if;
  select jsonb_build_object('id', t.id, 'business_id', t.business_id, 'business_name', b.name, 'user_id', t.user_id, 'user_email', u.email,
    'subject', t.subject, 'priority', t.priority, 'status', t.status, 'assigned_to', t.assigned_to, 'created_at', t.created_at, 'updated_at', t.updated_at,
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'author_email', au.email, 'body', m.body, 'internal', m.internal, 'created_at', m.created_at) order by m.created_at) from public.support_ticket_messages m left join auth.users au on au.id = m.author_id where m.ticket_id = t.id), '[]'::jsonb))
  into result from public.support_tickets t left join public.businesses b on b.id = t.business_id left join auth.users u on u.id = t.user_id where t.id = p_ticket_id;
  if result is null then raise exception 'Ticket introuvable.'; end if;
  return result;
end;
$$;

create or replace function public.update_platform_ticket_priority(p_ticket_id uuid, p_priority text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('support') then raise exception 'Accès administrateur requis.'; end if;
  if p_priority not in ('low', 'normal', 'high', 'urgent') then raise exception 'Priorité invalide.'; end if;
  update public.support_tickets set priority = p_priority, updated_at = now() where id = p_ticket_id;
  if not found then raise exception 'Ticket introuvable.'; end if;
  perform public.write_platform_audit('update_priority', 'support_ticket', p_ticket_id, 'success', jsonb_build_object('priority', p_priority));
end;
$$;

revoke all on function public.list_platform_subscription_payments(integer, integer) from public, anon;
revoke all on function public.get_platform_support_ticket_detail(uuid) from public, anon;
revoke all on function public.update_platform_ticket_priority(uuid, text) from public, anon;
grant execute on function public.list_platform_subscription_payments(integer, integer) to authenticated;
grant execute on function public.get_platform_support_ticket_detail(uuid) to authenticated;
grant execute on function public.update_platform_ticket_priority(uuid, text) to authenticated;
notify pgrst, 'reload schema';
