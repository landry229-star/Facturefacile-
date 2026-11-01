alter table public.payments
  add column if not exists transaction_type text not null default 'receipt',
  add column if not exists status text not null default 'reconciled',
  add column if not exists reconciled_at timestamptz,
  add column if not exists reconciled_by uuid references auth.users(id) on delete set null,
  add column if not exists reconciliation_reference text,
  add column if not exists original_payment_id uuid references public.payments(id),
  add column if not exists reversal_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null;

update public.payments
set reconciled_at = coalesce(reconciled_at, created_at)
where status = 'reconciled';

alter table public.payments
  drop constraint if exists payments_transaction_type_check,
  drop constraint if exists payments_status_check,
  drop constraint if exists payments_refund_origin_check,
  add constraint payments_transaction_type_check
    check (transaction_type in ('receipt', 'refund')),
  add constraint payments_status_check
    check (status in ('pending', 'reconciled', 'cancelled')),
  add constraint payments_refund_origin_check
    check (
      (transaction_type = 'receipt' and original_payment_id is null)
      or (transaction_type = 'refund' and original_payment_id is not null)
    );

alter table public.payments
  add column if not exists effective_amount numeric(12, 2)
  generated always as (
    case
      when status <> 'reconciled' then 0
      when transaction_type = 'refund' then -amount
      else amount
    end
  ) stored;

create index if not exists payments_business_status_date_idx
  on public.payments (business_id, status, payment_date desc);
create index if not exists payments_original_payment_idx
  on public.payments (original_payment_id)
  where original_payment_id is not null;

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  event_type text not null check (event_type in ('recorded', 'reconciled', 'corrected', 'cancelled', 'refund_recorded')),
  actor_id uuid references auth.users(id) on delete set null,
  reason text,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payment_events_payment_created_idx
  on public.payment_events (payment_id, created_at desc);
alter table public.payment_events enable row level security;
revoke all on public.payment_events from public, anon, authenticated;
grant select on public.payment_events to authenticated;

drop policy if exists "business members read payment events" on public.payment_events;
create policy "business members read payment events"
  on public.payment_events for select
  using (
    exists (
      select 1
      from public.payments p
      join public.business_members m on m.business_id = p.business_id
      where p.id = payment_id and m.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.payments p
      join public.businesses b on b.id = p.business_id
      where p.id = payment_id and b.owner_id = auth.uid()
    )
  );

drop policy if exists "payments_update_own_business" on public.payments;
revoke insert, update, delete on public.payments from public, anon, authenticated;
grant select on public.payments to authenticated;

create or replace function public.refresh_invoice_payment_status(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_row public.invoices;
  received numeric;
  next_status text;
begin
  select * into invoice_row from public.invoices where id = p_invoice_id for update;
  if not found or invoice_row.status in ('DRAFT', 'CANCELLED') then
    return;
  end if;

  select coalesce(sum(effective_amount), 0)
    into received
    from public.payments
   where invoice_id = p_invoice_id;

  next_status := case
    when received >= invoice_row.total then 'PAID'
    when received > 0 then 'PARTIALLY_PAID'
    when invoice_row.due_date < current_date then 'OVERDUE'
    else 'SENT'
  end;

  update public.invoices
     set status = next_status, updated_at = now()
   where id = p_invoice_id and status is distinct from next_status;
end;
$$;
revoke all on function public.refresh_invoice_payment_status(uuid) from public, anon, authenticated;

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
security definer
set search_path = public
as $$
declare
  invoice_row public.invoices;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Le montant du paiement doit être positif.';
  end if;
  if p_payment_date is null or p_payment_date > current_date then
    raise exception 'La date du paiement ne peut pas être dans le futur.';
  end if;

  select * into invoice_row
    from public.invoices
   where id = p_invoice_id and business_id = p_business_id
   for update;
  if not found then
    raise exception 'Facture introuvable.';
  end if;
  if invoice_row.status = 'CANCELLED' then
    raise exception 'Une facture annulée ne peut pas recevoir de paiement.';
  end if;

  insert into public.payments (
    business_id, invoice_id, amount, payment_date, method, reference, transaction_type, status
  ) values (
    p_business_id, p_invoice_id, p_amount, p_payment_date,
    coalesce(nullif(trim(p_method), ''), 'cash'), nullif(trim(p_reference), ''),
    'receipt', 'pending'
  )
  returning id into payment_id;

  insert into public.payment_events (payment_id, event_type, actor_id, event_data)
  values (
    payment_id, 'recorded', auth.uid(),
    jsonb_build_object('amount', p_amount, 'payment_date', p_payment_date, 'method', p_method, 'reference', p_reference)
  );

  select coalesce(sum(effective_amount), 0) into paid_amount
    from public.payments where invoice_id = p_invoice_id;
  remaining_amount := greatest(invoice_row.total - paid_amount, 0);
  invoice_status := invoice_row.status;
  return next;
end;
$$;

create or replace function public.reconcile_invoice_payment(
  p_business_id uuid,
  p_payment_id uuid,
  p_reconciliation_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row public.payments;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;
  select * into payment_row from public.payments
   where id = p_payment_id and business_id = p_business_id;
  if not found then raise exception 'Paiement introuvable.'; end if;

  perform 1 from public.invoices where id = payment_row.invoice_id for update;
  select * into payment_row from public.payments where id = p_payment_id for update;
  if payment_row.status <> 'pending' then
    raise exception 'Seul un paiement en attente de rapprochement peut être confirmé.';
  end if;

  update public.payments
     set status = 'reconciled',
         reconciled_at = now(),
         reconciled_by = auth.uid(),
         reconciliation_reference = nullif(trim(p_reconciliation_reference), '')
   where id = p_payment_id;
  insert into public.payment_events (payment_id, event_type, actor_id, reason, event_data)
  values (p_payment_id, 'reconciled', auth.uid(), nullif(trim(p_reconciliation_reference), ''),
          jsonb_build_object('amount', payment_row.amount, 'transaction_type', payment_row.transaction_type));
  perform public.refresh_invoice_payment_status(payment_row.invoice_id);
end;
$$;

create or replace function public.correct_invoice_payment(
  p_business_id uuid,
  p_payment_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_method text,
  p_reference text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row public.payments;
  next_values jsonb;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Le montant doit être positif.'; end if;
  if p_payment_date is null or p_payment_date > current_date then raise exception 'La date ne peut pas être dans le futur.'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Le motif de correction est obligatoire.'; end if;

  select * into payment_row from public.payments
   where id = p_payment_id and business_id = p_business_id;
  if not found then raise exception 'Paiement introuvable.'; end if;
  perform 1 from public.invoices where id = payment_row.invoice_id for update;
  select * into payment_row from public.payments where id = p_payment_id for update;
  if payment_row.status <> 'pending' or payment_row.transaction_type <> 'receipt' then
    raise exception 'Seul un encaissement en attente de rapprochement peut être corrigé.';
  end if;

  next_values := jsonb_build_object(
    'amount', p_amount, 'payment_date', p_payment_date,
    'method', p_method, 'reference', p_reference
  );
  update public.payments
     set amount = p_amount, payment_date = p_payment_date,
         method = coalesce(nullif(trim(p_method), ''), 'cash'),
         reference = nullif(trim(p_reference), '')
   where id = p_payment_id;
  insert into public.payment_events (payment_id, event_type, actor_id, reason, event_data)
  values (p_payment_id, 'corrected', auth.uid(), trim(p_reason),
          jsonb_build_object('before', jsonb_build_object('amount', payment_row.amount, 'payment_date', payment_row.payment_date, 'method', payment_row.method, 'reference', payment_row.reference), 'after', next_values));
end;
$$;

create or replace function public.cancel_invoice_payment(
  p_business_id uuid,
  p_payment_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row public.payments;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Le motif d’annulation est obligatoire.'; end if;
  select * into payment_row from public.payments
   where id = p_payment_id and business_id = p_business_id;
  if not found then raise exception 'Paiement introuvable.'; end if;
  perform 1 from public.invoices where id = payment_row.invoice_id for update;
  select * into payment_row from public.payments where id = p_payment_id for update;
  if payment_row.status = 'cancelled' then raise exception 'Ce paiement est déjà annulé.'; end if;
  if payment_row.transaction_type = 'receipt' and exists (
    select 1 from public.payments r
    where r.original_payment_id = p_payment_id and r.status <> 'cancelled'
  ) then
    raise exception 'Annulez d’abord les remboursements liés à cet encaissement.';
  end if;

  update public.payments set status = 'cancelled', reversal_reason = trim(p_reason),
      cancelled_at = now(), cancelled_by = auth.uid()
   where id = p_payment_id;
  insert into public.payment_events (payment_id, event_type, actor_id, reason, event_data)
  values (p_payment_id, 'cancelled', auth.uid(), trim(p_reason),
          jsonb_build_object('previous_status', payment_row.status, 'amount', payment_row.amount));
  perform public.refresh_invoice_payment_status(payment_row.invoice_id);
end;
$$;

create or replace function public.refund_invoice_payment(
  p_business_id uuid,
  p_payment_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_reference text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row public.payments;
  refunded numeric;
  refund_id uuid;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Le remboursement doit être positif.'; end if;
  if p_payment_date is null or p_payment_date > current_date then raise exception 'La date du remboursement ne peut pas être dans le futur.'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Le motif du remboursement est obligatoire.'; end if;

  select * into payment_row from public.payments
   where id = p_payment_id and business_id = p_business_id;
  if not found then raise exception 'Paiement introuvable.'; end if;
  perform 1 from public.invoices where id = payment_row.invoice_id for update;
  select * into payment_row from public.payments where id = p_payment_id for update;
  if payment_row.transaction_type <> 'receipt' or payment_row.status <> 'reconciled' then
    raise exception 'Seul un encaissement rapproché peut être remboursé.';
  end if;

  select coalesce(sum(amount), 0) into refunded
    from public.payments
   where original_payment_id = p_payment_id and status <> 'cancelled';
  if refunded + p_amount > payment_row.amount then
    raise exception 'Le montant cumulé des remboursements dépasserait l’encaissement d’origine.';
  end if;

  insert into public.payments (
    business_id, invoice_id, amount, payment_date, method, reference,
    transaction_type, status, original_payment_id, reversal_reason
  ) values (
    p_business_id, payment_row.invoice_id, p_amount, p_payment_date,
    payment_row.method, nullif(trim(p_reference), ''),
    'refund', 'pending', p_payment_id, trim(p_reason)
  )
  returning id into refund_id;
  insert into public.payment_events (payment_id, event_type, actor_id, reason, event_data)
  values (refund_id, 'refund_recorded', auth.uid(), trim(p_reason),
          jsonb_build_object('original_payment_id', p_payment_id, 'amount', p_amount, 'payment_date', p_payment_date, 'reference', p_reference));
  return refund_id;
end;
$$;

revoke all on function public.record_invoice_payment(uuid, uuid, numeric, date, text, text) from public, anon;
revoke all on function public.reconcile_invoice_payment(uuid, uuid, text) from public, anon;
revoke all on function public.correct_invoice_payment(uuid, uuid, numeric, date, text, text, text) from public, anon;
revoke all on function public.cancel_invoice_payment(uuid, uuid, text) from public, anon;
revoke all on function public.refund_invoice_payment(uuid, uuid, numeric, date, text, text) from public, anon;
grant execute on function public.record_invoice_payment(uuid, uuid, numeric, date, text, text) to authenticated;
grant execute on function public.reconcile_invoice_payment(uuid, uuid, text) to authenticated;
grant execute on function public.correct_invoice_payment(uuid, uuid, numeric, date, text, text, text) to authenticated;
grant execute on function public.cancel_invoice_payment(uuid, uuid, text) to authenticated;
grant execute on function public.refund_invoice_payment(uuid, uuid, numeric, date, text, text) to authenticated;
