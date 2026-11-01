create or replace function public.create_invoice_with_lines(
  p_business_id uuid,
  p_client_id uuid,
  p_issue_date date,
  p_due_date date,
  p_discount numeric,
  p_tax_rate numeric,
  p_lines jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.business_subscriptions (business_id, plan, status, monthly_invoice_limit)
  values (p_business_id, 'free', 'active', 20)
  on conflict (business_id) do nothing;

  return public.create_invoice_with_lines_legacy(
    p_business_id, p_client_id, p_issue_date, p_due_date,
    p_discount, p_tax_rate, p_lines
  );
end;
$$;

revoke all on function public.create_invoice_with_lines(uuid, uuid, date, date, numeric, numeric, jsonb) from public, anon;
grant execute on function public.create_invoice_with_lines(uuid, uuid, date, date, numeric, numeric, jsonb) to authenticated;
