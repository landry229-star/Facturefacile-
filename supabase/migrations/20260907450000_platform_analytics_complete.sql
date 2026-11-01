alter table public.businesses add column if not exists business_type text;

create or replace function public.get_platform_analytics(
  p_from timestamptz default now() - interval '30 days',
  p_to timestamptz default now(),
  p_plan text default null,
  p_sector text default null,
  p_business_type text default null
) returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare result jsonb; period interval := p_to - p_from;
begin
  if not public.has_platform_admin_permission('analytics') then raise exception 'Accès administrateur requis.'; end if;
  with scoped as (
    select b.id, b.created_at, b.platform_status, coalesce(s.plan, 'free') plan
    from businesses b left join business_subscriptions s on s.business_id = b.id
    where not exists (select 1 from platform_admins pa where pa.user_id = b.owner_id)
      and (p_plan is null or coalesce(s.plan, 'free') = p_plan)
      and (p_sector is null or b.sector = p_sector)
      and (p_business_type is null or b.business_type = p_business_type)
  ), periods as (
    select
      count(*) filter (where created_at >= p_from and created_at < p_to)::numeric signups,
      count(*) filter (where platform_status = 'active')::numeric active_businesses,
      count(*) filter (where plan <> 'free' and created_at >= p_from and created_at < p_to)::numeric paid_conversions,
      count(*) filter (where created_at >= p_from and created_at < p_to)::numeric total_signups,
      count(*) filter (where created_at >= p_from - period and created_at < p_from)::numeric previous_signups
    from scoped
  ), commercial as (
    select
      coalesce(sum(case when s.status in ('active','trialing') then coalesce(p.price, 0) else 0 end), 0)::numeric mrr,
      count(*) filter (where s.expires_at between p_from and p_to)::numeric renewals,
      count(*) filter (where s.status in ('cancelled','expired','suspended') and s.updated_at between p_from and p_to)::numeric churn,
      coalesce((select sum(pay.amount) from subscription_payments pay join scoped sc on sc.id = pay.business_id where pay.status = 'completed' and pay.created_at between p_from and p_to), 0)::numeric revenue
    from business_subscriptions s join scoped sc on sc.id = s.business_id
    left join subscription_plans p on p.code = s.plan
  ), usage as (
    select jsonb_build_array(
      jsonb_build_object('feature','Factures','usage',(select count(*) from invoices where created_at between p_from and p_to)),
      jsonb_build_object('feature','Clients','usage',(select count(*) from clients where created_at between p_from and p_to)),
      jsonb_build_object('feature','Produits','usage',(select count(*) from products where created_at between p_from and p_to)),
      jsonb_build_object('feature','Utilisateurs actifs','usage',(select count(*) from business_members where created_at between p_from and p_to))
    ) feature_usage
  )
  select jsonb_build_object(
    'current', jsonb_build_object(
      'signups', periods.signups, 'active_users', (select count(*) from business_members where created_at between p_from and p_to),
      'active_businesses', periods.active_businesses, 'activation_rate', case when periods.total_signups = 0 then 0 else round(periods.active_businesses / periods.total_signups * 100, 2) end,
      'conversion_rate', case when periods.total_signups = 0 then 0 else round(periods.paid_conversions / periods.total_signups * 100, 2) end,
      'paid_conversions', periods.paid_conversions, 'renewals', commercial.renewals, 'churn', commercial.churn,
      'mrr', commercial.mrr, 'arr', commercial.mrr * 12, 'revenue', commercial.revenue
    ),
    'previous', jsonb_build_object('signups', periods.previous_signups),
    'feature_usage', usage.feature_usage
  ) into result from periods cross join commercial cross join usage;
  return result;
end;
$$;

notify pgrst, 'reload schema';
