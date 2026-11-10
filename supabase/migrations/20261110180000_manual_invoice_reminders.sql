create table if not exists public.manual_invoice_reminders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  reminder_date date not null default current_date,
  message text not null check (length(trim(message)) > 0),
  status text not null default 'prepared' check (status in ('prepared', 'sent')),
  sent_via text check (sent_via is null or sent_via in ('email', 'whatsapp', 'phone', 'other')),
  sent_at timestamptz,
  sent_by uuid references auth.users(id) on delete set null,
  request_id uuid not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (business_id, request_id),
  check (
    (status = 'sent' and sent_at is not null and sent_via is not null)
    or (status = 'prepared' and sent_at is null and sent_via is null)
  )
);

create index if not exists manual_invoice_reminders_business_date_idx
  on public.manual_invoice_reminders (business_id, created_at desc);
create index if not exists manual_invoice_reminders_invoice_date_idx
  on public.manual_invoice_reminders (invoice_id, created_at desc);

alter table public.manual_invoice_reminders enable row level security;

drop policy if exists "business members read manual invoice reminders" on public.manual_invoice_reminders;
create policy "business members read manual invoice reminders"
  on public.manual_invoice_reminders for select to authenticated
  using (public.is_business_member(business_id, 'viewer'));

revoke all on public.manual_invoice_reminders from public, anon, authenticated;
grant select on public.manual_invoice_reminders to authenticated;

create or replace function public.prepare_overdue_invoice_reminder(
  p_business_id uuid,
  p_invoice_id uuid,
  p_request_id uuid
)
returns table (
  reminder_id uuid,
  invoice_number text,
  client_name text,
  client_email text,
  due_date date,
  remaining_amount numeric,
  currency text,
  message text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  invoice_row public.invoices%rowtype;
  client_row public.clients%rowtype;
  business_name text;
  paid_amount numeric;
  request_row public.manual_invoice_reminders%rowtype;
  reminder_message text;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;
  if p_request_id is null then raise exception 'La clé de préparation est obligatoire.'; end if;
  perform pg_advisory_xact_lock(
    hashtextextended(p_business_id::text || ':manual-reminder:' || p_request_id::text, 0)
  );
  select * into request_row
    from public.manual_invoice_reminders
    where business_id = p_business_id and request_id = p_request_id;
  if found then
    if request_row.invoice_id <> p_invoice_id then
      raise exception 'Cette clé de préparation a déjà été utilisée pour une autre facture.';
    end if;
    select * into invoice_row
      from public.invoices i
      where i.id = request_row.invoice_id and i.business_id = p_business_id;
    select * into client_row
      from public.clients c
      where c.id = invoice_row.client_id and c.business_id = p_business_id;
    return query
      select request_row.id, invoice_row.invoice_number, client_row.name, client_row.email,
        invoice_row.due_date,
        greatest(0, invoice_row.total - coalesce((
          select sum(p.effective_amount) from public.payments p where p.invoice_id = invoice_row.id
        ), 0)),
        invoice_row.currency,
        request_row.message;
    return;
  end if;

  select * into invoice_row from public.invoices i
    where i.id = p_invoice_id and i.business_id = p_business_id
    for update;
  if not found then raise exception 'Facture introuvable ou non autorisée.'; end if;
  if invoice_row.due_date is null or invoice_row.due_date >= current_date
    or invoice_row.status in ('DRAFT', 'CANCELLED', 'PAID')
    or invoice_row.invoice_type in ('PROFORMA', 'CREDIT_NOTE')
    or invoice_row.benin_document_type = 'proforma' then
    raise exception 'Cette facture ne peut pas faire l''objet d''une relance.';
  end if;
  select coalesce(sum(p.effective_amount), 0) into paid_amount
    from public.payments p where p.invoice_id = invoice_row.id;
  if invoice_row.total - paid_amount <= 0 then
    raise exception 'Cette facture est déjà réglée.';
  end if;
  select * into client_row from public.clients c
    where c.id = invoice_row.client_id and c.business_id = p_business_id;
  select b.name into business_name from public.businesses b where b.id = p_business_id;

  reminder_message := format(
    'Bonjour %s,%sNous vous rappelons que la facture %s, arrivée à échéance le %s, présente un solde restant de %s %s.%sMerci de nous indiquer si le règlement a déjà été effectué ou de nous préciser la date prévue de paiement.%sCordialement,%s',
    coalesce(nullif(trim(client_row.name), ''), 'Madame, Monsieur'),
    E'\n\n',
    invoice_row.invoice_number,
    to_char(invoice_row.due_date, 'DD/MM/YYYY'),
    to_char(invoice_row.total - paid_amount, 'FM999G999G999G990D00'),
    case invoice_row.currency when 'EUR' then 'EUR' when 'USD' then 'USD' else 'FCFA' end,
    E'\n\n',
    E'\n\n',
    coalesce(business_name, 'Votre fournisseur')
  );
  insert into public.manual_invoice_reminders (
    business_id, invoice_id, reminder_date, message, request_id, created_by
  ) values (
    p_business_id, p_invoice_id, current_date, reminder_message, p_request_id, auth.uid()
  ) returning id into reminder_id;

  return query select reminder_id, invoice_row.invoice_number, client_row.name, client_row.email,
    invoice_row.due_date, invoice_row.total - paid_amount, invoice_row.currency, reminder_message;
end;
$$;

create or replace function public.mark_manual_invoice_reminder_sent(
  p_business_id uuid,
  p_reminder_id uuid,
  p_sent_via text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;
  if p_sent_via is null or p_sent_via not in ('email', 'whatsapp', 'phone', 'other') then
    raise exception 'Le canal d''envoi est invalide.';
  end if;
  update public.manual_invoice_reminders r
    set status = 'sent',
        sent_via = p_sent_via,
        sent_at = now(),
        sent_by = auth.uid()
    where r.id = p_reminder_id
      and r.business_id = p_business_id
      and r.status = 'prepared'
      and exists (
        select 1 from public.invoices i
        where i.id = r.invoice_id
          and i.business_id = p_business_id
          and i.status not in ('DRAFT', 'CANCELLED', 'PAID')
          and i.due_date < current_date
          and i.invoice_type not in ('PROFORMA', 'CREDIT_NOTE')
          and coalesce(i.benin_document_type, '') <> 'proforma'
          and i.total > coalesce((
            select sum(p.effective_amount) from public.payments p where p.invoice_id = i.id
          ), 0)
      );
  if not found then raise exception 'Cette relance ne peut pas être marquée comme envoyée; vérifiez le statut de la facture.'; end if;
end;
$$;

create or replace function public.update_manual_invoice_reminder_message(
  p_business_id uuid,
  p_reminder_id uuid,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reminder_row public.manual_invoice_reminders%rowtype;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;
  if length(trim(coalesce(p_message, ''))) = 0 or length(p_message) > 5000 then
    raise exception 'Le texte de la relance est vide ou trop long.';
  end if;
  select * into reminder_row
    from public.manual_invoice_reminders r
    where r.id = p_reminder_id and r.business_id = p_business_id
    for update;
  if not found or reminder_row.status <> 'prepared' then
    raise exception 'Seule une relance préparée peut être modifiée.';
  end if;
  if not exists (
    select 1
      from public.invoices i
     where i.id = reminder_row.invoice_id
       and i.business_id = p_business_id
       and i.status not in ('DRAFT', 'CANCELLED', 'PAID')
       and i.due_date < current_date
       and i.invoice_type not in ('PROFORMA', 'CREDIT_NOTE')
       and coalesce(i.benin_document_type, '') <> 'proforma'
       and i.total > coalesce((
         select sum(p.effective_amount) from public.payments p where p.invoice_id = i.id
       ), 0)
  ) then raise exception 'La facture ne peut plus faire l''objet d''une relance.'; end if;
  update public.manual_invoice_reminders
     set message = trim(p_message)
   where id = p_reminder_id and business_id = p_business_id;
end;
$$;

revoke all on function public.prepare_overdue_invoice_reminder(uuid, uuid, uuid) from public, anon;
grant execute on function public.prepare_overdue_invoice_reminder(uuid, uuid, uuid) to authenticated;
revoke all on function public.mark_manual_invoice_reminder_sent(uuid, uuid, text) from public, anon;
grant execute on function public.mark_manual_invoice_reminder_sent(uuid, uuid, text) to authenticated;
revoke all on function public.update_manual_invoice_reminder_message(uuid, uuid, text) from public, anon;
grant execute on function public.update_manual_invoice_reminder_message(uuid, uuid, text) to authenticated;
