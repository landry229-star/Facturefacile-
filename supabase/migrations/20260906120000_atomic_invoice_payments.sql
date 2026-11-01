create or replace function public.record_invoice_payment(
  p_business_id uuid,
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_date date default current_date,
  p_method text default 'cash',
  p_reference text default null
)
returns table (payment_id uuid, paid_amount numeric, remaining_amount numeric, invoice_status text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  invoice_row public.invoices;
  paid_before numeric;
  next_paid numeric;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Le montant du paiement doit être positif.';
  end if;

  select *
  into invoice_row
  from public.invoices
  where id = p_invoice_id
    and business_id = p_business_id
  for update;

  if not found then
    raise exception 'Facture introuvable.';
  end if;
  if invoice_row.status in ('DRAFT', 'CANCELLED', 'PAID') then
    raise exception 'Cette facture ne peut plus recevoir de paiement.';
  end if;

  select coalesce(sum(amount), 0)
  into paid_before
  from public.payments
  where invoice_id = p_invoice_id
    and business_id = p_business_id;

  next_paid := paid_before + p_amount;
  if next_paid > invoice_row.total then
    raise exception 'Le montant dépasse le solde restant de cette facture.';
  end if;

  insert into public.payments (business_id, invoice_id, amount, payment_date, method, reference)
  values (p_business_id, p_invoice_id, p_amount, coalesce(p_payment_date, current_date), coalesce(nullif(p_method, ''), 'cash'), nullif(p_reference, ''))
  returning id into payment_id;

  invoice_status := case when next_paid >= invoice_row.total then 'PAID' else 'PARTIALLY_PAID' end;
  update public.invoices
  set status = invoice_status, updated_at = now()
  where id = p_invoice_id;

  paid_amount := next_paid;
  remaining_amount := greatest(invoice_row.total - next_paid, 0);
  return next;
end;
$$;

revoke all on function public.record_invoice_payment(uuid, uuid, numeric, date, text, text) from public, anon;
grant execute on function public.record_invoice_payment(uuid, uuid, numeric, date, text, text) to authenticated;
