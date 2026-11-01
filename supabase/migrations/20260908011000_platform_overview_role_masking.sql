create or replace function public.get_platform_admin_overview_secure(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.has_platform_admin_permission('overview') then
    raise exception 'Accès administrateur requis.';
  end if;
  result := public.get_platform_admin_overview_period(p_from, p_to);
  if not public.has_platform_admin_permission('finance')
     and not public.has_platform_admin_permission('subscription_payments') then
    result := result - array[
      'revenue', 'subscription_revenue', 'revenue_month', 'revenue_previous_month',
      'revenue_change_percent', 'revenue_by_plan', 'failed_payments', 'refund_amount',
      'unpaid_payments', 'monthly_recurring_revenue', 'currency', 'pending_payments'
    ];
  end if;
  return result;
end;
$$;

revoke all on function public.get_platform_admin_overview_secure(timestamptz, timestamptz) from public, anon;
grant execute on function public.get_platform_admin_overview_secure(timestamptz, timestamptz) to authenticated;
notify pgrst, 'reload schema';
