create or replace function public.get_platform_analytics(
  p_from timestamptz default now() - interval '30 days',
  p_to timestamptz default now(),
  p_plan text default null,
  p_sector text default null,
  p_business_type text default null
) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  result jsonb;
  period interval := greatest(p_to - p_from, interval '1 day');
begin
  if not public.has_platform_admin_permission('analytics') then
    raise exception 'Accès administrateur requis.';
  end if;

  with scope as (
    select b.id, b.created_at, b.platform_status, coalesce(bs.plan, 'free') plan
    from businesses b
    left join business_subscriptions bs on bs.business_id = b.id
    where not exists (select 1 from platform_admins pa where pa.user_id = b.owner_id)
      and (p_plan is null or coalesce(bs.plan, 'free') = p_plan)
      and (p_sector is null or b.sector = p_sector)
      and (p_business_type is null or b.business_type = p_business_type)
  ), metrics as (
    select
      count(*) filter (where s.created_at >= p_from and s.created_at < p_to)::numeric signups,
      count(*) filter (where s.created_at >= p_from - period and s.created_at < p_from)::numeric previous_signups,
      count(*) filter (where s.platform_status = 'active' and s.created_at < p_to)::numeric active_businesses,
      count(*) filter (where s.platform_status = 'active' and s.created_at < p_from)::numeric previous_active_businesses,
      count(*) filter (where s.plan <> 'free' and s.created_at >= p_from and s.created_at < p_to)::numeric paid_conversions,
      count(*) filter (where s.plan <> 'free' and s.created_at >= p_from - period and s.created_at < p_from)::numeric previous_paid_conversions,
      count(*) filter (where s.created_at >= p_from and s.created_at < p_to)::numeric total_signups,
      count(*) filter (where s.created_at >= p_from - period and s.created_at < p_from)::numeric previous_total_signups
    from scope s
  ), commercial as (
    select
      coalesce(sum(case when bs.status in ('active','trialing') and bs.created_at < p_to then coalesce(sp.price, 0) else 0 end), 0)::numeric mrr,
      coalesce(sum(case when bs.status in ('active','trialing') and bs.created_at < p_from then coalesce(sp.price, 0) else 0 end), 0)::numeric previous_mrr,
      count(*) filter (where bs.expires_at >= p_from and bs.expires_at < p_to)::numeric renewals,
      count(*) filter (where bs.expires_at >= p_from - period and bs.expires_at < p_from)::numeric previous_renewals,
      count(*) filter (where bs.status in ('cancelled','expired','suspended') and bs.updated_at >= p_from and bs.updated_at < p_to)::numeric churn,
      count(*) filter (where bs.status in ('cancelled','expired','suspended') and bs.updated_at >= p_from - period and bs.updated_at < p_from)::numeric previous_churn,
      coalesce((select sum(pay.amount) from subscription_payments pay join scope ps on ps.id = pay.business_id where pay.status = 'completed' and pay.created_at >= p_from and pay.created_at < p_to), 0)::numeric revenue,
      coalesce((select sum(pay.amount) from subscription_payments pay join scope ps on ps.id = pay.business_id where pay.status = 'completed' and pay.created_at >= p_from - period and pay.created_at < p_from), 0)::numeric previous_revenue
    from business_subscriptions bs
    join scope s on s.id = bs.business_id
    left join subscription_plans sp on sp.code = bs.plan
  ), usage as (
    select jsonb_build_array(
      jsonb_build_object('feature','Factures','usage',(select count(*) from invoices i join scope s on s.id = i.business_id where i.created_at >= p_from and i.created_at < p_to)),
      jsonb_build_object('feature','Clients','usage',(select count(*) from clients c join scope s on s.id = c.business_id where c.created_at >= p_from and c.created_at < p_to)),
      jsonb_build_object('feature','Produits','usage',(select count(*) from products pr join scope s on s.id = pr.business_id where pr.created_at >= p_from and pr.created_at < p_to)),
      jsonb_build_object('feature','Utilisateurs actifs','usage',(select count(*) from business_members m join scope s on s.id = m.business_id where m.created_at >= p_from and m.created_at < p_to))
    ) feature_usage,
    jsonb_build_array(
      jsonb_build_object('feature','Factures','usage',(select count(*) from invoices i join scope s on s.id = i.business_id where i.created_at >= p_from - period and i.created_at < p_from)),
      jsonb_build_object('feature','Clients','usage',(select count(*) from clients c join scope s on s.id = c.business_id where c.created_at >= p_from - period and c.created_at < p_from)),
      jsonb_build_object('feature','Produits','usage',(select count(*) from products pr join scope s on s.id = pr.business_id where pr.created_at >= p_from - period and pr.created_at < p_from)),
      jsonb_build_object('feature','Utilisateurs actifs','usage',(select count(*) from business_members m join scope s on s.id = m.business_id where m.created_at >= p_from - period and m.created_at < p_from))
    ) previous_feature_usage
  )
  select jsonb_build_object(
    'current', jsonb_build_object(
      'signups', m.signups, 'active_users', (select count(*) from business_members bm join scope s on s.id = bm.business_id where bm.created_at >= p_from and bm.created_at < p_to),
      'active_businesses', m.active_businesses, 'activation_rate', case when m.total_signups = 0 then 0 else round(m.active_businesses / m.total_signups * 100, 2) end,
      'conversion_rate', case when m.total_signups = 0 then 0 else round(m.paid_conversions / m.total_signups * 100, 2) end,
      'paid_conversions', m.paid_conversions, 'renewals', c.renewals, 'churn', c.churn,
      'mrr', c.mrr, 'arr', c.mrr * 12, 'revenue', c.revenue
    ),
    'previous', jsonb_build_object(
      'signups', m.previous_signups, 'active_users', (select count(*) from business_members bm join scope s on s.id = bm.business_id where bm.created_at >= p_from - period and bm.created_at < p_from),
      'active_businesses', m.previous_active_businesses, 'activation_rate', case when m.previous_total_signups = 0 then 0 else round(m.previous_active_businesses / m.previous_total_signups * 100, 2) end,
      'conversion_rate', case when m.previous_total_signups = 0 then 0 else round(m.previous_paid_conversions / m.previous_total_signups * 100, 2) end,
      'paid_conversions', m.previous_paid_conversions, 'renewals', c.previous_renewals, 'churn', c.previous_churn,
      'mrr', c.previous_mrr, 'arr', c.previous_mrr * 12, 'revenue', c.previous_revenue
    ),
    'feature_usage', u.feature_usage,
    'previous_feature_usage', u.previous_feature_usage
  ) into result
  from metrics m cross join commercial c cross join usage u;
  return result;
end;
$$;

notify pgrst, 'reload schema';
