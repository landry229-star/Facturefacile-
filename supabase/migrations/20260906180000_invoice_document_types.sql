alter table public.invoices
  add column if not exists invoice_type text not null default 'STANDARD';

alter table public.invoices
  drop constraint if exists invoices_invoice_type_check;

alter table public.invoices
  add constraint invoices_invoice_type_check
  check (invoice_type in ('STANDARD', 'PROFORMA', 'DEPOSIT', 'CREDIT_NOTE', 'FINAL'));

create or replace function public.create_invoice_with_lines(
  p_business_id uuid,
  p_client_id uuid,
  p_issue_date date,
  p_due_date date,
  p_discount numeric,
  p_tax_rate numeric,
  p_invoice_type text,
  p_lines jsonb
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  subscription_plan text;
  invoice_number text;
begin
  if p_invoice_type not in ('STANDARD', 'PROFORMA', 'DEPOSIT', 'CREDIT_NOTE', 'FINAL') then
    raise exception 'Type de facture invalide.';
  end if;

  if p_invoice_type <> 'STANDARD' then
    select plan into subscription_plan
    from public.business_subscriptions
    where business_id = p_business_id
      and status in ('active', 'trialing')
      and (expires_at is null or expires_at > now());

    if subscription_plan not in ('starter', 'pro', 'business') then
      raise exception 'Les types de facture avancés nécessitent au minimum l’abonnement Starter.';
    end if;
  end if;

  invoice_number := public.create_invoice_with_lines(
    p_business_id, p_client_id, p_issue_date, p_due_date,
    p_discount, p_tax_rate, p_lines
  );

  update public.invoices as target_invoice
  set invoice_type = p_invoice_type, updated_at = now()
  where target_invoice.business_id = p_business_id and target_invoice.invoice_number = invoice_number;

  return invoice_number;
end;
$$;

revoke all on function public.create_invoice_with_lines(uuid, uuid, date, date, numeric, numeric, text, jsonb) from public, anon;
grant execute on function public.create_invoice_with_lines(uuid, uuid, date, date, numeric, numeric, text, jsonb) to authenticated;
