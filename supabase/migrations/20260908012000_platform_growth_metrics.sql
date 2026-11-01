insert into public.platform_settings(key, value)
values ('monthly_revenue_goal', '{"amount":1000000,"currency":"XOF"}')
on conflict (key) do nothing;

create or replace function public.get_platform_growth_metrics(p_from timestamptz default null, p_to timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  from_at timestamptz := coalesce(p_from, date_trunc('month', now()));
  to_at timestamptz := coalesce(p_to, now());
  previous_from timestamptz := from_at - (to_at - from_at);
  current_revenue numeric := coalesce((select sum(amount) from subscription_payments where status in ('paid','succeeded') and created_at >= from_at and created_at < to_at), 0);
  previous_revenue numeric := coalesce((select sum(amount) from subscription_payments where status in ('paid','succeeded') and created_at >= previous_from and created_at < from_at), 0);
  goal numeric := coalesce((select ((value::jsonb)->>'amount')::numeric from platform_settings where key = 'monthly_revenue_goal'), 1000000);
  active_start bigint := (select count(*) from businesses where created_at < from_at);
  active_end bigint := (select count(*) from businesses where created_at < to_at);
  churned bigint := (select count(*) from businesses where platform_status in ('cancelled','suspended','expired') and updated_at >= from_at and updated_at < to_at);
begin
  return jsonb_build_object(
    'monthly_revenue_goal', goal,
    'goal_progress_percent', case when goal > 0 then round(current_revenue / goal * 100, 1) else 0 end,
    'growth_percent', case when previous_revenue > 0 then round((current_revenue - previous_revenue) / previous_revenue * 100, 1) else null end,
    'retention_rate', case when active_start > 0 then round(greatest(active_start - churned, 0)::numeric / active_start * 100, 1) else 100 end,
    'churn_rate', case when active_start > 0 then round(churned::numeric / active_start * 100, 1) else 0 end
  );
end;
$$;

grant execute on function public.get_platform_growth_metrics(timestamptz, timestamptz) to authenticated;
