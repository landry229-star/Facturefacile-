create or replace function public.can_manage_purchase(
  p_business_id uuid,
  p_permission text
)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select case p_permission
    when 'view' then public.is_business_member(p_business_id, 'viewer')
    when 'create_purchase' then public.is_business_member(p_business_id, 'member')
    when 'register_payment' then public.is_business_member(p_business_id, 'member')
    when 'manage_suppliers' then public.is_business_member(p_business_id, 'admin')
    when 'correct_purchase' then public.is_business_member(p_business_id, 'admin')
    else false
  end;
$$;

revoke all on function public.can_manage_purchase(uuid, text) from public, anon;
grant execute on function public.can_manage_purchase(uuid, text) to authenticated;

drop policy if exists "supplier members create suppliers" on public.suppliers;
drop policy if exists "supplier admins create suppliers" on public.suppliers;
create policy "supplier admins create suppliers" on public.suppliers
  for insert to authenticated with check (public.can_manage_purchase(business_id, 'manage_suppliers'));
drop policy if exists "supplier members update suppliers" on public.suppliers;
drop policy if exists "supplier admins update suppliers" on public.suppliers;
create policy "supplier admins update suppliers" on public.suppliers
  for update to authenticated
  using (public.can_manage_purchase(business_id, 'manage_suppliers'))
  with check (public.can_manage_purchase(business_id, 'manage_suppliers'));

create table if not exists public.purchase_activity_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text not null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists purchase_activity_logs_business_created_idx
  on public.purchase_activity_logs (business_id, created_at desc);
alter table public.purchase_activity_logs enable row level security;
drop policy if exists "purchase members read activity logs" on public.purchase_activity_logs;
create policy "purchase members read activity logs" on public.purchase_activity_logs
  for select to authenticated using (public.can_manage_purchase(business_id, 'view'));
revoke all on public.purchase_activity_logs from anon, authenticated;
grant select on public.purchase_activity_logs to authenticated;

create or replace function public.guard_purchase_business_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_business_id uuid;
  required_permission text;
begin
  if tg_table_name = 'suppliers' then
    target_business_id := case when tg_op = 'DELETE' then old.business_id else new.business_id end;
    required_permission := 'manage_suppliers';
  elsif tg_table_name = 'purchase_payments' then
    target_business_id := case when tg_op = 'DELETE' then old.business_id else new.business_id end;
    required_permission := 'register_payment';
  elsif tg_table_name = 'purchases' then
    target_business_id := case when tg_op = 'DELETE' then old.business_id else new.business_id end;
    required_permission := case
      when tg_op = 'INSERT' then 'create_purchase'
      when tg_op = 'UPDATE' and old.voided_at is distinct from new.voided_at then 'correct_purchase'
      else 'create_purchase'
    end;
  elsif tg_table_name = 'purchase_receipts' then
    target_business_id := case when tg_op = 'DELETE' then old.business_id else new.business_id end;
    required_permission := 'create_purchase';
  elsif tg_table_name = 'purchase_returns' then
    target_business_id := case when tg_op = 'DELETE' then old.business_id else new.business_id end;
    required_permission := 'create_purchase';
  else
    raise exception 'Table d’achat non prise en charge.';
  end if;

  if not public.can_manage_purchase(target_business_id, required_permission) then
    raise exception 'Votre rôle ne permet pas cette opération sur les achats.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.guard_purchase_business_write() from public, anon, authenticated;

drop trigger if exists guard_purchase_supplier_write on public.suppliers;
create trigger guard_purchase_supplier_write
  before insert or update or delete on public.suppliers
  for each row execute function public.guard_purchase_business_write();
drop trigger if exists guard_purchase_write on public.purchases;
create trigger guard_purchase_write
  before insert or update or delete on public.purchases
  for each row execute function public.guard_purchase_business_write();
drop trigger if exists guard_purchase_payment_write on public.purchase_payments;
create trigger guard_purchase_payment_write
  before insert or update or delete on public.purchase_payments
  for each row execute function public.guard_purchase_business_write();
drop trigger if exists guard_purchase_receipt_write on public.purchase_receipts;
create trigger guard_purchase_receipt_write
  before insert or update or delete on public.purchase_receipts
  for each row execute function public.guard_purchase_business_write();
drop trigger if exists guard_purchase_return_write on public.purchase_returns;
create trigger guard_purchase_return_write
  before insert or update or delete on public.purchase_returns
  for each row execute function public.guard_purchase_business_write();

create or replace function public.log_purchase_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  old_values jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  new_values jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  target_business_id uuid;
  target_id uuid;
  target_type text;
  event_action text;
  event_summary text;
  event_details jsonb := '{}'::jsonb;
  actor_label text := coalesce(
    nullif(auth.jwt()->'user_metadata'->>'full_name', ''),
    nullif(auth.jwt()->>'email', ''),
    auth.uid()::text,
    'Système'
  );
  purchase_number text;
  target_member_name text;
begin
  if tg_table_name = 'suppliers' then
    target_business_id := coalesce((new_values->>'business_id')::uuid, (old_values->>'business_id')::uuid);
    target_id := coalesce((new_values->>'id')::uuid, (old_values->>'id')::uuid);
    target_type := 'supplier';
    event_action := case when tg_op = 'INSERT' then 'supplier_created' else 'supplier_updated' end;
    event_summary := case when tg_op = 'INSERT' then 'Fournisseur ajouté' else 'Fournisseur modifié' end;
    event_details := jsonb_build_object(
      'name', coalesce(new_values->>'name', old_values->>'name'),
      'active', coalesce(new_values->>'active', old_values->>'active')
    );
  elsif tg_table_name = 'purchases' then
    if tg_op = 'UPDATE' and (new_values->>'voided_at') is null then return new; end if;
    target_business_id := coalesce((new_values->>'business_id')::uuid, (old_values->>'business_id')::uuid);
    target_id := coalesce((new_values->>'id')::uuid, (old_values->>'id')::uuid);
    target_type := 'purchase';
    event_action := case when tg_op = 'INSERT' then 'purchase_created' else 'purchase_cancelled' end;
    event_summary := case
      when tg_op = 'INSERT' then 'Facture d’achat créée'
      else 'Facture d’achat annulée'
    end;
    event_details := jsonb_build_object(
      'purchase_number', coalesce(new_values->>'purchase_number', old_values->>'purchase_number'),
      'total', coalesce(new_values->>'total', old_values->>'total'),
      'reason', new_values->>'void_reason'
    );
  elsif tg_table_name = 'purchase_payments' then
    target_business_id := coalesce((new_values->>'business_id')::uuid, (old_values->>'business_id')::uuid);
    target_id := coalesce((new_values->>'id')::uuid, (old_values->>'id')::uuid);
    target_type := 'purchase_payment';
    event_action := case
      when tg_op = 'UPDATE' and (new_values->>'reversed_at') is not null then 'payment_reversed'
      else 'payment_registered'
    end;
    event_summary := case
      when event_action = 'payment_reversed' then 'Règlement fournisseur inversé'
      else 'Règlement fournisseur enregistré'
    end;
    select p.purchase_number into purchase_number
      from public.purchases p
     where p.id = coalesce((new_values->>'purchase_id')::uuid, (old_values->>'purchase_id')::uuid);
    event_details := jsonb_build_object(
      'purchase_number', purchase_number,
      'amount', coalesce(new_values->>'amount', old_values->>'amount'),
      'paid_at', coalesce(new_values->>'reversal_date', new_values->>'paid_at', old_values->>'paid_at'),
      'reason', new_values->>'reversal_reason'
    );
  elsif tg_table_name = 'purchase_receipts' then
    target_business_id := coalesce((new_values->>'business_id')::uuid, (old_values->>'business_id')::uuid);
    target_id := coalesce((new_values->>'id')::uuid, (old_values->>'id')::uuid);
    target_type := 'purchase_receipt';
    event_action := 'purchase_received';
    event_summary := 'Réception de marchandises enregistrée';
    select p.purchase_number into purchase_number from public.purchases p where p.id = (new_values->>'purchase_id')::uuid;
    event_details := jsonb_build_object(
      'purchase_number', purchase_number,
      'received_on', new_values->>'received_on',
      'quantity', (select coalesce(sum(pri.quantity), 0) from public.purchase_receipt_items pri where pri.receipt_id = (new_values->>'id')::uuid)
    );
  elsif tg_table_name = 'purchase_returns' then
    target_business_id := coalesce((new_values->>'business_id')::uuid, (old_values->>'business_id')::uuid);
    target_id := coalesce((new_values->>'id')::uuid, (old_values->>'id')::uuid);
    target_type := 'purchase_return';
    event_action := 'purchase_returned';
    event_summary := 'Retour fournisseur enregistré';
    select p.purchase_number into purchase_number from public.purchases p where p.id = (new_values->>'purchase_id')::uuid;
    event_details := jsonb_build_object(
      'purchase_number', purchase_number,
      'returned_on', new_values->>'returned_on',
      'reason', new_values->>'reason',
      'quantity', (select coalesce(sum(pri.quantity), 0) from public.purchase_return_items pri where pri.return_id = (new_values->>'id')::uuid)
    );
  elsif tg_table_name = 'business_members' then
    if tg_op = 'UPDATE' and old_values->>'role' is not distinct from new_values->>'role' then return new; end if;
    target_business_id := coalesce((new_values->>'business_id')::uuid, (old_values->>'business_id')::uuid);
    target_id := coalesce((new_values->>'id')::uuid, (old_values->>'id')::uuid);
    target_type := 'team_member';
    select coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.email, ''), u.id::text)
      into target_member_name
      from auth.users u
     where u.id = coalesce((new_values->>'user_id')::uuid, (old_values->>'user_id')::uuid);
    event_action := case
      when tg_op = 'DELETE' then 'member_removed'
      when tg_op = 'INSERT' then 'member_added'
      else 'member_role_changed'
    end;
    event_summary := case
      when tg_op = 'DELETE' then 'Membre retiré de l’équipe'
      when tg_op = 'INSERT' then 'Membre ajouté à l’équipe'
      else 'Rôle du membre modifié'
    end;
    event_details := jsonb_build_object(
      'user_id', coalesce(new_values->>'user_id', old_values->>'user_id'),
      'member', target_member_name,
      'old_role', old_values->>'role',
      'new_role', new_values->>'role'
    );
  else
    raise exception 'Table d’activité non prise en charge.';
  end if;

  insert into public.purchase_activity_logs (
    business_id, actor_id, actor_name, action, entity_type, entity_id, summary, details
  ) values (
    target_business_id, auth.uid(), actor_label, event_action, target_type, target_id,
    event_summary, event_details
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.log_purchase_activity() from public, anon, authenticated;

drop trigger if exists log_purchase_supplier_activity on public.suppliers;
create trigger log_purchase_supplier_activity
  after insert or update on public.suppliers
  for each row execute function public.log_purchase_activity();
drop trigger if exists log_purchase_activity on public.purchases;
create trigger log_purchase_activity
  after insert or update on public.purchases
  for each row execute function public.log_purchase_activity();
drop trigger if exists log_purchase_payment_activity on public.purchase_payments;
create trigger log_purchase_payment_activity
  after insert or update on public.purchase_payments
  for each row execute function public.log_purchase_activity();
drop trigger if exists log_purchase_receipt_activity on public.purchase_receipts;
create constraint trigger log_purchase_receipt_activity
  after insert on public.purchase_receipts
  deferrable initially deferred
  for each row execute function public.log_purchase_activity();
drop trigger if exists log_purchase_return_activity on public.purchase_returns;
create constraint trigger log_purchase_return_activity
  after insert on public.purchase_returns
  deferrable initially deferred
  for each row execute function public.log_purchase_activity();
drop trigger if exists log_business_member_purchase_activity on public.business_members;
create trigger log_business_member_purchase_activity
  after insert or update of role or delete on public.business_members
  for each row execute function public.log_purchase_activity();

notify pgrst, 'reload schema';
