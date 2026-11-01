create or replace function public.create_recurring_invoice(
  p_business_id uuid,
  p_client_id uuid,
  p_product_id uuid,
  p_frequency text,
  p_next_issue_date date,
  p_due_days integer
)
returns public.recurring_invoices
language plpgsql
security invoker
set search_path = public
as $$
declare
  subscription_row public.business_subscriptions;
  created_recurring public.recurring_invoices;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;

  select *
  into subscription_row
  from public.business_subscriptions
  where business_id = p_business_id;

  if not found or subscription_row.plan not in ('starter', 'pro')
    or subscription_row.status not in ('active', 'trialing')
    or (subscription_row.expires_at is not null and subscription_row.expires_at < now()) then
    raise exception 'Les factures récurrentes nécessitent un abonnement Starter ou Pro actif.';
  end if;

  insert into public.recurring_invoices (business_id, client_id, product_id, frequency, next_issue_date, due_days)
  values (p_business_id, p_client_id, p_product_id, p_frequency, p_next_issue_date, p_due_days)
  returning * into created_recurring;

  return created_recurring;
end;
$$;

revoke all on function public.create_recurring_invoice(uuid, uuid, uuid, text, date, integer) from public, anon;
grant execute on function public.create_recurring_invoice(uuid, uuid, uuid, text, date, integer) to authenticated;
