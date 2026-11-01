alter table public.audit_logs
  add column if not exists changed_fields text[];

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  business uuid;
  record_uuid uuid;
  changed text[];
begin
  business := coalesce(new.business_id, old.business_id);
  record_uuid := coalesce(new.id, old.id);

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(new_field.key order by new_field.key), '{}'::text[])
      into changed
      from jsonb_each(to_jsonb(new)) as new_field
      join jsonb_each(to_jsonb(old)) as old_field using (key)
      where new_field.value is distinct from old_field.value
        and new_field.key not in ('created_at', 'updated_at');
  end if;

  insert into public.audit_logs (business_id, actor_id, table_name, action, record_id, changed_fields)
  values (business, auth.uid(), tg_table_name, tg_op, record_uuid, changed);
  return coalesce(new, old);
end;
$$;

create table if not exists public.invoice_communications (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  event_type text not null check (event_type in ('invoice_email', 'overdue_reminder')),
  status text not null check (status in ('accepted', 'failed')),
  recipient text,
  provider_message_id text,
  created_at timestamptz not null default now()
);

create index if not exists invoice_communications_invoice_created_idx
  on public.invoice_communications (invoice_id, created_at desc);

alter table public.invoice_communications enable row level security;
revoke all on public.invoice_communications from public, anon;
grant select on public.invoice_communications to authenticated;

drop policy if exists "business members read invoice communications" on public.invoice_communications;
create policy "business members read invoice communications"
  on public.invoice_communications for select
  using (
    exists (
      select 1
      from public.invoices i
      left join public.business_members m
        on m.business_id = i.business_id
       and m.user_id = auth.uid()
      left join public.businesses b
        on b.id = i.business_id
      where i.id = invoice_id
        and (m.user_id is not null or b.owner_id = auth.uid())
    )
  );

create or replace function public.log_invoice_email_attempt(
  p_business_id uuid,
  p_invoice_number text,
  p_status text,
  p_provider_message_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_uuid uuid;
  recipient_email text;
begin
  if auth.uid() is null or p_status is null or p_status not in ('accepted', 'failed') then
    raise exception 'Tentative d’envoi invalide ou non autorisée.';
  end if;

  if not (
    exists (select 1 from public.businesses b where b.id = p_business_id and b.owner_id = auth.uid())
    or exists (
      select 1 from public.business_members m
      where m.business_id = p_business_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin', 'member')
    )
  ) then
    raise exception 'Accès non autorisé à cette entreprise.';
  end if;

  select i.id, c.email
    into invoice_uuid, recipient_email
    from public.invoices i
    left join public.clients c on c.id = i.client_id
   where i.business_id = p_business_id
     and i.invoice_number = p_invoice_number;

  if invoice_uuid is null then
    raise exception 'Facture introuvable dans cette entreprise.';
  end if;

  insert into public.invoice_communications (
    invoice_id, event_type, status, recipient, provider_message_id
  ) values (
    invoice_uuid, 'invoice_email', p_status, recipient_email, p_provider_message_id
  );
end;
$$;

revoke all on function public.log_invoice_email_attempt(uuid, text, text, text) from public, anon;
grant execute on function public.log_invoice_email_attempt(uuid, text, text, text) to authenticated;
