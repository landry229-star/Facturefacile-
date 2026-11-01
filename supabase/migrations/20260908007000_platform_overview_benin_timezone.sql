create or replace function public.get_platform_admin_overview_period(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  range_from timestamptz := coalesce(p_from, '-infinity'::timestamptz);
  range_to timestamptz := coalesce(p_to, 'infinity'::timestamptz);
begin
  if not public.has_platform_admin_permission('overview') then
    raise exception 'Accès administrateur requis.';
  end if;
  if range_from >= range_to then
    raise exception 'Période d’analyse invalide.';
  end if;
  return jsonb_build_object(
    'business_count', (select count(*) from public.businesses b where b.created_at >= range_from and b.created_at < range_to),
    'member_count', (select count(distinct bm.user_id) from public.business_members bm where bm.created_at >= range_from and bm.created_at < range_to),
    'invoice_count', (select count(*) from public.invoices i where i.issue_date >= (range_from at time zone 'Africa/Porto-Novo')::date and i.issue_date < (range_to at time zone 'Africa/Porto-Novo')::date),
    'revenue', coalesce((select sum(p.amount) from public.payments p where p.payment_date >= (range_from at time zone 'Africa/Porto-Novo')::date and p.payment_date < (range_to at time zone 'Africa/Porto-Novo')::date), 0),
    'subscription_revenue', coalesce((select sum(sp.amount) from public.subscription_payments sp where sp.status = 'completed' and sp.created_at >= range_from and sp.created_at < range_to), 0),
    'active_subscriptions', (select count(*) from public.business_subscriptions bs where bs.status in ('active', 'trialing')),
    'pending_payments', (select count(*) from public.subscription_payments sp where sp.status = 'pending' and sp.created_at >= range_from and sp.created_at < range_to),
    'open_ticket_count', (select count(*) from public.support_tickets t where t.status in ('open', 'in_progress', 'waiting') and t.created_at >= range_from and t.created_at < range_to),
    'security_alert_count', (select count(*) from public.platform_notifications n where n.severity = 'critical' and n.read_at is null and n.created_at >= range_from and n.created_at < range_to),
    'recent_businesses', coalesce((
      select jsonb_agg(row_to_json(recent)) from (
        select b.id, b.name, b.created_at, coalesce(bs.plan, 'free') as plan, coalesce(bs.status, 'active') as subscription_status
        from public.businesses b left join public.business_subscriptions bs on bs.business_id = b.id
        where b.created_at >= range_from and b.created_at < range_to
        order by b.created_at desc limit 10
      ) recent
    ), '[]'::jsonb)
  );
end;
$$;
