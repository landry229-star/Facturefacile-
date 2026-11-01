create or replace function public.update_invoice_details(
  p_business_id uuid,
  p_invoice_number text,
  p_client_id uuid,
  p_issue_date date,
  p_due_date date,
  p_discount numeric,
  p_tax_rate numeric
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  invoice_row public.invoices;
  tax_rate numeric;
  next_tax numeric;
  next_total numeric;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;

  select *
  into invoice_row
  from public.invoices
  where business_id = p_business_id and invoice_number = p_invoice_number
  for update;

  if not found then
    raise exception 'Facture introuvable.';
  end if;
  if invoice_row.status in ('PAID', 'CANCELLED', 'PARTIALLY_PAID') then
    raise exception 'Cette facture ne peut plus être modifiée.';
  end if;
  if not exists (select 1 from public.clients where id = p_client_id and business_id = p_business_id) then
    raise exception 'Client non autorisé.';
  end if;
  if p_due_date is not null and p_due_date < p_issue_date then
    raise exception 'La date d’échéance doit être postérieure à la date de facture.';
  end if;

  tax_rate := greatest(coalesce(p_tax_rate, 0), 0);
  next_tax := (invoice_row.subtotal - least(greatest(coalesce(p_discount, 0), 0), invoice_row.subtotal)) * tax_rate / 100;
  next_total := invoice_row.subtotal - least(greatest(coalesce(p_discount, 0), 0), invoice_row.subtotal) + next_tax;

  update public.invoices
  set client_id = p_client_id,
      issue_date = p_issue_date,
      due_date = p_due_date,
      discount = least(greatest(coalesce(p_discount, 0), 0), invoice_row.subtotal),
      tax = next_tax,
      total = next_total,
      updated_at = now()
  where id = invoice_row.id;
end;
$$;

revoke all on function public.update_invoice_details(uuid, text, uuid, date, date, numeric, numeric) from public, anon;
grant execute on function public.update_invoice_details(uuid, text, uuid, date, date, numeric, numeric) to authenticated;
