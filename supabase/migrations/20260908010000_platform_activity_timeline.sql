create or replace function public.list_platform_activity(p_limit integer default 20)
returns table (
  id text,
  type text,
  label text,
  detail text,
  created_at timestamptz,
  resource_type text,
  resource_id uuid
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('overview') then
    raise exception 'Accès administrateur requis.';
  end if;
  return query
  select event.id, event.type, event.label, event.detail, event.created_at, event.resource_type, event.resource_id
  from (
    select ('business-' || b.id::text) id, 'business' type, 'Entreprise créée' label, b.name detail, b.created_at, 'business' resource_type, b.id resource_id
    from public.businesses b
    union all
    select ('member-' || bm.user_id::text || '-' || extract(epoch from bm.created_at)::text), 'user', 'Utilisateur inscrit', coalesce(u.email, 'Utilisateur'), bm.created_at, 'user', bm.user_id
    from public.business_members bm left join auth.users u on u.id = bm.user_id
    union all
    select ('payment-' || p.id::text), 'payment', case when p.status = 'completed' then 'Paiement reçu' else 'Paiement ' || p.status end, p.amount::text || ' ' || p.currency, p.created_at, 'subscription_payment', p.id
    from public.subscription_payments p
    union all
    select ('ticket-' || t.id::text), 'ticket', 'Ticket ouvert', t.subject, t.created_at, 'support_ticket', t.id
    from public.support_tickets t
    union all
    select ('incident-' || i.id::text), 'incident', 'Incident déclaré', i.title, i.started_at, 'platform_incident', i.id
    from public.platform_incidents i
    union all
    select ('setting-' || l.id::text), 'setting', 'Paramètre modifié', l.action, l.created_at, l.resource_type, l.resource_id
    from public.platform_audit_logs l where l.resource_type ilike '%setting%'
    union all
    select ('login-' || l.id::text), 'login', 'Administrateur connecté', coalesce(u.email, 'Administrateur'), l.created_at, 'admin_login', l.actor_id
    from public.platform_audit_logs l left join auth.users u on u.id = l.actor_id where l.action ilike '%login%'
    union all
    select ('subscription-' || h.id::text), 'subscription', 'Abonnement changé', h.from_plan || ' → ' || h.to_plan, h.created_at, 'business_subscription', h.subscription_id
    from public.subscription_plan_history h
  ) event
  order by event.created_at desc
  limit greatest(1, least(p_limit, 100));
end;
$$;

revoke all on function public.list_platform_activity(integer) from public, anon;
grant execute on function public.list_platform_activity(integer) to authenticated;
notify pgrst, 'reload schema';
