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
  month_from timestamptz := date_trunc('month', now() at time zone 'Africa/Porto-Novo') at time zone 'Africa/Porto-Novo';
  previous_month_from timestamptz := date_trunc('month', now() at time zone 'Africa/Porto-Novo') - interval '1 month';
  month_to timestamptz := date_trunc('month', now() at time zone 'Africa/Porto-Novo') + interval '1 month';
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
    'revenue_month', coalesce((select sum(sp.amount) from public.subscription_payments sp where sp.status = 'completed' and sp.created_at >= month_from and sp.created_at < month_to), 0),
    'revenue_previous_month', coalesce((select sum(sp.amount) from public.subscription_payments sp where sp.status = 'completed' and sp.created_at >= previous_month_from and sp.created_at < month_from), 0),
    'revenue_change_percent', (
      select case when previous_total = 0 then case when current_total = 0 then 0 else null end
        else round(((current_total - previous_total) / previous_total) * 100, 1) end
      from (
        select
          coalesce((select sum(amount) from public.subscription_payments where status = 'completed' and created_at >= month_from and created_at < month_to), 0)::numeric current_total,
          coalesce((select sum(amount) from public.subscription_payments where status = 'completed' and created_at >= previous_month_from and created_at < month_from), 0)::numeric previous_total
      ) totals
    ),
    'revenue_by_plan', coalesce((
      select jsonb_agg(jsonb_build_object('plan', plan, 'amount', amount, 'payments', payments) order by plan)
      from (
        select sp.plan, sum(sp.amount) amount, count(*) payments
        from public.subscription_payments sp
        where sp.status = 'completed' and sp.created_at >= range_from and sp.created_at < range_to
        group by sp.plan
      ) plans
    ), '[]'::jsonb),
    'failed_payments', (select count(*) from public.subscription_payments where status = 'failed' and created_at >= range_from and created_at < range_to),
    'refund_amount', coalesce((select sum(amount) from public.subscription_payments where status = 'refunded' and created_at >= range_from and created_at < range_to), 0),
    'unpaid_payments', jsonb_build_object(
      'count', (select count(*) from public.subscription_payments where status = 'pending' and created_at >= range_from and created_at < range_to),
      'amount', coalesce((select sum(amount) from public.subscription_payments where status = 'pending' and created_at >= range_from and created_at < range_to), 0)
    ),
    'monthly_recurring_revenue', coalesce((
      select sum(coalesce(sp.price, 0))
      from public.business_subscriptions bs
      left join public.subscription_plans sp on sp.code = bs.plan
      where bs.status in ('active', 'trialing')
    ), 0),
    'currency', coalesce((select currency from public.subscription_plans where status = 'active' order by price desc limit 1), 'XOF'),
    'active_subscriptions', (select count(*) from public.business_subscriptions where status in ('active', 'trialing')),
    'pending_payments', (select count(*) from public.subscription_payments where status = 'pending' and created_at >= range_from and created_at < range_to),
    'open_ticket_count', (select count(*) from public.support_tickets where status in ('open', 'in_progress', 'waiting') and created_at >= range_from and created_at < range_to),
    'urgent_ticket_count', (select count(*) from public.support_tickets where priority = 'urgent' and status in ('open', 'in_progress', 'waiting') and created_at >= range_from and created_at < range_to),
    'unanswered_ticket_count', (select count(*) from public.support_tickets t where t.status in ('open', 'in_progress', 'waiting') and t.created_at >= range_from and t.created_at < range_to and not exists (
      select 1 from public.support_ticket_messages m join public.platform_admins pa on pa.user_id = m.author_id
      where m.ticket_id = t.id and m.internal = false
    )),
    'oldest_open_ticket_hours', (select extract(epoch from (now() - min(created_at))) / 3600 from public.support_tickets where status in ('open', 'in_progress', 'waiting') and created_at >= range_from and created_at < range_to),
    'average_first_response_hours', (select avg(extract(epoch from (first_response - created_at)) / 3600) from (
      select t.created_at, min(m.created_at) first_response
      from public.support_tickets t
      join public.support_ticket_messages m on m.ticket_id = t.id and m.internal = false
      join public.platform_admins pa on pa.user_id = m.author_id
      where t.created_at >= range_from and t.created_at < range_to
      group by t.id
    ) responses),
    'average_resolution_hours', (select avg(extract(epoch from (updated_at - created_at)) / 3600) from public.support_tickets where status in ('resolved', 'closed') and created_at >= range_from and created_at < range_to),
    'sla_at_risk_ticket_count', (select count(*) from public.support_tickets t where t.status in ('open', 'in_progress', 'waiting') and t.created_at >= range_from and t.created_at < range_to and now() - t.created_at >= case t.priority when 'urgent' then interval '2 hours' when 'high' then interval '8 hours' else interval '24 hours' end),
    'tickets_by_priority', coalesce((
      select jsonb_agg(jsonb_build_object('priority', priority, 'count', count) order by priority)
      from (
        select priority, count(*) count
        from public.support_tickets
        where status in ('open', 'in_progress', 'waiting') and created_at >= range_from and created_at < range_to
        group by priority
      ) priorities
    ), '[]'::jsonb),
    'security_alert_count', (select count(*) from public.platform_notifications where severity = 'critical' and read_at is null and created_at >= range_from and created_at < range_to),
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

notify pgrst, 'reload schema';
