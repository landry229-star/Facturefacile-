-- ============================================================================
-- FACTUREFACILE BENIN - TEST DATABASE ONLY
-- DO NOT RUN THIS FILE AGAINST THE PRODUCTION SUPABASE PROJECT.
-- Use on a new, empty Supabase TEST project. On a project shared with another
-- app, run only after checking that its table, function, bucket, and policy
-- names do not conflict; this file does not isolate Supabase Auth users.
-- This file combines schema.sql and the FactureFacile migrations.
-- Recurring, audit, and team tables are created before migrations referencing them.
-- All table declarations use CREATE TABLE IF NOT EXISTS: an existing table is
-- not dropped or recreated. Later ALTER statements can still update its schema.
-- Review the target project name in the Supabase Dashboard before execution.
-- This is a generated snapshot; update it whenever schema.sql or migrations change.
-- ============================================================================

-- Source: supabase/schema.sql
begin;
create extension if not exists "pgcrypto";

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  city text default 'Cotonou',
  country text not null default 'Bénin',
  tax_id text,
  fiscal_regime text check (fiscal_regime is null or fiscal_regime in ('TPS', 'REEL')),
  payment_instructions text,
  invoice_legal_notice text,
  default_due_days integer not null default 30 check (default_due_days between 0 and 365),
  default_tax_rate numeric(5, 2) not null default 0 check (default_tax_rate between 0 and 100),
  currency text not null default 'XOF' check (currency in ('XOF', 'EUR', 'USD')),
  timezone text not null default 'Africa/Porto-Novo' check (timezone in ('Africa/Porto-Novo', 'Africa/Abidjan', 'Africa/Lagos', 'UTC')),
  invoice_number_prefix text not null default 'FAC' check (invoice_number_prefix ~ '^[A-Z0-9][A-Z0-9-]{0,11}$'),
  invoice_number_include_year boolean not null default true,
  invoice_number_sequence_width integer not null default 5 check (invoice_number_sequence_width between 3 and 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id)
);

create unique index if not exists businesses_owner_id_key on public.businesses(owner_id);
alter table public.businesses add column if not exists logo_url text;
alter table public.businesses add column if not exists payment_instructions text;
alter table public.businesses add column if not exists invoice_legal_notice text;
alter table public.businesses add column if not exists default_due_days integer not null default 30;
alter table public.businesses add column if not exists default_tax_rate numeric(5, 2) not null default 0;
alter table public.businesses add column if not exists currency text not null default 'XOF';
alter table public.businesses add column if not exists timezone text not null default 'Africa/Porto-Novo';
alter table public.businesses add column if not exists invoice_number_prefix text not null default 'FAC';
alter table public.businesses add column if not exists invoice_number_include_year boolean not null default true;
alter table public.businesses add column if not exists invoice_number_sequence_width integer not null default 5;
alter table public.businesses add column if not exists fiscal_regime text;
alter table public.businesses
  drop constraint if exists businesses_fiscal_regime_check,
  add constraint businesses_fiscal_regime_check
    check (fiscal_regime is null or fiscal_regime in ('TPS', 'REEL'));

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  tax_id text,
  client_type text not null default 'individual' check (client_type in ('individual', 'company')),
  notes text,
  status text not null default 'active' check (status in ('active', 'archived')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  price numeric(12, 2) not null default 0 check (price >= 0),
  purchase_price numeric(12, 2) not null default 0 check (purchase_price >= 0),
  unit text not null default 'unité',
  product_type text not null default 'service' check (product_type in ('product', 'service')),
  reference text,
  category text not null default 'other',
  sub_category text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products add column if not exists stock_quantity numeric(12, 2) not null default 0 check (stock_quantity >= 0);
alter table public.products add column if not exists low_stock_threshold numeric(12, 2) not null default 0 check (low_stock_threshold >= 0);
alter table public.products add column if not exists image_url text;

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity numeric(12, 2) not null,
  movement_type text not null check (movement_type in ('in', 'out', 'adjustment')),
  supplier_name text,
  note text,
  previous_stock numeric(12, 2),
  new_stock numeric(12, 2),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (movement_type = 'adjustment' or quantity <> 0)
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  invoice_number text not null,
  currency text not null default 'XOF' check (currency in ('XOF', 'EUR', 'USD')),
  invoice_type text not null default 'STANDARD' check (invoice_type in ('STANDARD', 'PROFORMA', 'DEPOSIT', 'CREDIT_NOTE', 'FINAL')),
  issue_date date not null default current_date,
  due_date date,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED')),
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  tax numeric(12, 2) not null default 0 check (tax >= 0),
  total numeric(12, 2) not null default 0 check (total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, invoice_number)
);

alter table public.invoices
  add column if not exists reg_fiscal_emetteur text,
  add column if not exists benin_document_type text,
  add column if not exists dgi_nim varchar(50),
  add column if not exists dgi_signature varchar(100),
  add column if not exists dgi_counters varchar(50),
  add column if not exists is_dgi_mock boolean not null default false,
  add column if not exists normalized_at timestamptz;

alter table public.invoices
  drop constraint if exists invoices_reg_fiscal_emetteur_check,
  add constraint invoices_reg_fiscal_emetteur_check
    check (reg_fiscal_emetteur is null or reg_fiscal_emetteur in ('TPS', 'REEL')),
  drop constraint if exists invoices_benin_document_type_check,
  add constraint invoices_benin_document_type_check
    check (benin_document_type is null or benin_document_type in ('proforma', 'recu_vente', 'bon_livraison', 'facture_interne'));

create or replace function public.snapshot_invoice_fiscal_regime()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select b.fiscal_regime
    into new.reg_fiscal_emetteur
    from public.businesses b
   where b.id = new.business_id;
  return new;
end;
$$;

drop trigger if exists invoices_snapshot_fiscal_regime on public.invoices;
create trigger invoices_snapshot_fiscal_regime
before insert on public.invoices
for each row execute function public.snapshot_invoice_fiscal_regime();

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  description text not null,
  quantity numeric(12, 2) not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  total numeric(12, 2) generated always as (quantity * unit_price) stored
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  payment_date date not null default current_date,
  method text not null default 'cash',
  reference text,
  created_at timestamptz not null default now()
);

create unique index if not exists invoices_id_business_id_uidx
  on public.invoices (id, business_id);

create unique index if not exists payments_id_business_invoice_uidx
  on public.payments (id, business_id, invoice_id);

create table if not exists public.momo_reconciliations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_id uuid not null,
  payment_id uuid not null,
  provider text not null check (provider in ('mtn', 'moov', 'wave')),
  transaction_id varchar(100),
  amount numeric(12, 2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'reconciled', 'failed', 'cancelled')),
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint momo_reconciliations_invoice_business_fk
    foreign key (invoice_id, business_id)
    references public.invoices(id, business_id) on delete cascade,
  constraint momo_reconciliations_payment_invoice_fk
    foreign key (payment_id, business_id, invoice_id)
    references public.payments(id, business_id, invoice_id) on delete cascade,
  constraint momo_reconciliations_payment_id_key unique (payment_id)
);

create unique index if not exists momo_reconciliations_transaction_id_uidx
  on public.momo_reconciliations (business_id, provider, transaction_id)
  where transaction_id is not null;

create index if not exists momo_reconciliations_business_created_idx
  on public.momo_reconciliations (business_id, created_at desc);

create table if not exists public.dgi_mock_ifu_registry (
  ifu char(13) primary key check (ifu ~ '^[0-9]{13}$'),
  raison_sociale varchar(255) not null,
  regime_fiscal varchar(50) not null,
  adresse varchar(255),
  telephone varchar(50),
  created_at timestamptz not null default now()
);

comment on table public.dgi_mock_ifu_registry is
  'Registre réservé aux données IFU synthétiques de démonstration; ne pas y importer de données DGI réelles.';

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  label text not null,
  amount numeric(12, 2) not null check (amount > 0),
  expense_date date not null default current_date,
  category text not null default 'other',
  notes text,
  supplier_name text,
  payment_method text not null default 'cash'
    check (payment_method in ('cash', 'mobile_money', 'bank_transfer', 'card', 'check', 'other')),
  receipt_path text,
  created_at timestamptz not null default now()
);

-- Bootstrap tables used by earlier functions, triggers, and policies below.
create table if not exists public.platform_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  result text not null default 'success' check (result in ('success', 'failure')),
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_integrations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  service_type text not null,
  environment text not null default 'production',
  status text not null default 'not_configured' check (status in ('connected', 'operational', 'not_configured', 'attention', 'unavailable')),
  last_checked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.platform_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  message text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  plan text not null check (plan in ('starter', 'pro')),
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'XOF',
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'cancelled')),
  provider text not null default 'paydunya',
  provider_token text unique,
  provider_url text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.invoice_reminders (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  reminder_date date not null default current_date,
  reminder_type text not null default 'overdue',
  created_at timestamptz not null default now()
);

create table if not exists public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table if not exists public.business_invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.businesses enable row level security;
alter table public.clients enable row level security;
alter table public.products enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.stock_movements enable row level security;
alter table public.momo_reconciliations enable row level security;
alter table public.dgi_mock_ifu_registry enable row level security;

drop policy if exists "owners manage their businesses" on public.businesses;

create policy "owners manage their businesses" on public.businesses
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "business owners manage clients" on public.clients;

create policy "business owners manage clients" on public.clients
  for all using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

drop policy if exists "business owners manage products" on public.products;

create policy "business owners manage products" on public.products
  for all using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

drop policy if exists "business owners manage invoices" on public.invoices;

create policy "business owners manage invoices" on public.invoices
  for all using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

drop policy if exists "business owners manage invoice items" on public.invoice_items;

create policy "business owners manage invoice items" on public.invoice_items
  for all using (exists (
    select 1 from public.invoices i
    join public.businesses b on b.id = i.business_id
    where i.id = invoice_id and b.owner_id = auth.uid()
  )) with check (exists (
    select 1 from public.invoices i
    join public.businesses b on b.id = i.business_id
    where i.id = invoice_id and b.owner_id = auth.uid()
  ));

drop policy if exists "business owners manage payments" on public.payments;

create policy "business owners manage payments" on public.payments
  for all using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

revoke all on public.momo_reconciliations from public, anon, authenticated;
grant select on public.momo_reconciliations to authenticated;
drop policy if exists "business members read mobile money reconciliations" on public.momo_reconciliations;
drop policy if exists "business members read mobile money reconciliations" on public.momo_reconciliations;
create policy "business members read mobile money reconciliations" on public.momo_reconciliations for select
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ));

revoke all on public.dgi_mock_ifu_registry from public, anon, authenticated;
grant select on public.dgi_mock_ifu_registry to authenticated;
drop policy if exists "authenticated users read mock IFU registry" on public.dgi_mock_ifu_registry;
drop policy if exists "authenticated users read mock IFU registry" on public.dgi_mock_ifu_registry;
create policy "authenticated users read mock IFU registry" on public.dgi_mock_ifu_registry for select
  to authenticated
  using (true);

revoke all on function public.snapshot_invoice_fiscal_regime() from public, anon, authenticated;

-- ============================================================================
-- Source: supabase/migrations/20261109014000_remove_business_member_default.sql
-- ============================================================================
-- CREATE OR REPLACE cannot remove an existing parameter default.
create or replace function public.is_business_member(
  p_business_id uuid,
  p_min_role text default 'member'
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = p_business_id and b.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.business_members m
    where m.business_id = p_business_id
      and m.user_id = auth.uid()
      and case p_min_role
        when 'viewer' then m.role in ('viewer', 'member', 'admin')
        when 'member' then m.role in ('member', 'admin')
        when 'admin' then m.role = 'admin'
        else false
      end
  );
$$;

revoke all on function public.is_business_member(uuid, text) from public, anon;
grant execute on function public.is_business_member(uuid, text) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20261109015000_allow_rls_membership_checks_anon.sql
-- ============================================================================
grant execute on function public.is_business_member(uuid, text) to anon;

-- ============================================================================
-- Source: supabase/migrations/20261109003000_deliverable_2_functions.sql
-- ============================================================================
alter table public.stock_movements
  add column if not exists idempotency_key uuid,
  add column if not exists request_fingerprint text;

create unique index if not exists stock_movements_business_idempotency_uidx
  on public.stock_movements (business_id, idempotency_key)
  where idempotency_key is not null;

drop function if exists public.apply_stock_movement(uuid, uuid, numeric, text, text, text, uuid);

create function public.apply_stock_movement(
  p_business_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_movement_type text,
  p_note text,
  p_supplier_name text,
  p_idempotency_key uuid
)
returns table (movement_id uuid, previous_stock numeric, new_stock numeric)
language plpgsql
security invoker
set search_path = public
as $$
declare
  product_row public.products%rowtype;
  movement_row public.stock_movements%rowtype;
  delta numeric;
  request_hash text;
  normalized_note text := nullif(trim(p_note), '');
  normalized_supplier text := case
    when p_movement_type = 'in' then nullif(trim(p_supplier_name), '')
    else null
  end;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;

  if p_product_id is null or p_quantity is null or p_quantity < 0
     or (p_movement_type in ('in', 'out') and p_quantity = 0) then
    raise exception 'La quantité doit être positive, sauf pour un ajustement à zéro.';
  end if;

  if p_movement_type not in ('in', 'out', 'adjustment') then
    raise exception 'Type de mouvement invalide.';
  end if;

  if p_idempotency_key is not null then
    request_hash := encode(digest(jsonb_build_object(
      'product_id', p_product_id,
      'quantity', p_quantity,
      'movement_type', p_movement_type,
      'note', normalized_note,
      'supplier_name', normalized_supplier
    )::text, 'sha256'), 'hex');

    perform pg_advisory_xact_lock(
      hashtextextended(p_business_id::text || ':' || p_idempotency_key::text, 0)
    );

    select *
      into movement_row
      from public.stock_movements sm
     where sm.business_id = p_business_id
       and sm.idempotency_key = p_idempotency_key;

    if found then
      if movement_row.request_fingerprint is distinct from request_hash then
        raise exception 'Cette clé de requête a déjà été utilisée pour un autre mouvement.';
      end if;
      movement_id := movement_row.id;
      previous_stock := movement_row.previous_stock;
      new_stock := movement_row.new_stock;
      return next;
      return;
    end if;
  end if;

  select *
    into product_row
    from public.products p
   where p.id = p_product_id
     and p.business_id = p_business_id
     and p.product_type = 'product'
   for update;

  if not found then
    raise exception 'Produit non autorisé ou non stockable.';
  end if;

  delta := case
    when p_movement_type = 'in' then p_quantity
    when p_movement_type = 'out' then -p_quantity
    else p_quantity - product_row.stock_quantity
  end;

  if product_row.stock_quantity + delta < 0 then
    raise exception 'Le stock ne peut pas être négatif.';
  end if;

  update public.products
     set stock_quantity = product_row.stock_quantity + delta,
         updated_at = now()
   where id = product_row.id;

  insert into public.stock_movements (
    business_id, product_id, quantity, movement_type, supplier_name, note,
    previous_stock, new_stock, created_by, idempotency_key, request_fingerprint
  )
  values (
    p_business_id, product_row.id, delta, p_movement_type, normalized_supplier,
    normalized_note, product_row.stock_quantity, product_row.stock_quantity + delta,
    auth.uid(), p_idempotency_key, request_hash
  )
  returning stock_movements.id, stock_movements.previous_stock, stock_movements.new_stock
       into movement_id, previous_stock, new_stock;

  return next;
end;
$$;

revoke all on function public.apply_stock_movement(uuid, uuid, numeric, text, text, text, uuid)
  from public, anon;
grant execute on function public.apply_stock_movement(uuid, uuid, numeric, text, text, text, uuid)
  to authenticated;

create or replace function public.save_benin_invoice_metadata(
  p_business_id uuid,
  p_invoice_id uuid,
  p_reg_fiscal_emetteur text,
  p_benin_document_type text,
  p_dgi_nim text,
  p_dgi_counters text,
  p_dgi_signature text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  invoice_row public.invoices%rowtype;
  nim_value text := nullif(btrim(p_dgi_nim), '');
  counters_value text := nullif(btrim(p_dgi_counters), '');
  signature_value text := nullif(btrim(p_dgi_signature), '');
begin
  if auth.uid() is null then
    raise exception 'Authentification requise.';
  end if;
  if not exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.owner_id = auth.uid()
  ) then
    raise exception 'Seul le propriétaire de l’entreprise peut modifier ces informations.';
  end if;
  if p_reg_fiscal_emetteur is not null and p_reg_fiscal_emetteur not in ('TPS', 'REEL') then
    raise exception 'Régime fiscal invalide.';
  end if;
  if p_benin_document_type is not null and p_benin_document_type not in ('proforma', 'recu_vente', 'bon_livraison', 'facture_interne') then
    raise exception 'Type de document invalide.';
  end if;
  if num_nonnulls(nim_value, counters_value, signature_value) not in (0, 3) then
    raise exception 'Le NIM, le compteur et la signature doivent être renseignés ensemble.';
  end if;
  if length(nim_value) > 50 or length(counters_value) > 50 or length(signature_value) > 100 then
    raise exception 'Une référence e-MECeF dépasse la longueur autorisée.';
  end if;

  select i.* into invoice_row
    from public.invoices i
   where i.id = p_invoice_id and i.business_id = p_business_id
   for update;
  if not found then raise exception 'Facture introuvable dans cette entreprise.'; end if;
  if invoice_row.status in ('DRAFT', 'CANCELLED') or invoice_row.invoice_type = 'PROFORMA' then
    raise exception 'Les références e-MECeF ne peuvent être liées qu’à un document émis et non proforma.';
  end if;
  if p_benin_document_type = 'proforma' and nim_value is not null then
    raise exception 'Une facture proforma ne peut pas recevoir de références e-MECeF dans ce module.';
  end if;

  update public.invoices
     set reg_fiscal_emetteur = p_reg_fiscal_emetteur,
         benin_document_type = p_benin_document_type,
         dgi_nim = nim_value,
         dgi_counters = counters_value,
         dgi_signature = signature_value,
         is_dgi_mock = false,
         normalized_at = null,
         updated_at = now()
   where id = p_invoice_id and business_id = p_business_id;

  return jsonb_build_object('success', true, 'is_dgi_mock', false, 'references_saved', nim_value is not null);
end;
$$;

revoke all on function public.save_benin_invoice_metadata(uuid, uuid, text, text, text, text, text) from public, anon;
grant execute on function public.save_benin_invoice_metadata(uuid, uuid, text, text, text, text, text) to authenticated;

create or replace function public.simulate_dgi_normalisation(p_invoice_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  invoice_row public.invoices%rowtype;
  mock_nim text;
  mock_signature text;
  mock_counters text := 'MOCK-COUNTER-NOT-OFFICIAL';
  normalized_time timestamptz;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Authentification requise.');
  end if;
  select i.* into invoice_row
    from public.invoices i
    join public.businesses b on b.id = i.business_id
   where i.id = p_invoice_id and b.owner_id = auth.uid()
   for update of i;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Facture introuvable ou accès non autorisé.');
  end if;
  if invoice_row.status in ('DRAFT', 'CANCELLED')
     or invoice_row.invoice_type = 'PROFORMA'
     or invoice_row.benin_document_type = 'proforma' then
    return jsonb_build_object('success', false, 'error', 'Seule une facture émise et non proforma/annulée peut être simulée.');
  end if;
  if invoice_row.is_dgi_mock then
    return jsonb_build_object(
      'success', true, 'is_mock', true, 'status', 'simulation',
      'nim', invoice_row.dgi_nim, 'signature', invoice_row.dgi_signature,
      'counters', invoice_row.dgi_counters, 'normalized_at', invoice_row.normalized_at
    );
  end if;
  if invoice_row.dgi_nim is not null or invoice_row.dgi_signature is not null or invoice_row.dgi_counters is not null then
    return jsonb_build_object('success', false, 'error', 'La facture contient déjà des métadonnées non simulées ; elles ne seront pas remplacées.');
  end if;

  mock_nim := 'MOCK-NIM-NOT-OFFICIAL-' || left(replace(p_invoice_id::text, '-', ''), 8);
  mock_signature := 'MOCK-SIGNATURE-NOT-VALID-' || left(replace(p_invoice_id::text, '-', ''), 8);
  normalized_time := now();
  update public.invoices
     set dgi_nim = mock_nim, dgi_signature = mock_signature,
         dgi_counters = mock_counters, is_dgi_mock = true,
         normalized_at = normalized_time
   where id = p_invoice_id;
  return jsonb_build_object(
    'success', true, 'is_mock', true, 'status', 'simulation',
    'nim', mock_nim, 'signature', mock_signature, 'counters', mock_counters,
    'normalized_at', normalized_time,
    'notice', 'SIMULATION FICTIVE - aucune validation DGI/e-MECeF.'
  );
end;
$$;

revoke all on function public.simulate_dgi_normalisation(uuid) from public, anon;
grant execute on function public.simulate_dgi_normalisation(uuid) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20261109012000_enforce_fiscal_regime_invoice_tax.sql
-- ============================================================================
create or replace function public.snapshot_invoice_fiscal_regime()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  taxable_amount numeric;
begin
  select b.fiscal_regime
    into new.reg_fiscal_emetteur
    from public.businesses b
   where b.id = new.business_id;
  if new.reg_fiscal_emetteur in ('TPS', 'REEL') then
    taxable_amount := greatest(
      coalesce(new.subtotal, 0) - least(greatest(coalesce(new.discount, 0), 0), coalesce(new.subtotal, 0)),
      0
    );
    new.tax := case when new.reg_fiscal_emetteur = 'TPS' then 0 else taxable_amount * 0.18 end;
    new.total := taxable_amount + new.tax;
  end if;
  return new;
end;
$$;

-- Latest migration: restrict the temporary mock IFU registry to business owners.
drop policy if exists "authenticated users read mock IFU registry"
  on public.dgi_mock_ifu_registry;
drop policy if exists "business owners read mock IFU registry"
  on public.dgi_mock_ifu_registry;
drop policy if exists "business owners read mock IFU registry" on public.dgi_mock_ifu_registry;
create policy "business owners read mock IFU registry" on public.dgi_mock_ifu_registry
  for select
  to authenticated
  using (exists (
    select 1
    from public.businesses b
    where b.owner_id = auth.uid()
  ));

drop policy if exists "business owners manage expenses" on public.expenses;

create policy "business owners manage expenses" on public.expenses
  for all using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

drop policy if exists "business owners manage stock movements" on public.stock_movements;

create policy "business owners manage stock movements" on public.stock_movements
  for all using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

-- ============================================================================
-- Source: supabase/migrations/20260906100700_recurring_invoices.sql
-- ============================================================================
create table if not exists public.recurring_invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  frequency text not null check (frequency in ('weekly', 'monthly', 'quarterly', 'yearly')),
  next_issue_date date not null,
  due_days integer not null default 30 check (due_days between 0 and 365),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.recurring_invoices enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'recurring_invoices'
      and policyname = 'business owners manage recurring invoices'
  ) then
    drop policy if exists "business owners manage recurring invoices" on public.recurring_invoices;
    create policy "business owners manage recurring invoices" on public.recurring_invoices
      for all using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
      with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));
  end if;
end
$$;

-- ============================================================================
-- Source: supabase/migrations/20260906100600_recurring_invoice_runs.sql
-- ============================================================================
create table if not exists public.recurring_invoice_runs (
  id uuid primary key default gen_random_uuid(),
  recurring_invoice_id uuid references public.recurring_invoices(id) on delete set null,
  business_id uuid not null references public.businesses(id) on delete cascade,
  issue_date date not null,
  status text not null check (status in ('issued', 'skipped_stock')),
  invoice_id uuid references public.invoices(id) on delete set null,
  message text,
  created_at timestamptz not null default now()
);

create index if not exists recurring_invoice_runs_business_created_idx
  on public.recurring_invoice_runs (business_id, created_at desc);

alter table public.recurring_invoice_runs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'recurring_invoice_runs'
      and policyname = 'business owners read recurring invoice runs'
  ) then
    drop policy if exists "business owners read recurring invoice runs" on public.recurring_invoice_runs;
    create policy "business owners read recurring invoice runs" on public.recurring_invoice_runs
      for select using (exists (
        select 1 from public.businesses b
        where b.id = business_id and b.owner_id = auth.uid()
      ));
  end if;
end
$$;

-- ============================================================================
-- Source: supabase/migrations/20260906100500_recurring_invoice_automation.sql
-- ============================================================================
alter table public.recurring_invoices
  add column if not exists last_issued_date date;

create or replace function public.process_due_recurring_invoices()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  recurring record;
  invoice_id uuid;
  invoice_number text;
  processed integer := 0;
  next_date date;
begin
  perform pg_advisory_xact_lock(hashtext('facturefacile:recurring-invoices'));

  for recurring in
    select r.*, p.name as product_name, p.price as product_price, p.product_type, p.stock_quantity
    from public.recurring_invoices r
    join public.products p on p.id = r.product_id and p.business_id = r.business_id
    where r.active = true and r.next_issue_date <= current_date
    order by r.next_issue_date, r.created_at
  loop
    if recurring.product_type = 'product' and recurring.stock_quantity < 1 then
      insert into public.recurring_invoice_runs (
        recurring_invoice_id, business_id, issue_date, status, message
      ) values (
        recurring.id, recurring.business_id, recurring.next_issue_date,
        'skipped_stock', 'Stock insuffisant pour générer la facture.'
      );
      continue;
    end if;

    invoice_number := public.next_invoice_number(recurring.business_id, extract(year from recurring.next_issue_date)::integer);
    insert into public.invoices (
      business_id, client_id, invoice_number, issue_date, due_date,
      status, subtotal, total
    ) values (
      recurring.business_id, recurring.client_id, invoice_number, recurring.next_issue_date,
      recurring.next_issue_date + recurring.due_days, 'SENT',
      recurring.product_price, recurring.product_price
    ) returning id into invoice_id;

    insert into public.invoice_items (
      invoice_id, product_id, description, quantity, unit_price
    ) values (
      invoice_id, recurring.product_id, recurring.product_name, 1, recurring.product_price
    );

    if recurring.product_type = 'product' then
      update public.products
      set stock_quantity = stock_quantity - 1, updated_at = now()
      where id = recurring.product_id and business_id = recurring.business_id and stock_quantity >= 1;

      if not found then
        raise exception 'Stock insuffisant pour la récurrence %', recurring.id;
      end if;

      insert into public.stock_movements (
        business_id, product_id, quantity, movement_type, note
      ) values (
        recurring.business_id, recurring.product_id, -1, 'out',
        format('Vente récurrente liée à %s', invoice_number)
      );
    end if;

    next_date := case recurring.frequency
      when 'weekly' then recurring.next_issue_date + 7
      when 'monthly' then (recurring.next_issue_date + interval '1 month')::date
      when 'quarterly' then (recurring.next_issue_date + interval '3 months')::date
      when 'yearly' then (recurring.next_issue_date + interval '1 year')::date
    end;

    update public.recurring_invoices
    set next_issue_date = next_date, last_issued_date = recurring.next_issue_date
    where id = recurring.id;

    insert into public.recurring_invoice_runs (
      recurring_invoice_id, business_id, issue_date, status, invoice_id, message
    ) values (
      recurring.id, recurring.business_id, recurring.next_issue_date,
      'issued', invoice_id, 'Facture générée automatiquement.'
    );

    processed := processed + 1;
  end loop;

  return processed;
end;
$$;

revoke all on function public.process_due_recurring_invoices() from public, anon, authenticated;
grant execute on function public.process_due_recurring_invoices() to service_role;

-- ============================================================================
-- Source: supabase/migrations/20260906_audit_logs.sql
-- ============================================================================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  table_name text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  record_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_business_created_idx
  on public.audit_logs (business_id, created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists "business owners read audit logs" on public.audit_logs;
drop policy if exists "business owners read audit logs" on public.audit_logs;
create policy "business owners read audit logs" on public.audit_logs
  for select using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ));

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  business uuid;
  record_uuid uuid;
begin
  business := coalesce(new.business_id, old.business_id);
  record_uuid := coalesce(new.id, old.id);
  insert into public.audit_logs (business_id, actor_id, table_name, action, record_id)
  values (business, auth.uid(), tg_table_name, tg_op, record_uuid);
  return coalesce(new, old);
end;
$$;

revoke all on function public.write_audit_log() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['clients', 'products', 'invoices', 'payments', 'expenses', 'recurring_invoices', 'stock_movements']
  loop
    execute format('drop trigger if exists audit_%s on public.%I', table_name, table_name);
    execute format('create trigger audit_%s after insert or update or delete on public.%I for each row execute function public.write_audit_log()', table_name, table_name);
  end loop;
end
$$;

-- ============================================================================
-- Source: supabase/migrations/20260906101100_team_members.sql
-- ============================================================================
create table if not exists public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table if not exists public.business_invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.business_members enable row level security;
alter table public.business_invitations enable row level security;

drop policy if exists "members read their memberships" on public.business_members;
drop policy if exists "members read their memberships" on public.business_members;
create policy "members read their memberships" on public.business_members
  for select using (user_id = auth.uid() or exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
  ));

drop policy if exists "owners manage memberships" on public.business_members;
drop policy if exists "owners manage memberships" on public.business_members;
create policy "owners manage memberships" on public.business_members
  for all using (exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
  )) with check (exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
  ));

drop policy if exists "owners manage invitations" on public.business_invitations;
drop policy if exists "owners manage invitations" on public.business_invitations;
create policy "owners manage invitations" on public.business_invitations
  for all using (exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
  )) with check (exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
  ));

-- ============================================================================
-- Source: supabase/migrations/20260906100800_team_access_policies.sql
-- ============================================================================
create or replace function public.is_business_member(
  p_business_id uuid,
  p_min_role text
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = p_business_id and b.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.business_members m
    where m.business_id = p_business_id
      and m.user_id = auth.uid()
      and case p_min_role
        when 'viewer' then m.role in ('viewer', 'member', 'admin')
        when 'member' then m.role in ('member', 'admin')
        when 'admin' then m.role = 'admin'
        else false
      end
  );
$$;

revoke all on function public.is_business_member(uuid, text) from public, anon;
grant execute on function public.is_business_member(uuid, text) to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['clients', 'products', 'invoices', 'payments', 'expenses', 'recurring_invoices', 'stock_movements']
  loop
    execute format('drop policy if exists "team members read %s" on public.%I', table_name, table_name);
    execute format('create policy "team members read %s" on public.%I for select using (public.is_business_member(business_id, ''viewer''))', table_name, table_name);
    execute format('drop policy if exists "team members write %s" on public.%I', table_name, table_name);
    execute format('create policy "team members write %s" on public.%I for all using (public.is_business_member(business_id, ''member'')) with check (public.is_business_member(business_id, ''member''))', table_name, table_name);
  end loop;
end
$$;

drop policy if exists "team members read invoice items" on public.invoice_items;
drop policy if exists "team members read invoice items" on public.invoice_items;
create policy "team members read invoice items" on public.invoice_items
  for select using (exists (
    select 1 from public.invoices i
    where i.id = invoice_id and public.is_business_member(i.business_id, 'viewer')
  ));

drop policy if exists "team members write invoice items" on public.invoice_items;
drop policy if exists "team members write invoice items" on public.invoice_items;
create policy "team members write invoice items" on public.invoice_items
  for all using (exists (
    select 1 from public.invoices i
    where i.id = invoice_id and public.is_business_member(i.business_id, 'member')
  )) with check (exists (
    select 1 from public.invoices i
    where i.id = invoice_id and public.is_business_member(i.business_id, 'member')
  ));

drop policy if exists "team members read audit logs" on public.audit_logs;
drop policy if exists "team members read audit logs" on public.audit_logs;
create policy "team members read audit logs" on public.audit_logs
  for select using (public.is_business_member(business_id, 'viewer'));

-- ============================================================================
-- Source: supabase/migrations/20260906100900_team_invitations_acceptance.sql
-- ============================================================================
create or replace function public.accept_business_invitation(p_token text)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  invitation public.business_invitations;
  member_id uuid;
begin
  select *
  into invitation
  from public.business_invitations
  where token = p_token
    and accepted_at is null
    and expires_at > now()
    and lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
  for update;

  if not found then
    raise exception 'Invitation invalide, expirée ou non liée à votre email.';
  end if;

  insert into public.business_members (business_id, user_id, role)
  values (invitation.business_id, auth.uid(), invitation.role)
  on conflict (business_id, user_id)
  do update set role = excluded.role
  returning id into member_id;

  update public.business_invitations
  set accepted_at = now()
  where id = invitation.id;

  return member_id;
end;
$$;

grant execute on function public.accept_business_invitation(text) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260906101000_team_management.sql
-- ============================================================================
create or replace function public.cancel_business_invitation(p_invitation_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.business_invitations invitation
  where invitation.id = p_invitation_id
    and exists (
      select 1 from public.businesses business
      where business.id = invitation.business_id
        and business.owner_id = auth.uid()
    );
end;
$$;

create or replace function public.remove_business_member(p_member_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.business_members member
  where member.id = p_member_id
    and exists (
      select 1 from public.businesses business
      where business.id = member.business_id
        and business.owner_id = auth.uid()
    );
end;
$$;

grant execute on function public.cancel_business_invitation(uuid) to authenticated;
grant execute on function public.remove_business_member(uuid) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260906100100_business_preferences.sql
-- ============================================================================
alter table public.businesses
  add column if not exists default_due_days integer not null default 30 check (default_due_days between 0 and 365);

alter table public.businesses
  add column if not exists default_tax_rate numeric(5, 2) not null default 0 check (default_tax_rate between 0 and 100);

alter table public.businesses
  add column if not exists currency text not null default 'XOF' check (currency in ('XOF', 'EUR', 'USD'));

-- ============================================================================
-- Source: supabase/migrations/20260906100200_business_subscriptions.sql
-- ============================================================================
create table if not exists public.business_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'starter', 'pro')),
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'cancelled')),
  monthly_invoice_limit integer not null default 20 check (monthly_invoice_limit > 0),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.business_subscriptions enable row level security;

drop policy if exists "business owners read subscriptions" on public.business_subscriptions;
drop policy if exists "business owners read subscriptions" on public.business_subscriptions;
create policy "business owners read subscriptions" on public.business_subscriptions
  for select using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ));

-- ============================================================================
-- Source: supabase/migrations/20260906100300_invoice_numbering.sql
-- ============================================================================
create table if not exists public.invoice_counters (
  business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_year integer not null check (invoice_year between 2000 and 9999),
  last_number integer not null default 0 check (last_number >= 0),
  primary key (business_id, invoice_year)
);

alter table public.invoice_counters enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'invoice_counters'
      and policyname = 'business owners manage invoice counters'
  ) then
    drop policy if exists "business owners manage invoice counters" on public.invoice_counters;
    create policy "business owners manage invoice counters" on public.invoice_counters
      for all using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
      with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));
  end if;
end
$$;

create or replace function public.next_invoice_number(p_business_id uuid, p_invoice_year integer)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_number integer;
begin
  insert into public.invoice_counters (business_id, invoice_year, last_number)
  values (p_business_id, p_invoice_year, 1)
  on conflict (business_id, invoice_year)
  do update set last_number = public.invoice_counters.last_number + 1
  returning last_number into next_number;

  return format('FAC-%s-%s', p_invoice_year, lpad(next_number::text, 5, '0'));
end;
$$;

-- ============================================================================
-- Source: supabase/migrations/20260906100400_invoice_transaction.sql
-- ============================================================================
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
security invoker
set search_path = public
as $$
declare
  line jsonb;
  product_row record;
  invoice_id uuid;
  invoice_number text;
  subtotal numeric := 0;
  discount_amount numeric;
  tax_amount numeric;
  total_amount numeric;
  quantity numeric;
begin
  if not exists (
    select 1 from public.businesses
    where id = p_business_id and owner_id = auth.uid()
  ) then
    raise exception 'Entreprise non autorisée.';
  end if;

  if not exists (
    select 1 from public.clients
    where id = p_client_id and business_id = p_business_id
  ) then
    raise exception 'Client non autorisé.';
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'La facture doit contenir au moins une ligne.';
  end if;

  for line in select value from jsonb_array_elements(p_lines)
  loop
    quantity := (line->>'quantity')::numeric;
    if quantity <= 0 then
      raise exception 'La quantité doit être positive.';
    end if;

    select id, name, price, product_type, stock_quantity
    into product_row
    from public.products
    where id = (line->>'product_id')::uuid
      and business_id = p_business_id
    for update;

    if not found then
      raise exception 'Produit non autorisé.';
    end if;
    if product_row.product_type = 'product' and product_row.stock_quantity < quantity then
      raise exception 'Stock insuffisant pour %.', product_row.name;
    end if;
    subtotal := subtotal + product_row.price * quantity;
  end loop;

  discount_amount := least(greatest(coalesce(p_discount, 0), 0), subtotal);
  tax_amount := (subtotal - discount_amount) * greatest(coalesce(p_tax_rate, 0), 0) / 100;
  total_amount := subtotal - discount_amount + tax_amount;
  invoice_number := public.next_invoice_number(p_business_id, extract(year from p_issue_date)::integer);

  insert into public.invoices (
    business_id, client_id, invoice_number, issue_date, due_date,
    subtotal, discount, tax, total, status
  ) values (
    p_business_id, p_client_id, invoice_number, p_issue_date, p_due_date,
    subtotal, discount_amount, tax_amount, total_amount, 'DRAFT'
  ) returning id into invoice_id;

  for line in select value from jsonb_array_elements(p_lines)
  loop
    quantity := (line->>'quantity')::numeric;
    select id, name, price, product_type
    into product_row
    from public.products
    where id = (line->>'product_id')::uuid and business_id = p_business_id;

    insert into public.invoice_items (invoice_id, product_id, description, quantity, unit_price)
    values (invoice_id, product_row.id, product_row.name, quantity, product_row.price);

    if product_row.product_type = 'product' then
      update public.products
      set stock_quantity = stock_quantity - quantity, updated_at = now()
      where id = product_row.id and business_id = p_business_id;
      insert into public.stock_movements (business_id, product_id, quantity, movement_type, note)
      values (p_business_id, product_row.id, -quantity, 'out', format('Vente liée à %s', invoice_number));
    end if;
  end loop;

  return invoice_number;
end;
$$;

revoke all on function public.create_invoice_with_lines(uuid, uuid, date, date, numeric, numeric, jsonb) from public, anon;
grant execute on function public.create_invoice_with_lines(uuid, uuid, date, date, numeric, numeric, jsonb) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260906120000_atomic_invoice_payments.sql
-- ============================================================================
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

-- ============================================================================
-- Source: supabase/migrations/20260906130000_business_logos.sql
-- ============================================================================
alter table public.businesses add column if not exists logo_url text;

insert into storage.buckets (id, name, public)
values ('business-logos', 'business-logos', true)
on conflict (id) do update set public = true;

drop policy if exists "business logos are publicly readable" on storage.objects;
drop policy if exists "business logos are publicly readable" on storage.objects;
create policy "business logos are publicly readable" on storage.objects for select
  using (bucket_id = 'business-logos');

drop policy if exists "business owners upload logos" on storage.objects;
drop policy if exists "business owners upload logos" on storage.objects;
create policy "business owners upload logos" on storage.objects for insert
  with check (
    bucket_id = 'business-logos'
    and (storage.foldername(name))[1] in (
      select b.id::text from public.businesses b where b.owner_id = auth.uid()
    )
  );

drop policy if exists "business owners update logos" on storage.objects;
drop policy if exists "business owners update logos" on storage.objects;
create policy "business owners update logos" on storage.objects for update
  using (
    bucket_id = 'business-logos'
    and (storage.foldername(name))[1] in (
      select b.id::text from public.businesses b where b.owner_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'business-logos'
    and (storage.foldername(name))[1] in (
      select b.id::text from public.businesses b where b.owner_id = auth.uid()
    )
  );

drop policy if exists "business owners delete logos" on storage.objects;
drop policy if exists "business owners delete logos" on storage.objects;
create policy "business owners delete logos" on storage.objects for delete
  using (
    bucket_id = 'business-logos'
    and (storage.foldername(name))[1] in (
      select b.id::text from public.businesses b where b.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- Source: supabase/migrations/20260906140000_subscription_feature_guards.sql
-- ============================================================================
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

-- ============================================================================
-- Source: supabase/migrations/20260906150000_invoice_detail_update.sql
-- ============================================================================
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

-- ============================================================================
-- Source: supabase/migrations/20260906160000_product_advanced_fields.sql
-- ============================================================================
alter table public.products
  add column if not exists unit text not null default 'unité',
  add column if not exists purchase_price numeric(12, 2) not null default 0 check (purchase_price >= 0);

-- ============================================================================
-- Source: supabase/migrations/20260906170000_business_subscription_plan.sql
-- ============================================================================
do $$
begin
  alter table public.business_subscriptions drop constraint if exists business_subscriptions_plan_check;
  alter table public.business_subscriptions add constraint business_subscriptions_plan_check check (plan in ('free', 'starter', 'pro', 'business'));
exception when undefined_table then null;
end $$;

-- ============================================================================
-- Source: supabase/migrations/20260906180000_invoice_document_types.sql
-- ============================================================================
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

-- ============================================================================
-- Source: supabase/migrations/20260906190000_subscription_member_limits.sql
-- ============================================================================
create or replace function public.enforce_subscription_member_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_members integer;
  member_limit integer;
begin
  select count(*)::integer into current_members
  from public.business_members
  where business_id = new.business_id;

  select case plan
    when 'free' then 1
    when 'starter' then 1
    when 'pro' then 5
    when 'business' then 25
    else 1
  end into member_limit
  from public.business_subscriptions
  where business_id = new.business_id
    and status in ('active', 'trialing')
    and (expires_at is null or expires_at > now());

  if coalesce(member_limit, 1) <= current_members
     and not exists (
       select 1 from public.business_members
       where business_id = new.business_id and user_id = new.user_id
     ) then
    raise exception 'La limite de % utilisateur(s) de votre abonnement est atteinte.', member_limit;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_subscription_member_limit on public.business_members;
create trigger enforce_subscription_member_limit
before insert on public.business_members
for each row execute function public.enforce_subscription_member_limit();

revoke all on function public.enforce_subscription_member_limit() from public, anon;

-- ============================================================================
-- Source: supabase/migrations/20260906200000_expired_subscription_guards.sql
-- ============================================================================
create or replace function public.enforce_subscription_member_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_members integer;
  member_limit integer;
begin
  select count(*)::integer into current_members
  from public.business_members
  where business_id = new.business_id;

  select case plan
    when 'free' then 1
    when 'starter' then 1
    when 'pro' then 5
    when 'business' then 25
    else 1
  end into member_limit
  from public.business_subscriptions
  where business_id = new.business_id
    and status in ('active', 'trialing')
    and (expires_at is null or expires_at > now());

  if coalesce(member_limit, 1) <= current_members
     and not exists (
       select 1 from public.business_members
       where business_id = new.business_id and user_id = new.user_id
     ) then
    raise exception 'La limite de % utilisateur(s) de votre abonnement est atteinte.', member_limit;
  end if;
  return new;
end;
$$;

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
      raise exception 'Les types de facture avancés nécessitent un abonnement actif.';
    end if;
  end if;

  invoice_number := public.create_invoice_with_lines(
    p_business_id, p_client_id, p_issue_date, p_due_date,
    p_discount, p_tax_rate, p_lines
  );
  update public.invoices as target_invoice
  set invoice_type = p_invoice_type, updated_at = now()
  where target_invoice.business_id = p_business_id
    and target_invoice.invoice_number = invoice_number;
  return invoice_number;
end;
$$;

revoke all on function public.create_invoice_with_lines(uuid, uuid, date, date, numeric, numeric, text, jsonb) from public, anon;
grant execute on function public.create_invoice_with_lines(uuid, uuid, date, date, numeric, numeric, text, jsonb) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260906210000_initialize_missing_subscriptions.sql
-- ============================================================================
insert into public.business_subscriptions (business_id, plan, status, monthly_invoice_limit)
select b.id, 'free', 'active', 20
from public.businesses b
where not exists (
  select 1
  from public.business_subscriptions s
  where s.business_id = b.id
);

create or replace function public.initialize_business_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.business_subscriptions (business_id, plan, status, monthly_invoice_limit)
  values (new.id, 'free', 'active', 20)
  on conflict (business_id) do nothing;
  return new;
end;
$$;

-- ============================================================================
-- Source: supabase/migrations/20260906220000_invoice_subscription_bootstrap.sql
-- ============================================================================
do $$
begin
  if to_regprocedure('public.create_invoice_with_lines_legacy(uuid,uuid,date,date,numeric,numeric,jsonb)') is null then
    alter function public.create_invoice_with_lines(uuid, uuid, date, date, numeric, numeric, jsonb)
      rename to create_invoice_with_lines_legacy;
  end if;
end;
$$;

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
    p_business_id,
    p_client_id,
    p_issue_date,
    p_due_date,
    p_discount,
    p_tax_rate,
    p_lines
  );
end;
$$;

revoke all on function public.create_invoice_with_lines(uuid, uuid, date, date, numeric, numeric, jsonb) from public, anon;
grant execute on function public.create_invoice_with_lines(uuid, uuid, date, date, numeric, numeric, jsonb) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260906230000_invoice_subscription_bootstrap_security.sql
-- ============================================================================
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

-- ============================================================================
-- Source: supabase/migrations/20260906240000_fix_invoice_type_wrapper.sql
-- ============================================================================
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
  created_invoice_number text;
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
      raise exception 'Les types de facture avancés nécessitent un abonnement actif.';
    end if;
  end if;

  created_invoice_number := public.create_invoice_with_lines(
    p_business_id, p_client_id, p_issue_date, p_due_date,
    p_discount, p_tax_rate, p_lines
  );
  update public.invoices as target_invoice
  set invoice_type = p_invoice_type, updated_at = now()
  where target_invoice.business_id = p_business_id
    and target_invoice.invoice_number = created_invoice_number;
  return created_invoice_number;
end;
$$;

-- ============================================================================
-- Source: supabase/migrations/20260907090000_allow_draft_invoice_payments.sql
-- ============================================================================
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
  if invoice_row.status in ('CANCELLED', 'PAID') then
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

-- ============================================================================
-- Source: supabase/migrations/20260907190000_platform_admin_space.sql
-- ============================================================================
-- Platform administrators are deliberately kept separate from business
-- memberships.  Existing rows remain administrators when the role column is
-- added, preserving the original platform_admins contract.
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins
  add column if not exists role text not null default 'admin';

alter table public.platform_admins
  drop constraint if exists platform_admins_role_check;

alter table public.platform_admins
  add constraint platform_admins_role_check
  check (role in ('super_admin', 'admin', 'support', 'finance', 'analyst'));

alter table public.platform_admins enable row level security;

create or replace function public.get_platform_admin_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.platform_admins where user_id = auth.uid()
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;

-- This is the only authorization primitive used by the read-only admin RPCs.
-- It never trusts a role supplied by the client.
create or replace function public.has_platform_admin_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins
    where user_id = auth.uid()
      and (
        role = 'super_admin'
        or role = 'admin'
        or (role = 'support' and p_permission in ('overview', 'users', 'businesses', 'subscriptions'))
        or (role = 'finance' and p_permission in ('overview', 'subscriptions', 'subscription_payments'))
        or (role = 'analyst' and p_permission in ('overview', 'users', 'businesses', 'subscriptions', 'subscription_payments'))
      )
  )
$$;

revoke all on function public.is_platform_admin() from public, anon;
revoke all on function public.get_platform_admin_role() from public, anon;
revoke all on function public.has_platform_admin_permission(text) from public, anon;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.get_platform_admin_role() to authenticated;
grant execute on function public.has_platform_admin_permission(text) to authenticated;

create or replace function public.get_platform_admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('overview') then
    raise exception 'Accès administrateur requis.';
  end if;

  return jsonb_build_object(
    'business_count', (select count(*) from public.businesses),
    'member_count', (select count(distinct user_id) from public.business_members),
    'invoice_count', (select count(*) from public.invoices),
    'revenue', coalesce((select sum(amount) from public.payments), 0),
    'subscription_revenue', coalesce((select sum(amount) from public.subscription_payments where status = 'completed'), 0),
    'active_subscriptions', (select count(*) from public.business_subscriptions where status in ('active', 'trialing')),
    'pending_payments', (select count(*) from public.subscription_payments where status = 'pending'),
    'recent_businesses', coalesce((
      select jsonb_agg(row_to_json(recent))
      from (
        select b.id, b.name, b.created_at,
          coalesce(bs.plan, 'free') as plan,
          coalesce(bs.status, 'active') as subscription_status
        from public.businesses b
        left join public.business_subscriptions bs on bs.business_id = b.id
        order by b.created_at desc
        limit 10
      ) recent
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.list_platform_admin_users(p_limit integer default 50, p_offset integer default 0)
returns table (user_id uuid, email text, created_at timestamptz, platform_role text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('users') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select u.id, u.email, u.created_at, pa.role
    from auth.users u
    left join public.platform_admins pa on pa.user_id = u.id
    order by u.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.list_platform_admin_businesses(p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, name text, owner_id uuid, owner_email text, created_at timestamptz, plan text, subscription_status text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('businesses') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select b.id, b.name, b.owner_id, u.email, b.created_at,
      coalesce(bs.plan, 'free'), coalesce(bs.status, 'active')
    from public.businesses b
    left join auth.users u on u.id = b.owner_id
    left join public.business_subscriptions bs on bs.business_id = b.id
    order by b.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.list_platform_admin_subscriptions(p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, business_id uuid, business_name text, plan text, status text, monthly_invoice_limit integer, expires_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('subscriptions') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select s.id, s.business_id, b.name, s.plan, s.status, s.monthly_invoice_limit, s.expires_at, s.created_at
    from public.business_subscriptions s join public.businesses b on b.id = s.business_id
    order by s.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

drop function if exists public.list_platform_subscription_payments(integer, integer);
create or replace function public.list_platform_subscription_payments(p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, business_id uuid, business_name text, plan text, amount numeric, currency text, status text, provider text, created_at timestamptz, completed_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('subscription_payments') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select p.id, p.business_id, b.name, p.plan, p.amount, p.currency, p.status, p.provider, p.created_at, p.completed_at
    from public.subscription_payments p join public.businesses b on b.id = p.business_id
    order by p.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

revoke all on function public.get_platform_admin_overview() from public, anon;
revoke all on function public.list_platform_admin_users(integer, integer) from public, anon;
revoke all on function public.list_platform_admin_businesses(integer, integer) from public, anon;
revoke all on function public.list_platform_admin_subscriptions(integer, integer) from public, anon;
revoke all on function public.list_platform_subscription_payments(integer, integer) from public, anon;
grant execute on function public.get_platform_admin_overview() to authenticated;
grant execute on function public.list_platform_admin_users(integer, integer) to authenticated;
grant execute on function public.list_platform_admin_businesses(integer, integer) to authenticated;
grant execute on function public.list_platform_admin_subscriptions(integer, integer) to authenticated;
grant execute on function public.list_platform_subscription_payments(integer, integer) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260907200000_platform_admin_roles.sql
-- ============================================================================
drop function if exists public.list_platform_subscription_payments(integer, integer);
alter table public.platform_admins
  add column if not exists role text not null default 'admin';

alter table public.platform_admins
  drop constraint if exists platform_admins_role_check;

alter table public.platform_admins
  add constraint platform_admins_role_check
  check (role in ('super_admin', 'admin', 'support', 'finance', 'analyst'));

create or replace function public.get_platform_admin_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.platform_admins where user_id = auth.uid()
$$;

create or replace function public.has_platform_admin_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins
    where user_id = auth.uid()
      and (
        role in ('super_admin', 'admin')
        or (role = 'support' and p_permission in ('overview', 'users', 'businesses', 'subscriptions'))
        or (role = 'finance' and p_permission in ('overview', 'subscriptions', 'subscription_payments'))
        or (role = 'analyst' and p_permission in ('overview', 'users', 'businesses', 'subscriptions', 'subscription_payments'))
      )
  )
$$;

revoke all on function public.get_platform_admin_role() from public, anon;
revoke all on function public.has_platform_admin_permission(text) from public, anon;
grant execute on function public.get_platform_admin_role() to authenticated;
grant execute on function public.has_platform_admin_permission(text) to authenticated;

create or replace function public.list_platform_admin_users(p_limit integer default 50, p_offset integer default 0)
returns table (user_id uuid, email text, created_at timestamptz, platform_role text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('users') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select u.id, u.email, u.created_at, pa.role
    from auth.users u
    left join public.platform_admins pa on pa.user_id = u.id
    order by u.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.list_platform_admin_businesses(p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, name text, owner_id uuid, owner_email text, created_at timestamptz, plan text, subscription_status text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('businesses') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select b.id, b.name, b.owner_id, u.email, b.created_at,
      coalesce(bs.plan, 'free'), coalesce(bs.status, 'active')
    from public.businesses b
    left join auth.users u on u.id = b.owner_id
    left join public.business_subscriptions bs on bs.business_id = b.id
    order by b.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.list_platform_admin_subscriptions(p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, business_id uuid, business_name text, plan text, status text, monthly_invoice_limit integer, expires_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('subscriptions') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select s.id, s.business_id, b.name, s.plan, s.status, s.monthly_invoice_limit, s.expires_at, s.created_at
    from public.business_subscriptions s join public.businesses b on b.id = s.business_id
    order by s.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

drop function if exists public.list_platform_subscription_payments(integer, integer);
create or replace function public.list_platform_subscription_payments(p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, business_id uuid, business_name text, plan text, amount numeric, currency text, status text, provider text, created_at timestamptz, completed_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('subscription_payments') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select p.id, p.business_id, b.name, p.plan, p.amount, p.currency, p.status, p.provider, p.created_at, p.completed_at
    from public.subscription_payments p join public.businesses b on b.id = p.business_id
    order by p.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

revoke all on function public.list_platform_admin_users(integer, integer) from public, anon;
revoke all on function public.list_platform_admin_businesses(integer, integer) from public, anon;
revoke all on function public.list_platform_admin_subscriptions(integer, integer) from public, anon;
revoke all on function public.list_platform_subscription_payments(integer, integer) from public, anon;
grant execute on function public.list_platform_admin_users(integer, integer) to authenticated;
grant execute on function public.list_platform_admin_businesses(integer, integer) to authenticated;
grant execute on function public.list_platform_admin_subscriptions(integer, integer) to authenticated;
grant execute on function public.list_platform_subscription_payments(integer, integer) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907200500_promote_platform_owner.sql
-- ============================================================================
-- The project owner account is the primary super administrator of the platform console.
update public.platform_admins pa
set role = 'super_admin'
from auth.users u
where u.id = pa.user_id
  and lower(u.email) = 'admin@example.com';

notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907201000_reload_platform_admin_schema.sql
-- ============================================================================
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907201100_admin_permissions.sql
-- ============================================================================
-- Keep the authorization matrix centralized in the database primitive used by all admin RPCs.
create or replace function public.has_platform_admin_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins
    where user_id = auth.uid()
      and (
        role = 'super_admin'
        or (role = 'admin' and p_permission not in ('admin_management', 'security_critical', 'settings_critical'))
        or (role = 'support' and p_permission in ('overview', 'users', 'businesses', 'support', 'notifications'))
        or (role = 'finance' and p_permission in ('overview', 'subscriptions', 'subscription_payments', 'finance'))
        or (role = 'analyst' and p_permission in ('overview', 'analytics', 'reports'))
      )
  )
$$;

revoke all on function public.has_platform_admin_permission(text) from public, anon;
grant execute on function public.has_platform_admin_permission(text) to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907201600_platform_admin_lifecycle.sql
-- ============================================================================
alter table public.platform_admins add column if not exists status text not null default 'active';
alter table public.platform_admins drop constraint if exists platform_admins_status_check;
alter table public.platform_admins add constraint platform_admins_status_check check (status in ('active', 'suspended', 'disabled'));

drop function if exists public.list_platform_admin_accounts();
create or replace function public.list_platform_admin_accounts()
returns table (user_id uuid, email text, full_name text, phone text, created_at timestamptz, last_sign_in_at timestamptz, email_confirmed_at timestamptz, status text, role text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('admin_management') then raise exception 'Accès super administrateur requis.'; end if;
  return query select u.id, u.email::text, coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'), u.phone, u.created_at, u.last_sign_in_at, u.email_confirmed_at, pa.status, pa.role
    from public.platform_admins pa join auth.users u on u.id = pa.user_id order by u.created_at desc;
end;
$$;

revoke all on function public.list_platform_admin_accounts() from public, anon;
grant execute on function public.list_platform_admin_accounts() to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907202000_fix_platform_admin_types.sql
-- ============================================================================
create or replace function public.list_platform_admin_users(p_limit integer default 50, p_offset integer default 0)
returns table (user_id uuid, email text, created_at timestamptz, platform_role text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('users') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select u.id, u.email::text, u.created_at, pa.role
    from auth.users u
    left join public.platform_admins pa on pa.user_id = u.id
    order by u.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.list_platform_admin_businesses(p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, name text, owner_id uuid, owner_email text, created_at timestamptz, plan text, subscription_status text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('businesses') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select b.id, b.name, b.owner_id, u.email::text, b.created_at,
      coalesce(bs.plan, 'free'), coalesce(bs.status, 'active')
    from public.businesses b
    left join auth.users u on u.id = b.owner_id
    left join public.business_subscriptions bs on bs.business_id = b.id
    order by b.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907202300_platform_permission_matrix.sql
-- ============================================================================
-- Keep every platform permission explicit; unknown permissions must never grant access.
create or replace function public.has_platform_admin_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins
    where user_id = auth.uid()
      and status = 'active'
      and (
        role = 'super_admin'
        or (
          role = 'admin'
          and p_permission in (
            'overview', 'users', 'user_management', 'businesses',
            'subscriptions', 'subscription_payments', 'support',
            'notifications', 'analytics', 'audit', 'content',
            'integrations', 'incidents'
          )
        )
        or (role = 'support' and p_permission in ('overview', 'users', 'businesses', 'support', 'notifications'))
        or (role = 'finance' and p_permission in ('overview', 'subscriptions', 'subscription_payments', 'finance'))
        or (role = 'analyst' and p_permission in ('overview', 'analytics', 'reports'))
      )
  )
$$;

revoke all on function public.has_platform_admin_permission(text) from public, anon;
grant execute on function public.has_platform_admin_permission(text) to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907203500_platform_notification_security_integrations.sql
-- ============================================================================
create or replace function public.notify_platform_security_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.action in ('login_failed', 'access_denied', 'disable', 'delete', 'change_role')
     or new.resource_type ilike '%security%' then
    perform public.create_platform_notification(
      'security_issue',
      'Problème de sécurité',
      format('Une action de sécurité (%s) a été enregistrée.', new.action),
      case when new.result = 'failure' or new.action in ('login_failed', 'access_denied') then 'critical' else 'warning' end
    );
  end if;
  return new;
end;
$$;

create or replace function public.notify_platform_integration_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('unavailable', 'attention') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform public.create_platform_notification(
      'integration_unavailable',
      'Intégration indisponible',
      format('L’intégration « %s » nécessite une vérification.', new.name),
      case when new.status = 'unavailable' then 'critical' else 'warning' end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists platform_security_notification on public.platform_audit_logs;
create trigger platform_security_notification
after insert on public.platform_audit_logs
for each row execute function public.notify_platform_security_event();

drop trigger if exists platform_integration_notification on public.platform_integrations;
create trigger platform_integration_notification
after insert or update of status on public.platform_integrations
for each row execute function public.notify_platform_integration_event();

notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907203800_platform_notifications_professional.sql
-- ============================================================================
alter table public.platform_notifications
  add column if not exists recipient_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists recipient_role text,
  add column if not exists resource_type text,
  add column if not exists resource_id uuid,
  add column if not exists source_event_id text,
  add column if not exists archived_at timestamptz,
  add column if not exists email_sent_at timestamptz,
  add column if not exists delivery_attempts integer not null default 0,
  add column if not exists last_delivery_error text;

create unique index if not exists platform_notifications_source_event_uidx
  on public.platform_notifications(type, source_event_id)
  where source_event_id is not null;

create table if not exists public.platform_notification_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  sms_enabled boolean not null default false,
  webhook_enabled boolean not null default false,
  critical_only boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, notification_type)
);

alter table public.platform_notification_preferences enable row level security;

create or replace function public.list_platform_notifications(
  p_limit integer default 50,
  p_offset integer default 0,
  p_query text default null,
  p_type text default null,
  p_severity text default null,
  p_unread_only boolean default false,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  id uuid, type text, title text, message text, severity text, read_at timestamptz,
  created_at timestamptz, resource_type text, resource_id uuid, archived_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
declare current_role text;
begin
  select pa.role into current_role from public.platform_admins pa
    where pa.user_id = auth.uid() and pa.status = 'active';
  if current_role is null then raise exception 'Accès administrateur requis.'; end if;
  return query
    select n.id, n.type, n.title, n.message, n.severity, n.read_at, n.created_at,
      n.resource_type, n.resource_id, n.archived_at
    from public.platform_notifications n
    where n.archived_at is null
      and (n.recipient_user_id is null or n.recipient_user_id = auth.uid())
      and (n.recipient_role is null or n.recipient_role = current_role or current_role = 'super_admin')
      and (p_query is null or concat_ws(' ', n.type, n.title, n.message)::text ilike '%' || p_query || '%')
      and (p_type is null or n.type = p_type)
      and (p_severity is null or n.severity = p_severity)
      and (not p_unread_only or n.read_at is null)
      and (p_from is null or n.created_at >= p_from)
      and (p_to is null or n.created_at < p_to)
    order by n.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.mark_platform_notification_read(p_notification_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.platform_notifications
    set read_at = coalesce(read_at, now())
    where id = p_notification_id and (recipient_user_id is null or recipient_user_id = auth.uid());
  perform public.write_platform_audit('mark_read', 'platform_notification', p_notification_id);
end;
$$;

create or replace function public.mark_platform_notification_unread(p_notification_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.platform_notifications
    set read_at = null
    where id = p_notification_id
      and (recipient_user_id is null or recipient_user_id = auth.uid());
  perform public.write_platform_audit('mark_unread', 'platform_notification', p_notification_id);
end;
$$;

create or replace function public.mark_all_platform_notifications_read()
returns integer language plpgsql security definer set search_path = public
as $$
declare changed integer;
begin
  update public.platform_notifications n
    set read_at = now()
    where n.read_at is null and n.archived_at is null
      and (n.recipient_user_id is null or n.recipient_user_id = auth.uid());
  get diagnostics changed = row_count;
  perform public.write_platform_audit('mark_all_read', 'platform_notification', null, 'success', jsonb_build_object('count', changed));
  return changed;
end;
$$;

create or replace function public.archive_platform_notification(p_notification_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('notifications') then raise exception 'Accès administrateur requis.'; end if;
  update public.platform_notifications set archived_at = now()
    where id = p_notification_id;
  perform public.write_platform_audit('archive', 'platform_notification', p_notification_id);
end;
$$;

create or replace function public.set_platform_notification_preference(
  p_type text, p_in_app boolean, p_email boolean, p_sms boolean, p_webhook boolean, p_critical_only boolean
)
returns void language plpgsql security definer set search_path = public
as $$
begin
  insert into public.platform_notification_preferences(user_id, notification_type, in_app_enabled, email_enabled, sms_enabled, webhook_enabled, critical_only)
  values (auth.uid(), p_type, p_in_app, p_email, p_sms, p_webhook, p_critical_only)
  on conflict (user_id, notification_type) do update set
    in_app_enabled = excluded.in_app_enabled, email_enabled = excluded.email_enabled,
    sms_enabled = excluded.sms_enabled, webhook_enabled = excluded.webhook_enabled,
    critical_only = excluded.critical_only, updated_at = now();
end;
$$;

create or replace function public.list_platform_notification_preferences()
returns table (notification_type text, in_app_enabled boolean, email_enabled boolean, sms_enabled boolean, webhook_enabled boolean, critical_only boolean)
language sql stable security definer set search_path = public
as $$
  select notification_type, in_app_enabled, email_enabled, sms_enabled, webhook_enabled, critical_only
  from public.platform_notification_preferences where user_id = auth.uid()
  order by notification_type
$$;

drop function if exists public.create_platform_notification(text, text, text, text);
create or replace function public.create_platform_notification(
  p_type text, p_title text, p_message text, p_severity text default 'info',
  p_recipient_role text default null, p_recipient_user_id uuid default null,
  p_resource_type text default null, p_resource_id uuid default null, p_source_event_id text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare notification_id uuid;
begin
  if p_severity not in ('info', 'warning', 'critical') then raise exception 'Gravité de notification invalide.'; end if;
  insert into public.platform_notifications(type, title, message, severity, recipient_role, recipient_user_id, resource_type, resource_id, source_event_id)
  values (p_type, left(p_title, 160), left(p_message, 1000), p_severity, p_recipient_role, p_recipient_user_id, p_resource_type, p_resource_id, p_source_event_id)
  on conflict (type, source_event_id) where source_event_id is not null do nothing
  returning id into notification_id;
  return notification_id;
end;
$$;

alter table public.platform_notifications replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'platform_notifications'
  ) then
    alter publication supabase_realtime add table public.platform_notifications;
  end if;
end;
$$;

revoke all on function public.list_platform_notifications(integer, integer, text, text, text, boolean, timestamptz, timestamptz) from public, anon;
revoke all on function public.mark_platform_notification_read(uuid) from public, anon;
revoke all on function public.mark_platform_notification_unread(uuid) from public, anon;
revoke all on function public.mark_all_platform_notifications_read() from public, anon;
revoke all on function public.archive_platform_notification(uuid) from public, anon;
revoke all on function public.set_platform_notification_preference(text, boolean, boolean, boolean, boolean, boolean) from public, anon;
revoke all on function public.list_platform_notification_preferences() from public, anon;
grant execute on function public.list_platform_notifications(integer, integer, text, text, text, boolean, timestamptz, timestamptz) to authenticated;
grant execute on function public.mark_platform_notification_read(uuid) to authenticated;
grant execute on function public.mark_platform_notification_unread(uuid) to authenticated;
grant execute on function public.mark_all_platform_notifications_read() to authenticated;
grant execute on function public.archive_platform_notification(uuid) to authenticated;
grant execute on function public.set_platform_notification_preference(text, boolean, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.list_platform_notification_preferences() to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907210000_platform_operations.sql
-- ============================================================================
drop function if exists public.list_platform_incidents(integer, integer);
drop function if exists public.list_platform_audit_logs(integer, integer);
create table if not exists public.platform_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  result text not null default 'success' check (result in ('success', 'failure')),
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_audit_logs_created_idx
  on public.platform_audit_logs (created_at desc);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  subject text not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_status_idx
  on public.support_tickets (status, priority, updated_at desc);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null,
  internal boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  message text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists platform_notifications_unread_idx
  on public.platform_notifications (read_at, created_at desc);

create table if not exists public.platform_incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  service text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'detected' check (status in ('detected', 'investigating', 'identified', 'fixing', 'verifying', 'resolved')),
  owner_id uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.platform_integrations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  service_type text not null,
  environment text not null default 'production',
  status text not null default 'not_configured' check (status in ('connected', 'operational', 'not_configured', 'attention', 'unavailable')),
  last_checked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.platform_audit_logs enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;
alter table public.platform_notifications enable row level security;
alter table public.platform_incidents enable row level security;
alter table public.platform_integrations enable row level security;

create or replace function public.has_platform_admin_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins
    where user_id = auth.uid()
      and (
        role in ('super_admin', 'admin')
        or (role = 'support' and p_permission in ('overview', 'users', 'businesses', 'subscriptions', 'support', 'notifications'))
        or (role = 'finance' and p_permission in ('overview', 'subscriptions', 'subscription_payments'))
        or (role = 'analyst' and p_permission in ('overview', 'users', 'businesses', 'subscriptions', 'subscription_payments', 'analytics'))
      )
  );
$$;

create or replace function public.write_platform_audit(
  p_action text,
  p_resource_type text,
  p_resource_id uuid default null,
  p_result text default 'success',
  p_context jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.platform_admins where user_id = auth.uid()) then
    raise exception 'Accès administrateur requis.';
  end if;
  insert into public.platform_audit_logs(actor_id, action, resource_type, resource_id, result, context)
  values (auth.uid(), p_action, p_resource_type, p_resource_id, p_result, coalesce(p_context, '{}'::jsonb));
end;
$$;

create or replace function public.list_platform_support_tickets(p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid, business_id uuid, business_name text, user_id uuid, user_email text,
  subject text, priority text, status text, assigned_to uuid, created_at timestamptz, updated_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('support') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select t.id, t.business_id, b.name, t.user_id, u.email::text, t.subject, t.priority, t.status,
      t.assigned_to, t.created_at, t.updated_at
    from public.support_tickets t
    left join public.businesses b on b.id = t.business_id
    left join auth.users u on u.id = t.user_id
    order by t.updated_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.list_platform_notifications(p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, type text, title text, message text, severity text, read_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('notifications') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select n.id, n.type, n.title, n.message, n.severity, n.read_at, n.created_at
    from public.platform_notifications n order by n.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

drop function if exists public.list_platform_audit_logs(integer, integer);
create or replace function public.list_platform_audit_logs(p_limit integer default 100, p_offset integer default 0)
returns table (id uuid, actor_id uuid, actor_email text, action text, resource_type text, resource_id uuid, result text, context jsonb, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('audit') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select l.id, l.actor_id, u.email::text, l.action, l.resource_type, l.resource_id, l.result, l.context, l.created_at
    from public.platform_audit_logs l left join auth.users u on u.id = l.actor_id
    order by l.created_at desc
    limit greatest(1, least(p_limit, 200)) offset greatest(p_offset, 0);
end;
$$;

drop function if exists public.list_platform_incidents(integer, integer);
create or replace function public.list_platform_incidents(p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, title text, description text, service text, severity text, status text, owner_id uuid, started_at timestamptz, resolved_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('incidents') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select i.id, i.title, i.description, i.service, i.severity, i.status, i.owner_id, i.started_at, i.resolved_at
    from public.platform_incidents i order by i.started_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.list_platform_integrations()
returns table (id uuid, name text, service_type text, environment text, status text, last_checked_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('integrations') then raise exception 'Accès administrateur requis.'; end if;
  return query select i.id, i.name, i.service_type, i.environment, i.status, i.last_checked_at
    from public.platform_integrations i order by i.name;
end;
$$;

create or replace function public.update_platform_ticket_status(p_ticket_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('support') then raise exception 'Accès administrateur requis.'; end if;
  if p_status not in ('open', 'in_progress', 'waiting', 'resolved', 'closed') then raise exception 'Statut de ticket invalide.'; end if;
  update public.support_tickets set status = p_status, updated_at = now() where id = p_ticket_id;
  if not found then raise exception 'Ticket introuvable.'; end if;
  perform public.write_platform_audit('update_status', 'support_ticket', p_ticket_id, 'success', jsonb_build_object('status', p_status));
end;
$$;

create or replace function public.add_platform_ticket_message(p_ticket_id uuid, p_body text, p_internal boolean default false)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare message_id uuid;
begin
  if not public.has_platform_admin_permission('support') then raise exception 'Accès administrateur requis.'; end if;
  if nullif(trim(p_body), '') is null then raise exception 'Le message ne peut pas être vide.'; end if;
  insert into public.support_ticket_messages(ticket_id, author_id, body, internal)
  values (p_ticket_id, auth.uid(), trim(p_body), p_internal)
  returning id into message_id;
  update public.support_tickets set updated_at = now(), status = case when status = 'open' then 'in_progress' else status end where id = p_ticket_id;
  perform public.write_platform_audit('reply', 'support_ticket', p_ticket_id, 'success', jsonb_build_object('internal', p_internal));
  return message_id;
end;
$$;

create or replace function public.mark_platform_notification_read(p_notification_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('notifications') then raise exception 'Accès administrateur requis.'; end if;
  update public.platform_notifications set read_at = coalesce(read_at, now()) where id = p_notification_id;
  perform public.write_platform_audit('mark_read', 'platform_notification', p_notification_id);
end;
$$;

create or replace function public.create_platform_incident(
  p_title text, p_description text, p_service text, p_severity text default 'medium'
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare incident_id uuid;
begin
  if not public.has_platform_admin_permission('incidents') then raise exception 'Accès administrateur requis.'; end if;
  if nullif(trim(p_title), '') is null or nullif(trim(p_description), '') is null or nullif(trim(p_service), '') is null then
    raise exception 'Titre, description et service sont obligatoires.';
  end if;
  if p_severity not in ('low', 'medium', 'high', 'critical') then raise exception 'Gravité invalide.'; end if;
  insert into public.platform_incidents(title, description, service, severity, owner_id)
  values (trim(p_title), trim(p_description), trim(p_service), p_severity, auth.uid())
  returning id into incident_id;
  perform public.write_platform_audit('create', 'platform_incident', incident_id);
  return incident_id;
end;
$$;

create or replace function public.update_platform_incident_status(p_incident_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('incidents') then raise exception 'Accès administrateur requis.'; end if;
  if p_status not in ('detected', 'investigating', 'identified', 'fixing', 'verifying', 'resolved') then raise exception 'Statut d’incident invalide.'; end if;
  update public.platform_incidents
    set status = p_status, resolved_at = case when p_status = 'resolved' then coalesce(resolved_at, now()) else null end
    where id = p_incident_id;
  if not found then raise exception 'Incident introuvable.'; end if;
  perform public.write_platform_audit('update_status', 'platform_incident', p_incident_id, 'success', jsonb_build_object('status', p_status));
end;
$$;

revoke all on function public.write_platform_audit(text, text, uuid, text, jsonb) from public, anon;
revoke all on function public.list_platform_support_tickets(integer, integer) from public, anon;
revoke all on function public.list_platform_notifications(integer, integer) from public, anon;
revoke all on function public.list_platform_audit_logs(integer, integer) from public, anon;
revoke all on function public.list_platform_incidents(integer, integer) from public, anon;
revoke all on function public.list_platform_integrations() from public, anon;
revoke all on function public.update_platform_ticket_status(uuid, text) from public, anon;
revoke all on function public.add_platform_ticket_message(uuid, text, boolean) from public, anon;
revoke all on function public.mark_platform_notification_read(uuid) from public, anon;
revoke all on function public.create_platform_incident(text, text, text, text) from public, anon;
revoke all on function public.update_platform_incident_status(uuid, text) from public, anon;
grant execute on function public.write_platform_audit(text, text, uuid, text, jsonb) to authenticated;
grant execute on function public.list_platform_support_tickets(integer, integer) to authenticated;
grant execute on function public.list_platform_notifications(integer, integer) to authenticated;
grant execute on function public.list_platform_audit_logs(integer, integer) to authenticated;
grant execute on function public.list_platform_incidents(integer, integer) to authenticated;
grant execute on function public.list_platform_integrations() to authenticated;
grant execute on function public.update_platform_ticket_status(uuid, text) to authenticated;
grant execute on function public.add_platform_ticket_message(uuid, text, boolean) to authenticated;
grant execute on function public.mark_platform_notification_read(uuid) to authenticated;
grant execute on function public.create_platform_incident(text, text, text, text) to authenticated;
grant execute on function public.update_platform_incident_status(uuid, text) to authenticated;

insert into public.platform_integrations (name, service_type, status)
values
  ('Supabase', 'database', 'connected'),
  ('PayDunya', 'payment', 'attention'),
  ('Resend', 'email', 'attention')
on conflict (name) do nothing;

create or replace function public.get_platform_admin_overview()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('overview') then
    raise exception 'Accès administrateur requis.';
  end if;
  return jsonb_build_object(
    'business_count', (select count(*) from public.businesses),
    'member_count', (select count(distinct user_id) from public.business_members),
    'invoice_count', (select count(*) from public.invoices),
    'revenue', coalesce((select sum(amount) from public.payments), 0),
    'subscription_revenue', coalesce((select sum(amount) from public.subscription_payments where status = 'completed'), 0),
    'active_subscriptions', (select count(*) from public.business_subscriptions where status in ('active', 'trialing')),
    'pending_payments', (select count(*) from public.subscription_payments where status = 'pending'),
    'open_ticket_count', (select count(*) from public.support_tickets where status in ('open', 'in_progress', 'waiting')),
    'security_alert_count', (select count(*) from public.platform_notifications where severity = 'critical' and read_at is null),
    'recent_businesses', coalesce((
      select jsonb_agg(row_to_json(recent)) from (
        select b.id, b.name, b.created_at, coalesce(bs.plan, 'free') as plan,
          coalesce(bs.status, 'active') as subscription_status
        from public.businesses b
        left join public.business_subscriptions bs on bs.business_id = b.id
        order by b.created_at desc limit 10
      ) recent
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_platform_admin_overview() from public, anon;
grant execute on function public.get_platform_admin_overview() to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907220000_platform_operations_actions.sql
-- ============================================================================
create or replace function public.update_platform_ticket_status(p_ticket_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('support') then raise exception 'Accès administrateur requis.'; end if;
  if p_status not in ('open', 'in_progress', 'waiting', 'resolved', 'closed') then raise exception 'Statut de ticket invalide.'; end if;
  update public.support_tickets set status = p_status, updated_at = now() where id = p_ticket_id;
  if not found then raise exception 'Ticket introuvable.'; end if;
  perform public.write_platform_audit('update_status', 'support_ticket', p_ticket_id, 'success', jsonb_build_object('status', p_status));
end;
$$;

create or replace function public.add_platform_ticket_message(p_ticket_id uuid, p_body text, p_internal boolean default false)
returns uuid language plpgsql security definer set search_path = public
as $$
declare message_id uuid;
begin
  if not public.has_platform_admin_permission('support') then raise exception 'Accès administrateur requis.'; end if;
  if nullif(trim(p_body), '') is null then raise exception 'Le message ne peut pas être vide.'; end if;
  insert into public.support_ticket_messages(ticket_id, author_id, body, internal)
  values (p_ticket_id, auth.uid(), trim(p_body), p_internal) returning id into message_id;
  update public.support_tickets set updated_at = now(), status = case when status = 'open' then 'in_progress' else status end where id = p_ticket_id;
  perform public.write_platform_audit('reply', 'support_ticket', p_ticket_id, 'success', jsonb_build_object('internal', p_internal));
  return message_id;
end;
$$;

create or replace function public.mark_platform_notification_read(p_notification_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('notifications') then raise exception 'Accès administrateur requis.'; end if;
  update public.platform_notifications set read_at = coalesce(read_at, now()) where id = p_notification_id;
  perform public.write_platform_audit('mark_read', 'platform_notification', p_notification_id);
end;
$$;

create or replace function public.create_platform_incident(
  p_title text, p_description text, p_service text, p_severity text default 'medium'
) returns uuid language plpgsql security definer set search_path = public
as $$
declare incident_id uuid;
begin
  if not public.has_platform_admin_permission('incidents') then raise exception 'Accès administrateur requis.'; end if;
  if nullif(trim(p_title), '') is null or nullif(trim(p_description), '') is null or nullif(trim(p_service), '') is null then
    raise exception 'Titre, description et service sont obligatoires.';
  end if;
  if p_severity not in ('low', 'medium', 'high', 'critical') then raise exception 'Gravité invalide.'; end if;
  insert into public.platform_incidents(title, description, service, severity, owner_id)
  values (trim(p_title), trim(p_description), trim(p_service), p_severity, auth.uid()) returning id into incident_id;
  perform public.write_platform_audit('create', 'platform_incident', incident_id);
  return incident_id;
end;
$$;

create or replace function public.update_platform_incident_status(p_incident_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('incidents') then raise exception 'Accès administrateur requis.'; end if;
  if p_status not in ('detected', 'investigating', 'identified', 'fixing', 'verifying', 'resolved') then raise exception 'Statut d’incident invalide.'; end if;
  update public.platform_incidents
    set status = p_status, resolved_at = case when p_status = 'resolved' then coalesce(resolved_at, now()) else null end
    where id = p_incident_id;
  if not found then raise exception 'Incident introuvable.'; end if;
  perform public.write_platform_audit('update_status', 'platform_incident', p_incident_id, 'success', jsonb_build_object('status', p_status));
end;
$$;

revoke all on function public.update_platform_ticket_status(uuid, text) from public, anon;
revoke all on function public.add_platform_ticket_message(uuid, text, boolean) from public, anon;
revoke all on function public.mark_platform_notification_read(uuid) from public, anon;
revoke all on function public.create_platform_incident(text, text, text, text) from public, anon;
revoke all on function public.update_platform_incident_status(uuid, text) from public, anon;
grant execute on function public.update_platform_ticket_status(uuid, text) to authenticated;
grant execute on function public.add_platform_ticket_message(uuid, text, boolean) to authenticated;
grant execute on function public.mark_platform_notification_read(uuid) to authenticated;
grant execute on function public.create_platform_incident(text, text, text, text) to authenticated;
grant execute on function public.update_platform_incident_status(uuid, text) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907230000_platform_admin_management.sql
-- ============================================================================
drop function if exists public.list_platform_admin_accounts();
create or replace function public.list_platform_admin_accounts()
returns table (user_id uuid, email text, created_at timestamptz, role text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('admin_management') then raise exception 'Accès super administrateur requis.'; end if;
  return query select u.id, u.email::text, u.created_at, pa.role
    from public.platform_admins pa join auth.users u on u.id = pa.user_id order by u.created_at desc;
end;
$$;

create or replace function public.update_platform_admin_role(p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public
as $$
declare current_role text;
begin
  if not public.has_platform_admin_permission('admin_management') then raise exception 'Accès super administrateur requis.'; end if;
  if p_role not in ('super_admin', 'admin', 'support', 'finance', 'analyst') then raise exception 'Rôle administrateur invalide.'; end if;
  select role into current_role from public.platform_admins where user_id = p_user_id;
  if current_role is null then raise exception 'Administrateur introuvable.'; end if;
  if p_user_id = auth.uid() and p_role <> 'super_admin' and current_role = 'super_admin' then raise exception 'Un super administrateur ne peut pas retirer son propre accès maximal.'; end if;
  update public.platform_admins set role = p_role where user_id = p_user_id;
  perform public.write_platform_audit('change_role', 'platform_admin', p_user_id, 'success', jsonb_build_object('previous_role', current_role, 'new_role', p_role));
end;
$$;

revoke all on function public.list_platform_admin_accounts() from public, anon;
revoke all on function public.update_platform_admin_role(uuid, text) from public, anon;
grant execute on function public.list_platform_admin_accounts() to authenticated;
grant execute on function public.update_platform_admin_role(uuid, text) to authenticated;
notify pgrst, 'reload schema';
create or replace function public.has_platform_admin_permission(p_permission text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins
    where user_id = auth.uid() and (
      role = 'super_admin' or (role = 'admin' and p_permission <> 'admin_management')
      or (role = 'support' and p_permission in ('overview', 'users', 'businesses', 'subscriptions', 'support', 'notifications'))
      or (role = 'finance' and p_permission in ('overview', 'subscriptions', 'subscription_payments'))
      or (role = 'analyst' and p_permission in ('overview', 'users', 'businesses', 'subscriptions', 'subscription_payments', 'analytics'))
    )
  );
$$;

-- ============================================================================
-- Source: supabase/migrations/20260907240000_platform_content_settings.sql
-- ============================================================================
create table if not exists public.platform_content (
  id uuid primary key default gen_random_uuid(),
  content_type text not null,
  slug text not null unique,
  title text not null,
  body text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_settings (
  key text primary key,
  value text not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.platform_content enable row level security;
alter table public.platform_settings enable row level security;

create or replace function public.has_platform_admin_permission(p_permission text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins
    where user_id = auth.uid() and (
      role = 'super_admin'
      or (role = 'admin' and p_permission <> 'admin_management')
      or (role = 'support' and p_permission in ('overview', 'users', 'businesses', 'subscriptions', 'support', 'notifications'))
      or (role = 'finance' and p_permission in ('overview', 'subscriptions', 'subscription_payments'))
      or (role = 'analyst' and p_permission in ('overview', 'users', 'businesses', 'subscriptions', 'subscription_payments', 'analytics'))
    )
  );
$$;

create or replace function public.list_platform_content()
returns table (id uuid, content_type text, slug text, title text, body text, status text, updated_by uuid, updated_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('content') then raise exception 'Accès administrateur requis.'; end if;
  return query select c.id, c.content_type, c.slug, c.title, c.body, c.status, c.updated_by, c.updated_at
    from public.platform_content c order by c.updated_at desc;
end;
$$;

create or replace function public.list_public_content(p_content_type text default null)
returns table (id uuid, content_type text, slug text, title text, body text, status text, updated_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select c.id, c.content_type, c.slug, c.title, c.body, c.status, c.updated_at
  from public.platform_content c
  where c.status = 'published'
    and (p_content_type is null or c.content_type = p_content_type)
  order by c.updated_at desc
$$;

create or replace function public.upsert_platform_content(
  p_id uuid, p_content_type text, p_slug text, p_title text, p_body text, p_status text
) returns uuid language plpgsql security definer set search_path = public
as $$
declare content_id uuid;
begin
  if not public.has_platform_admin_permission('content') then raise exception 'Accès administrateur requis.'; end if;
  if p_status not in ('draft', 'published', 'archived') then raise exception 'Statut de contenu invalide.'; end if;
  if nullif(trim(p_title), '') is null or nullif(trim(p_slug), '') is null then raise exception 'Titre et identifiant obligatoires.'; end if;
  insert into public.platform_content(id, content_type, slug, title, body, status, updated_by, updated_at)
  values (coalesce(p_id, gen_random_uuid()), trim(p_content_type), trim(p_slug), trim(p_title), coalesce(p_body, ''), p_status, auth.uid(), now())
  on conflict (id) do update set content_type = excluded.content_type, slug = excluded.slug, title = excluded.title,
    body = excluded.body, status = excluded.status, updated_by = auth.uid(), updated_at = now()
  returning id into content_id;
  perform public.write_platform_audit(case when p_id is null then 'create' else 'update' end, 'platform_content', content_id);
  return content_id;
end;
$$;

create or replace function public.list_platform_settings()
returns table (key text, value text, updated_by uuid, updated_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('settings') then raise exception 'Accès administrateur requis.'; end if;
  return query select s.key, s.value, s.updated_by, s.updated_at from public.platform_settings s order by s.key;
end;
$$;

create or replace function public.update_platform_setting(p_key text, p_value text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('settings') then raise exception 'Accès administrateur requis.'; end if;
  if p_key not in ('platform_name', 'support_email', 'support_phone', 'default_currency', 'country', 'payment_provider') then raise exception 'Paramètre non modifiable.';
  end if;
  insert into public.platform_settings(key, value, updated_by, updated_at)
  values (p_key, coalesce(trim(p_value), ''), auth.uid(), now())
  on conflict (key) do update set value = excluded.value, updated_by = auth.uid(), updated_at = now();
  perform public.write_platform_audit('update', 'platform_setting', null, 'success', jsonb_build_object('key', p_key));
end;
$$;

insert into public.platform_settings(key, value) values
  ('platform_name', 'FactureFacile Bénin'), ('support_email', 'support@facturefacile.bj'),
  ('support_phone', ''), ('default_currency', 'XOF'), ('country', 'Bénin'), ('payment_provider', 'PayDunya')
on conflict (key) do nothing;

revoke all on function public.list_platform_content() from public, anon;
revoke all on function public.upsert_platform_content(uuid, text, text, text, text, text) from public, anon;
revoke all on function public.list_platform_settings() from public, anon;
revoke all on function public.update_platform_setting(text, text) from public, anon;
grant execute on function public.list_platform_content() to authenticated;
grant execute on function public.list_public_content(text) to anon, authenticated;
grant execute on function public.upsert_platform_content(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.list_platform_settings() to authenticated;
grant execute on function public.update_platform_setting(text, text) to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907250000_platform_global_search.sql
-- ============================================================================
drop function if exists public.search_platform_global(text, integer);
create or replace function public.search_platform_global(p_query text, p_limit integer default 20)
returns table (category text, label text, resource_id uuid)
language plpgsql stable security definer set search_path = public
as $$
declare q text := lower(trim(coalesce(p_query, '')));
begin
  if length(q) < 2 or not public.has_platform_admin_permission('overview') then return; end if;
  return query
    select 'Entreprise', b.name, b.id from public.businesses b
    where lower(b.name) like '%' || q || '%' limit greatest(1, least(p_limit, 20));
  return query
    select 'Utilisateur', u.email::text, u.id from auth.users u
    where lower(coalesce(u.email::text, '')) like '%' || q || '%' limit greatest(1, least(p_limit, 20));
  return query
    select 'Ticket', t.subject, t.id from public.support_tickets t
    where lower(t.subject) like '%' || q || '%' limit greatest(1, least(p_limit, 20));
end;
$$;
revoke all on function public.search_platform_global(text, integer) from public, anon;
grant execute on function public.search_platform_global(text, integer) to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907260000_platform_notification_events.sql
-- ============================================================================
create or replace function public.create_platform_notification(
  p_type text,
  p_title text,
  p_message text,
  p_severity text default 'info'
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare notification_id uuid;
begin
  if p_severity not in ('info', 'warning', 'critical') then
    raise exception 'Gravité de notification invalide.';
  end if;
  insert into public.platform_notifications(type, title, message, severity)
  values (p_type, p_title, p_message, p_severity)
  returning id into notification_id;
  return notification_id;
end;
$$;

create or replace function public.notify_platform_business_event()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.create_platform_notification(
    'new_business',
    'Nouvelle entreprise inscrite',
    format('L’entreprise « %s » vient de rejoindre la plateforme.', new.name),
    'info'
  );
  return new;
end;
$$;

create or replace function public.notify_platform_member_event()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare email text;
begin
  select u.email::text into email from auth.users u where u.id = new.user_id;
  perform public.create_platform_notification(
    'new_user',
    'Nouvel utilisateur',
    format('Un nouvel utilisateur a rejoint une entreprise (%s).', coalesce(email, 'e-mail non renseigné')),
    'info'
  );
  return new;
end;
$$;

create or replace function public.notify_platform_ticket_event()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.create_platform_notification(
    case when new.priority = 'urgent' then 'urgent_ticket' else 'new_ticket' end,
    case when new.priority = 'urgent' then 'Ticket urgent' else 'Nouveau ticket support' end,
    new.subject,
    case when new.priority = 'urgent' then 'critical' else 'info' end
  );
  return new;
end;
$$;

create or replace function public.notify_platform_payment_event()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'failed' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform public.create_platform_notification(
      'failed_payment',
      'Paiement échoué',
      format('Le paiement d’abonnement %s a échoué.', coalesce(new.id::text, 'inconnu')),
      'warning'
    );
  end if;
  return new;
end;
$$;

create or replace function public.notify_platform_subscription_event()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'expired' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform public.create_platform_notification(
      'expired_subscription',
      'Abonnement expiré',
      format('L’abonnement de l’entreprise %s est arrivé à expiration.', new.business_id),
      'warning'
    );
  end if;
  return new;
end;
$$;

create or replace function public.notify_platform_incident_event()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.create_platform_notification(
    'technical_incident',
    'Incident technique',
    new.title,
    case when new.severity in ('high', 'critical') then 'critical' else 'warning' end
  );
  return new;
end;
$$;

create or replace function public.notify_platform_security_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.action in ('login_failed', 'access_denied', 'disable', 'delete', 'change_role')
     or new.resource_type ilike '%security%' then
    perform public.create_platform_notification(
      'security_issue',
      'Problème de sécurité',
      format('Une action de sécurité (%s) a été enregistrée.', new.action),
      case when new.result = 'failure' or new.action in ('login_failed', 'access_denied') then 'critical' else 'warning' end
    );
  end if;
  return new;
end;
$$;

create or replace function public.notify_platform_integration_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('unavailable', 'attention') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform public.create_platform_notification(
      'integration_unavailable',
      'Intégration indisponible',
      format('L’intégration « %s » nécessite une vérification.', new.name),
      case when new.status = 'unavailable' then 'critical' else 'warning' end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists platform_business_notification on public.businesses;
create trigger platform_business_notification
after insert on public.businesses
for each row execute function public.notify_platform_business_event();

drop trigger if exists platform_member_notification on public.business_members;
create trigger platform_member_notification
after insert on public.business_members
for each row execute function public.notify_platform_member_event();

drop trigger if exists platform_ticket_notification on public.support_tickets;
create trigger platform_ticket_notification
after insert on public.support_tickets
for each row execute function public.notify_platform_ticket_event();

drop trigger if exists platform_payment_notification on public.subscription_payments;
create trigger platform_payment_notification
after insert or update of status on public.subscription_payments
for each row execute function public.notify_platform_payment_event();

drop trigger if exists platform_subscription_notification on public.business_subscriptions;
create trigger platform_subscription_notification
after insert or update of status on public.business_subscriptions
for each row execute function public.notify_platform_subscription_event();

drop trigger if exists platform_incident_notification on public.platform_incidents;
create trigger platform_incident_notification
after insert on public.platform_incidents
for each row execute function public.notify_platform_incident_event();

drop trigger if exists platform_security_notification on public.platform_audit_logs;
create trigger platform_security_notification
after insert on public.platform_audit_logs
for each row execute function public.notify_platform_security_event();

drop trigger if exists platform_integration_notification on public.platform_integrations;
create trigger platform_integration_notification
after insert or update of status on public.platform_integrations
for each row execute function public.notify_platform_integration_event();

revoke all on function public.create_platform_notification(text, text, text, text) from public, anon, authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907270000_platform_users_module.sql
-- ============================================================================
drop function if exists public.list_platform_users_detailed(integer, integer, text, text, uuid, text, text);
create or replace function public.list_platform_users_detailed(
  p_limit integer default 50,
  p_offset integer default 0,
  p_query text default null,
  p_status text default null,
  p_business_id uuid default null,
  p_role text default null,
  p_plan text default null
)
returns table (
  user_id uuid,
  first_name text,
  last_name text,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  business_id uuid,
  business_name text,
  business_plan text,
  business_role text,
  platform_role text,
  account_status text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  connection_count bigint
)
language plpgsql stable security definer set search_path = public
as $$
declare q text := lower(trim(coalesce(p_query, '')));
begin
  if not public.has_platform_admin_permission('users') then raise exception 'Accès administrateur requis.'; end if;
  return query
    with memberships as (
      select m.user_id, m.business_id, m.role,
        row_number() over (partition by m.user_id order by m.created_at) as rank
      from public.business_members m
    )
    select u.id,
      split_part(coalesce(u.raw_user_meta_data->>'full_name', ''), ' ', 1),
      nullif(regexp_replace(coalesce(u.raw_user_meta_data->>'full_name', ''), '^[^ ]+ ?', ''), ''),
      nullif(u.raw_user_meta_data->>'full_name', ''),
      u.email::text,
      coalesce(u.raw_user_meta_data->>'phone', u.phone::text),
      u.raw_user_meta_data->>'avatar_url',
      coalesce(m.business_id, b.id),
      coalesce(bm.name, b.name),
      coalesce(bs.plan, 'free'),
      case when b.owner_id = u.id then 'owner' else coalesce(m.role, 'none') end,
      pa.role,
      case when u.banned_until is not null and u.banned_until > now() then 'disabled' else 'active' end,
      u.created_at,
      u.last_sign_in_at,
      0::bigint
    from auth.users u
    left join memberships m on m.user_id = u.id and m.rank = 1
    left join public.businesses b on b.owner_id = u.id
    left join public.businesses bm on bm.id = m.business_id
    left join public.business_subscriptions bs on bs.business_id = coalesce(m.business_id, b.id)
    left join public.platform_admins pa on pa.user_id = u.id
    where (q = '' or lower(concat_ws(' ', u.raw_user_meta_data->>'full_name', u.email::text)) like '%' || q || '%')
      and (p_status is null or p_status = '' or (p_status = 'disabled' and u.banned_until is not null and u.banned_until > now()) or (p_status = 'active' and (u.banned_until is null or u.banned_until <= now())))
      and (p_business_id is null or coalesce(m.business_id, b.id) = p_business_id)
      and (p_role is null or p_role = '' or case when b.owner_id = u.id then 'owner' else coalesce(m.role, 'none') end = p_role)
      and (p_plan is null or p_plan = '' or coalesce(bs.plan, 'free') = p_plan)
    order by u.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.get_platform_user_detail(p_user_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare result jsonb;
begin
  if not public.has_platform_admin_permission('users') then raise exception 'Accès administrateur requis.'; end if;
  select jsonb_build_object(
    'user_id', u.id, 'full_name', u.raw_user_meta_data->>'full_name', 'email', u.email,
    'phone', coalesce(u.raw_user_meta_data->>'phone', u.phone::text), 'avatar_url', u.raw_user_meta_data->>'avatar_url',
    'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
    'status', case when u.banned_until is not null and u.banned_until > now() then 'disabled' else 'active' end,
    'platform_role', pa.role,
    'businesses', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'role', x.role, 'plan', x.plan))
      from (select b.id, b.name, 'owner' as role, coalesce(bs.plan, 'free') as plan from public.businesses b left join public.business_subscriptions bs on bs.business_id = b.id where b.owner_id = u.id
            union all select b.id, b.name, m.role, coalesce(bs.plan, 'free') from public.business_members m join public.businesses b on b.id = m.business_id left join public.business_subscriptions bs on bs.business_id = b.id where m.user_id = u.id) x), '[]'::jsonb),
    'tickets', coalesce((select jsonb_agg(t) from (select id, subject, priority, status, created_at from public.support_tickets where user_id = u.id order by created_at desc limit 10) t), '[]'::jsonb)
  ) into result
  from auth.users u left join public.platform_admins pa on pa.user_id = u.id where u.id = p_user_id;
  if result is null then raise exception 'Utilisateur introuvable.'; end if;
  return result;
end;
$$;

create or replace function public.set_platform_user_status(p_user_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('users') then raise exception 'Accès administrateur requis.'; end if;
  if p_status not in ('active', 'disabled') then raise exception 'Statut invalide.'; end if;
  update auth.users set banned_until = case when p_status = 'disabled' then 'infinity'::timestamptz else null end where id = p_user_id;
  if not found then raise exception 'Utilisateur introuvable.'; end if;
  perform public.write_platform_audit(case when p_status = 'disabled' then 'disable' else 'activate' end, 'platform_user', p_user_id);
end;
$$;

revoke all on function public.list_platform_users_detailed(integer, integer, text, text, uuid, text, text) from public, anon;
revoke all on function public.get_platform_user_detail(uuid) from public, anon;
revoke all on function public.set_platform_user_status(uuid, text) from public, anon;
grant execute on function public.list_platform_users_detailed(integer, integer, text, text, uuid, text, text) to authenticated;
grant execute on function public.get_platform_user_detail(uuid) to authenticated;
grant execute on function public.set_platform_user_status(uuid, text) to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907270500_platform_notification_event_metadata.sql
-- ============================================================================
drop function if exists public.create_platform_notification(text, text, text, text);

create or replace function public.notify_platform_business_event()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform public.create_platform_notification(
    'new_business', 'Nouvelle entreprise inscrite',
    format('L’entreprise « %s » vient de rejoindre la plateforme.', new.name), 'info',
    'admin', null, 'business', new.id, new.id::text
  );
  return new;
end;
$$;

create or replace function public.notify_platform_member_event()
returns trigger language plpgsql security definer set search_path = public
as $$
declare member_email text;
begin
  select u.email::text into member_email from auth.users u where u.id = new.user_id;
  perform public.create_platform_notification(
    'new_user', 'Nouvel utilisateur',
    format('Un nouvel utilisateur a rejoint une entreprise (%s).', coalesce(member_email, 'e-mail non renseigné')), 'info',
    'support', null, 'user', new.user_id, new.id::text
  );
  return new;
end;
$$;

create or replace function public.notify_platform_ticket_event()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform public.create_platform_notification(
    case when new.priority = 'urgent' then 'urgent_ticket' else 'new_ticket' end,
    case when new.priority = 'urgent' then 'Ticket urgent' else 'Nouveau ticket support' end,
    new.subject, case when new.priority = 'urgent' then 'critical' else 'info' end,
    'support', null, 'support_ticket', new.id, new.id::text
  );
  return new;
end;
$$;

create or replace function public.notify_platform_payment_event()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'failed' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform public.create_platform_notification(
      'failed_payment', 'Paiement échoué',
      format('Le paiement d’abonnement %s a échoué.', new.id), 'warning',
      'finance', null, 'subscription_payment', new.id, new.id::text || ':' || new.status
    );
  end if;
  return new;
end;
$$;

create or replace function public.notify_platform_subscription_event()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'expired' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform public.create_platform_notification(
      'expired_subscription', 'Abonnement expiré',
      format('L’abonnement de l’entreprise %s est arrivé à expiration.', new.business_id), 'warning',
      'finance', null, 'business_subscription', new.id, new.id::text || ':' || new.status
    );
  end if;
  return new;
end;
$$;

create or replace function public.notify_platform_incident_event()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform public.create_platform_notification(
    'technical_incident', 'Incident technique', new.title,
    case when new.severity in ('high', 'critical') then 'critical' else 'warning' end,
    'admin', null, 'platform_incident', new.id, new.id::text
  );
  return new;
end;
$$;

create or replace function public.notify_platform_security_event()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.action in ('login_failed', 'access_denied', 'disable', 'delete', 'change_role')
     or new.resource_type ilike '%security%' then
    perform public.create_platform_notification(
      'security_issue', 'Problème de sécurité',
      format('Une action de sécurité (%s) a été enregistrée.', new.action),
      case when new.result = 'failure' or new.action in ('login_failed', 'access_denied') then 'critical' else 'warning' end,
      'admin', null, 'platform_audit', new.id, new.id::text
    );
  end if;
  return new;
end;
$$;

create or replace function public.notify_platform_integration_event()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status in ('unavailable', 'attention') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform public.create_platform_notification(
      'integration_unavailable', 'Intégration indisponible',
      format('L’intégration « %s » nécessite une vérification.', new.name),
      case when new.status = 'unavailable' then 'critical' else 'warning' end,
      'admin', null, 'platform_integration', new.id, new.id::text || ':' || new.status
    );
  end if;
  return new;
end;
$$;

revoke all on function public.create_platform_notification(text, text, text, text, text, uuid, text, uuid, text) from public, anon, authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907270600_platform_notification_unread.sql
-- ============================================================================
create or replace function public.mark_platform_notification_unread(p_notification_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.platform_notifications
    set read_at = null
    where id = p_notification_id
      and (recipient_user_id is null or recipient_user_id = auth.uid());
  perform public.write_platform_audit('mark_unread', 'platform_notification', p_notification_id);
end;
$$;

revoke all on function public.mark_platform_notification_unread(uuid) from public, anon;
grant execute on function public.mark_platform_notification_unread(uuid) to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907270700_platform_notification_delivery.sql
-- ============================================================================
create table if not exists public.platform_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.platform_notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms', 'webhook')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (notification_id, user_id, channel)
);

create index if not exists platform_notification_deliveries_queue_idx
  on public.platform_notification_deliveries(status, next_attempt_at);

alter table public.platform_notification_deliveries enable row level security;

create or replace function public.notification_visible_to_current_admin(p_notification_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.platform_notifications n
    join public.platform_admins pa on pa.user_id = auth.uid() and pa.status = 'active'
    where n.id = p_notification_id
      and (n.recipient_user_id is null or n.recipient_user_id = auth.uid())
      and (n.recipient_role is null or n.recipient_role = pa.role or pa.role = 'super_admin')
  )
$$;

create or replace function public.mark_platform_notification_read(p_notification_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.notification_visible_to_current_admin(p_notification_id) then
    raise exception 'Notification inaccessible.';
  end if;
  update public.platform_notifications set read_at = coalesce(read_at, now())
    where id = p_notification_id;
  perform public.write_platform_audit('mark_read', 'platform_notification', p_notification_id);
end;
$$;

create or replace function public.mark_platform_notification_unread(p_notification_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.notification_visible_to_current_admin(p_notification_id) then
    raise exception 'Notification inaccessible.';
  end if;
  update public.platform_notifications set read_at = null where id = p_notification_id;
  perform public.write_platform_audit('mark_unread', 'platform_notification', p_notification_id);
end;
$$;

create or replace function public.mark_all_platform_notifications_read()
returns integer language plpgsql security definer set search_path = public
as $$
declare changed integer;
begin
  update public.platform_notifications n
    set read_at = now()
    where n.read_at is null and n.archived_at is null
      and public.notification_visible_to_current_admin(n.id);
  get diagnostics changed = row_count;
  perform public.write_platform_audit('mark_all_read', 'platform_notification', null, 'success', jsonb_build_object('count', changed));
  return changed;
end;
$$;

create or replace function public.archive_platform_notification(p_notification_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('notifications') then raise exception 'Accès administrateur requis.'; end if;
  if not public.notification_visible_to_current_admin(p_notification_id) then raise exception 'Notification inaccessible.'; end if;
  update public.platform_notifications set archived_at = now() where id = p_notification_id;
  perform public.write_platform_audit('archive', 'platform_notification', p_notification_id);
end;
$$;

create or replace function public.create_platform_notification(
  p_type text, p_title text, p_message text, p_severity text default 'info',
  p_recipient_role text default null, p_recipient_user_id uuid default null,
  p_resource_type text default null, p_resource_id uuid default null, p_source_event_id text default null
) returns uuid language plpgsql security definer set search_path = public
as $$
declare
  notification_id uuid;
  target record;
begin
  if p_severity not in ('info', 'warning', 'critical') then raise exception 'Gravité de notification invalide.'; end if;
  insert into public.platform_notifications(type, title, message, severity, recipient_role, recipient_user_id, resource_type, resource_id, source_event_id)
  values (p_type, left(p_title, 160), left(p_message, 1000), p_severity, p_recipient_role, p_recipient_user_id, p_resource_type, p_resource_id, p_source_event_id)
  on conflict (type, source_event_id) where source_event_id is not null do nothing
  returning id into notification_id;
  if notification_id is null then return null; end if;

  for target in
    select pa.user_id, p.email_enabled, p.sms_enabled, p.webhook_enabled
    from public.platform_admins pa
    left join public.platform_notification_preferences p
      on p.user_id = pa.user_id and p.notification_type = p_type
    where pa.status = 'active'
      and (p_recipient_user_id is null or pa.user_id = p_recipient_user_id)
      and (p_recipient_role is null or pa.role = p_recipient_role or pa.role = 'super_admin')
      and (p.critical_only is null or not p.critical_only or p_severity = 'critical')
  loop
    if coalesce(target.email_enabled, false) then
      insert into public.platform_notification_deliveries(notification_id, user_id, channel)
      values (notification_id, target.user_id, 'email') on conflict do nothing;
    end if;
    if coalesce(target.sms_enabled, false) then
      insert into public.platform_notification_deliveries(notification_id, user_id, channel)
      values (notification_id, target.user_id, 'sms') on conflict do nothing;
    end if;
    if coalesce(target.webhook_enabled, false) then
      insert into public.platform_notification_deliveries(notification_id, user_id, channel)
      values (notification_id, target.user_id, 'webhook') on conflict do nothing;
    end if;
  end loop;
  return notification_id;
end;
$$;

create or replace function public.list_platform_notifications(
  p_limit integer default 50,
  p_offset integer default 0,
  p_query text default null,
  p_type text default null,
  p_severity text default null,
  p_unread_only boolean default false,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  id uuid, type text, title text, message text, severity text, read_at timestamptz,
  created_at timestamptz, resource_type text, resource_id uuid, archived_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
declare current_role text;
begin
  select pa.role into current_role from public.platform_admins pa
    where pa.user_id = auth.uid() and pa.status = 'active';
  if current_role is null then raise exception 'Accès administrateur requis.'; end if;
  return query
    select n.id, n.type, n.title, n.message, n.severity, n.read_at, n.created_at,
      n.resource_type, n.resource_id, n.archived_at
    from public.platform_notifications n
    where n.archived_at is null
      and (n.recipient_user_id is null or n.recipient_user_id = auth.uid())
      and (n.recipient_role is null or n.recipient_role = current_role or current_role = 'super_admin')
      and coalesce((select p.in_app_enabled from public.platform_notification_preferences p
        where p.user_id = auth.uid() and p.notification_type = n.type), true)
      and (p_query is null or concat_ws(' ', n.type, n.title, n.message) ilike '%' || p_query || '%')
      and (p_type is null or n.type = p_type)
      and (p_severity is null or n.severity = p_severity)
      and (not p_unread_only or n.read_at is null)
      and (p_from is null or n.created_at >= p_from)
      and (p_to is null or n.created_at < p_to)
    order by n.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.claim_platform_notification_deliveries(p_limit integer default 25)
returns setof public.platform_notification_deliveries
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('notifications') then raise exception 'Accès administrateur requis.'; end if;
  return query
    update public.platform_notification_deliveries d
    set status = 'processing', attempts = d.attempts + 1
    where d.id in (
      select q.id from public.platform_notification_deliveries q
      where q.status in ('pending', 'failed') and q.next_attempt_at <= now()
      order by q.next_attempt_at
      limit greatest(1, least(p_limit, 100))
      for update skip locked
    )
    returning d.*;
end;
$$;

revoke all on function public.claim_platform_notification_deliveries(integer) from public, anon, authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907280000_platform_users_audit_completion.sql
-- ============================================================================
drop function if exists public.list_platform_users_detailed(integer, integer, text, text, uuid, text, text);
create or replace function public.list_platform_users_detailed(
  p_limit integer default 50,
  p_offset integer default 0,
  p_query text default null,
  p_status text default null,
  p_business_id uuid default null,
  p_role text default null,
  p_plan text default null
)
returns table (
  user_id uuid, first_name text, last_name text, full_name text, email text, phone text, avatar_url text,
  business_id uuid, business_name text, business_plan text, business_role text, platform_role text,
  account_status text, created_at timestamptz, last_sign_in_at timestamptz, last_activity_at timestamptz,
  connection_count bigint
)
language plpgsql stable security definer set search_path = public
as $$
declare q text := lower(trim(coalesce(p_query, '')));
begin
  if not public.has_platform_admin_permission('users') then raise exception 'Accès administrateur requis.'; end if;
  return query
    with memberships as (
      select m.user_id, m.business_id, m.role,
        row_number() over (partition by m.user_id order by m.created_at) as rank
      from public.business_members m
    ), activity as (
      select l.actor_id, max(l.created_at) as last_activity_at
      from public.platform_audit_logs l
      group by l.actor_id
    )
    select u.id,
      split_part(coalesce(u.raw_user_meta_data->>'full_name', ''), ' ', 1),
      nullif(regexp_replace(coalesce(u.raw_user_meta_data->>'full_name', ''), '^[^ ]+ ?', ''), ''),
      nullif(u.raw_user_meta_data->>'full_name', ''),
      u.email::text,
      coalesce(u.raw_user_meta_data->>'phone', u.phone::text),
      u.raw_user_meta_data->>'avatar_url',
      coalesce(m.business_id, b.id),
      coalesce(bm.name, b.name),
      coalesce(bs.plan, 'free'),
      case when b.owner_id = u.id then 'owner' else coalesce(m.role, 'none') end,
      pa.role,
      case when u.banned_until is not null and u.banned_until > now() then 'disabled' else 'active' end,
      u.created_at,
      u.last_sign_in_at,
      greatest(u.last_sign_in_at, activity.last_activity_at),
      0::bigint
    from auth.users u
    left join memberships m on m.user_id = u.id and m.rank = 1
    left join public.businesses b on b.owner_id = u.id
    left join public.businesses bm on bm.id = m.business_id
    left join public.business_subscriptions bs on bs.business_id = coalesce(m.business_id, b.id)
    left join public.platform_admins pa on pa.user_id = u.id
    left join activity on activity.actor_id = u.id
    where (q = '' or lower(concat_ws(' ', u.raw_user_meta_data->>'full_name', u.email::text)) like '%' || q || '%')
      and (p_status is null or p_status = '' or (p_status = 'disabled' and u.banned_until is not null and u.banned_until > now()) or (p_status = 'active' and (u.banned_until is null or u.banned_until <= now())))
      and (p_business_id is null or coalesce(m.business_id, b.id) = p_business_id)
      and (p_role is null or p_role = '' or case when b.owner_id = u.id then 'owner' else coalesce(m.role, 'none') end = p_role)
      and (p_plan is null or p_plan = '' or coalesce(bs.plan, 'free') = p_plan)
    order by u.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.get_platform_user_detail(p_user_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare result jsonb;
begin
  if not public.has_platform_admin_permission('users') then raise exception 'Accès administrateur requis.'; end if;
  select jsonb_build_object(
    'user_id', u.id,
    'first_name', split_part(coalesce(u.raw_user_meta_data->>'full_name', ''), ' ', 1),
    'last_name', nullif(regexp_replace(coalesce(u.raw_user_meta_data->>'full_name', ''), '^[^ ]+ ?', ''), ''),
    'full_name', u.raw_user_meta_data->>'full_name',
    'email', u.email,
    'phone', coalesce(u.raw_user_meta_data->>'phone', u.phone::text),
    'avatar_url', u.raw_user_meta_data->>'avatar_url',
    'created_at', u.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'last_activity_at', (select max(l.created_at) from public.platform_audit_logs l where l.actor_id = u.id),
    'connection_count', 0,
    'status', case when u.banned_until is not null and u.banned_until > now() then 'disabled' else 'active' end,
    'platform_role', pa.role,
    'businesses', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'role', x.role, 'plan', x.plan))
      from (select b.id, b.name, 'owner' as role, coalesce(bs.plan, 'free') as plan from public.businesses b left join public.business_subscriptions bs on bs.business_id = b.id where b.owner_id = u.id
            union all select b.id, b.name, m.role, coalesce(bs.plan, 'free') from public.business_members m join public.businesses b on b.id = m.business_id left join public.business_subscriptions bs on bs.business_id = b.id where m.user_id = u.id) x), '[]'::jsonb),
    'tickets', coalesce((select jsonb_agg(t) from (select id, subject, priority, status, created_at from public.support_tickets where user_id = u.id order by created_at desc limit 10) t), '[]'::jsonb),
    'activity', coalesce((select jsonb_agg(a) from (select action, resource_type, result, created_at from public.platform_audit_logs where actor_id = u.id order by created_at desc limit 20) a), '[]'::jsonb)
  ) into result
  from auth.users u left join public.platform_admins pa on pa.user_id = u.id where u.id = p_user_id;
  if result is null then raise exception 'Utilisateur introuvable.'; end if;
  return result;
end;
$$;

revoke all on function public.list_platform_users_detailed(integer, integer, text, text, uuid, text, text) from public, anon;
revoke all on function public.get_platform_user_detail(uuid) from public, anon;
grant execute on function public.list_platform_users_detailed(integer, integer, text, text, uuid, text, text) to authenticated;
grant execute on function public.get_platform_user_detail(uuid) to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907290000_platform_user_delete.sql
-- ============================================================================
create or replace function public.delete_platform_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('user_management') then
    raise exception 'Permission insuffisante pour supprimer un utilisateur.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Vous ne pouvez pas supprimer votre propre compte administrateur.';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Utilisateur introuvable.';
  end if;
  perform public.write_platform_audit('delete', 'platform_user', p_user_id);
  delete from auth.users where id = p_user_id;
end;
$$;

revoke all on function public.delete_platform_user(uuid) from public, anon;
grant execute on function public.delete_platform_user(uuid) to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907295000_public_content_access.sql
-- ============================================================================
create or replace function public.list_public_content(p_content_type text default null)
returns table (id uuid, content_type text, slug text, title text, body text, status text, updated_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select c.id, c.content_type, c.slug, c.title, c.body, c.status, c.updated_at
  from public.platform_content c
  where c.status = 'published'
    and (p_content_type is null or c.content_type = p_content_type)
  order by c.updated_at desc
$$;

create or replace function public.upsert_platform_content(
  p_id uuid, p_content_type text, p_slug text, p_title text, p_body text, p_status text
) returns uuid language plpgsql security definer set search_path = public
as $$
declare content_id uuid;
begin
  if not public.has_platform_admin_permission('content') then raise exception 'Accès administrateur requis.'; end if;
  if p_content_type not in ('faq', 'feature', 'plan', 'announcement', 'article', 'resource') then
    raise exception 'Type de contenu invalide.';
  end if;
  if p_status not in ('draft', 'published', 'archived') then raise exception 'Statut de contenu invalide.'; end if;
  if nullif(trim(p_title), '') is null or nullif(trim(p_slug), '') is null then raise exception 'Titre et identifiant obligatoires.'; end if;
  insert into public.platform_content(id, content_type, slug, title, body, status, updated_by, updated_at)
  values (coalesce(p_id, gen_random_uuid()), trim(p_content_type), trim(p_slug), trim(p_title), coalesce(p_body, ''), p_status, auth.uid(), now())
  on conflict (id) do update set content_type = excluded.content_type, slug = excluded.slug, title = excluded.title,
    body = excluded.body, status = excluded.status, updated_by = auth.uid(), updated_at = now()
  returning id into content_id;
  perform public.write_platform_audit(case when p_id is null then 'create' else 'update' end, 'platform_content', content_id);
  return content_id;
end;
$$;

revoke all on function public.list_public_content(text) from public;
grant execute on function public.list_public_content(text) to anon, authenticated;
revoke all on function public.upsert_platform_content(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.upsert_platform_content(uuid, text, text, text, text, text) to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907296000_validate_platform_content_types.sql
-- ============================================================================
create or replace function public.upsert_platform_content(
  p_id uuid, p_content_type text, p_slug text, p_title text, p_body text, p_status text
) returns uuid language plpgsql security definer set search_path = public
as $$
declare
  content_id uuid;
  normalized_type text := lower(trim(coalesce(p_content_type, '')));
  normalized_status text := lower(trim(coalesce(p_status, '')));
begin
  if not public.has_platform_admin_permission('content') then
    raise exception 'Accès administrateur requis.';
  end if;
  if normalized_type not in ('faq', 'feature', 'plan', 'announcement', 'article', 'resource') then
    raise exception 'Type de contenu invalide.';
  end if;
  if normalized_status not in ('draft', 'published', 'archived') then
    raise exception 'Statut de contenu invalide.';
  end if;
  if nullif(trim(p_title), '') is null or nullif(trim(p_slug), '') is null then
    raise exception 'Titre et identifiant obligatoires.';
  end if;
  insert into public.platform_content(id, content_type, slug, title, body, status, updated_by, updated_at)
  values (coalesce(p_id, gen_random_uuid()), normalized_type, trim(p_slug), trim(p_title), coalesce(p_body, ''), normalized_status, auth.uid(), now())
  on conflict (id) do update set
    content_type = excluded.content_type,
    slug = excluded.slug,
    title = excluded.title,
    body = excluded.body,
    status = excluded.status,
    updated_by = auth.uid(),
    updated_at = now()
  returning id into content_id;
  perform public.write_platform_audit(case when p_id is null then 'create' else 'update' end, 'platform_content', content_id);
  return content_id;
end;
$$;

revoke all on function public.upsert_platform_content(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.upsert_platform_content(uuid, text, text, text, text, text) to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907297000_public_site_editor.sql
-- ============================================================================
create or replace function public.get_public_site_config()
returns jsonb language sql stable security definer set search_path = public
as $$
  select coalesce(value::jsonb, '{}'::jsonb)
  from public.platform_settings
  where key = 'public_site_config'
$$;

create or replace function public.update_public_site_config(p_config jsonb)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.platform_admins
    where user_id = auth.uid() and role = 'super_admin'
  ) then
    raise exception 'Accès réservé au super administrateur.';
  end if;
  if jsonb_typeof(p_config) <> 'object' then
    raise exception 'Configuration publique invalide.';
  end if;
  insert into public.platform_settings(key, value, updated_by, updated_at)
  values ('public_site_config', p_config::text, auth.uid(), now())
  on conflict (key) do update set value = excluded.value, updated_by = auth.uid(), updated_at = now();
  perform public.write_platform_audit('update', 'public_site_config', null, 'success');
end;
$$;

revoke all on function public.get_public_site_config() from public, authenticated;
grant execute on function public.get_public_site_config() to anon, authenticated;
revoke all on function public.update_public_site_config(jsonb) from public, anon;
grant execute on function public.update_public_site_config(jsonb) to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907298000_platform_health_checks.sql
-- ============================================================================
create or replace function public.check_platform_health()
returns table (
  service_key text,
  service_name text,
  status text,
  detail text,
  checked_at timestamptz,
  latency_ms integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  checked timestamptz := clock_timestamp();
  payment_status text;
  email_status text;
begin
  if not public.has_platform_admin_permission('overview') then
    raise exception 'Accès administrateur requis.';
  end if;

  select i.status into payment_status
  from public.platform_integrations i
  where i.service_type = 'payment'
  order by i.name
  limit 1;

  select i.status into email_status
  from public.platform_integrations i
  where i.service_type = 'email'
  order by i.name
  limit 1;

  return query values
    ('application', 'Application FactureFacile', 'operational', 'L’application web répond à la vérification de la plateforme.', checked, 1),
    ('postgresql', 'PostgreSQL', 'operational', 'La base de données et les fonctions de contrôle sont accessibles.', checked, 1),
    ('storage', 'Stockage', case when to_regclass('storage.objects') is not null then 'operational' else 'incident' end,
      case when to_regclass('storage.objects') is not null then 'Le stockage Supabase est disponible.' else 'La table de stockage Supabase est introuvable.' end, checked, 1),
    ('pdf', 'Génération PDF', 'operational', 'Le module de génération de documents est disponible dans l’application.', checked, 1),
    ('email', 'Service e-mail', case when coalesce(email_status, 'not_configured') in ('connected', 'operational') then 'operational' when email_status = 'unavailable' then 'incident' else 'attention' end,
      case when coalesce(email_status, 'not_configured') in ('connected', 'operational') then 'Le prestataire e-mail est opérationnel.' when email_status = 'unavailable' then 'Le prestataire e-mail est indisponible.' else 'Le prestataire e-mail nécessite une configuration ou une vérification.' end, checked, null),
    ('payment', 'Service de paiement', case when coalesce(payment_status, 'not_configured') in ('connected', 'operational') then 'operational' when payment_status = 'unavailable' then 'incident' else 'attention' end,
      case when coalesce(payment_status, 'not_configured') in ('connected', 'operational') then 'Le prestataire de paiement est opérationnel.' when payment_status = 'unavailable' then 'Le prestataire de paiement est indisponible.' else 'Le prestataire de paiement nécessite une configuration ou une vérification.' end, checked, null),
    ('api', 'API', 'operational', 'Les fonctions RPC protégées répondent côté Supabase.', checked, 1),
    ('notifications', 'Notifications', case when to_regclass('public.platform_notifications') is not null then 'operational' else 'incident' end,
      case when to_regclass('public.platform_notifications') is not null then 'Le centre de notifications est disponible.' else 'Le système de notifications est introuvable.' end, checked, 1);
end;
$$;

revoke all on function public.check_platform_health() from public, anon;
grant execute on function public.check_platform_health() to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260907299000_platform_incident_reports.sql
-- ============================================================================
alter table public.platform_incidents
  add column if not exists root_cause text,
  add column if not exists resolution_summary text,
  add column if not exists prevention_actions text;

drop function if exists public.list_platform_incidents(integer, integer);
create or replace function public.list_platform_incidents(p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid, title text, description text, service text, severity text, status text,
  owner_id uuid, owner_email text, started_at timestamptz, resolved_at timestamptz,
  root_cause text, resolution_summary text, prevention_actions text
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('incidents') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select i.id, i.title, i.description, i.service, i.severity, i.status, i.owner_id,
      u.email::text, i.started_at, i.resolved_at, i.root_cause, i.resolution_summary, i.prevention_actions
    from public.platform_incidents i
    left join auth.users u on u.id = i.owner_id
    order by i.started_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.update_platform_incident_report(
  p_incident_id uuid, p_root_cause text, p_resolution_summary text, p_prevention_actions text
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('incidents') then raise exception 'Accès administrateur requis.'; end if;
  if nullif(trim(coalesce(p_root_cause, '')), '') is null
    or nullif(trim(coalesce(p_resolution_summary, '')), '') is null
    or nullif(trim(coalesce(p_prevention_actions, '')), '') is null then
    raise exception 'Le compte rendu doit contenir la cause, la résolution et les actions préventives.';
  end if;
  update public.platform_incidents
    set root_cause = trim(p_root_cause), resolution_summary = trim(p_resolution_summary),
        prevention_actions = trim(p_prevention_actions)
    where id = p_incident_id;
  if not found then raise exception 'Incident introuvable.'; end if;
  perform public.write_platform_audit('update_report', 'platform_incident', p_incident_id);
end;
$$;

revoke all on function public.list_platform_incidents(integer, integer) from public, anon;
revoke all on function public.update_platform_incident_report(uuid, text, text, text) from public, anon;
grant execute on function public.list_platform_incidents(integer, integer) to authenticated;
grant execute on function public.update_platform_incident_report(uuid, text, text, text) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260907300000_platform_user_detail_safe_rpc.sql
-- ============================================================================
create or replace function public.get_platform_user_detail(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare result jsonb;
begin
  if not public.has_platform_admin_permission('users') then
    raise exception 'Accès administrateur requis.';
  end if;
  select jsonb_build_object(
    'user_id', u.id,
    'first_name', split_part(coalesce(u.raw_user_meta_data->>'full_name', ''), ' ', 1),
    'last_name', nullif(regexp_replace(coalesce(u.raw_user_meta_data->>'full_name', ''), '^[^ ]+ ?', ''), ''),
    'full_name', nullif(u.raw_user_meta_data->>'full_name', ''),
    'email', u.email::text,
    'phone', coalesce(u.raw_user_meta_data->>'phone', u.phone::text),
    'avatar_url', u.raw_user_meta_data->>'avatar_url',
    'created_at', u.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'last_activity_at', (select max(l.created_at) from public.platform_audit_logs l where l.actor_id = u.id),
    'connection_count', 0,
    'status', case when u.banned_until is not null and u.banned_until > now() then 'disabled' else 'active' end,
    'platform_role', pa.role,
    'businesses', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'role', x.role, 'plan', x.plan))
      from (
        select b.id, b.name, 'owner'::text as role, coalesce(bs.plan, 'free')::text as plan
        from public.businesses b left join public.business_subscriptions bs on bs.business_id = b.id where b.owner_id = u.id
        union all
        select b.id, b.name, m.role::text, coalesce(bs.plan, 'free')::text
        from public.business_members m join public.businesses b on b.id = m.business_id
        left join public.business_subscriptions bs on bs.business_id = b.id where m.user_id = u.id
      ) x
    ), '[]'::jsonb),
    'tickets', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'subject', t.subject, 'priority', t.priority, 'status', t.status, 'created_at', t.created_at))
      from (select id, subject, priority, status, created_at from public.support_tickets where user_id = u.id order by created_at desc limit 10) t
    ), '[]'::jsonb),
    'activity', coalesce((
      select jsonb_agg(jsonb_build_object('action', a.action, 'resource_type', a.resource_type, 'result', a.result, 'created_at', a.created_at))
      from (select action, resource_type, result, created_at from public.platform_audit_logs where actor_id = u.id order by created_at desc limit 20) a
    ), '[]'::jsonb)
  ) into result
  from auth.users u
  left join public.platform_admins pa on pa.user_id = u.id
  where u.id = p_user_id;
  if result is null then raise exception 'Utilisateur introuvable.'; end if;
  return result;
end;
$$;

revoke all on function public.get_platform_user_detail(uuid) from public, anon;
grant execute on function public.get_platform_user_detail(uuid) to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907301000_platform_global_search_complete.sql
-- ============================================================================
create or replace function public.search_platform_global(p_query text, p_limit integer default 20)
returns table (category text, label text, resource_id uuid)
language plpgsql stable security definer set search_path = public
as $$
declare
  q text := lower(trim(coalesce(p_query, '')));
  result_limit integer := greatest(1, least(coalesce(p_limit, 20), 20));
begin
  if length(q) < 2 then return; end if;

  if public.has_platform_admin_permission('businesses') then
    return query
      select 'Entreprise', b.name, b.id
      from public.businesses b
      where lower(coalesce(b.name, '')) like '%' || q || '%'
      order by b.name
      limit result_limit;
  end if;

  if public.has_platform_admin_permission('users') then
    return query
      select 'Utilisateur', coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), u.email::text), u.id
      from auth.users u
      where lower(coalesce(u.email::text, '') || ' ' || coalesce(u.raw_user_meta_data->>'full_name', '')) like '%' || q || '%'
      order by coalesce(u.raw_user_meta_data->>'full_name', u.email::text)
      limit result_limit;
  end if;

  if public.has_platform_admin_permission('subscriptions') then
    return query
      select 'Abonnement', b.name || ' · ' || s.plan || ' · ' || s.status, s.id
      from public.business_subscriptions s
      join public.businesses b on b.id = s.business_id
      where lower(b.name || ' ' || s.plan || ' ' || s.status) like '%' || q || '%'
      order by s.created_at desc
      limit result_limit;
  end if;

  if public.has_platform_admin_permission('subscription_payments') then
    return query
      select 'Transaction', '#' || left(p.id::text, 8) || ' · ' || b.name || ' · ' || p.status, p.id
      from public.subscription_payments p
      join public.businesses b on b.id = p.business_id
      where lower(p.id::text || ' ' || b.name || ' ' || p.provider || ' ' || p.status) like '%' || q || '%'
      order by p.created_at desc
      limit result_limit;
  end if;

  if public.has_platform_admin_permission('support') then
    return query
      select 'Ticket', t.subject, t.id
      from public.support_tickets t
      where lower(coalesce(t.subject, '')) like '%' || q || '%'
      order by t.updated_at desc
      limit result_limit;
  end if;

  if public.has_platform_admin_permission('incidents') then
    return query
      select 'Incident', i.title || ' · ' || i.service, i.id
      from public.platform_incidents i
      where lower(coalesce(i.title, '') || ' ' || coalesce(i.description, '') || ' ' || coalesce(i.service, '')) like '%' || q || '%'
      order by i.started_at desc
      limit result_limit;
  end if;
end;
$$;

revoke all on function public.search_platform_global(text, integer) from public, anon;
grant execute on function public.search_platform_global(text, integer) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260907302000_platform_global_search_fields.sql
-- ============================================================================
create or replace function public.search_platform_global(p_query text, p_limit integer default 20)
returns table (category text, label text, resource_id uuid)
language plpgsql stable security definer set search_path = public
as $$
declare
  q text := lower(trim(coalesce(p_query, '')));
  result_limit integer := greatest(1, least(coalesce(p_limit, 20), 20));
begin
  if length(q) < 2 then return; end if;

  if public.has_platform_admin_permission('businesses') then
    return query
      select 'Entreprise', b.name, b.id from public.businesses b
      where lower(coalesce(b.name, '')) like '%' || q || '%' order by b.name limit result_limit;
  end if;
  if public.has_platform_admin_permission('users') then
    return query
      select 'Utilisateur', coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), u.email::text), u.id
      from auth.users u
      where lower(coalesce(u.email::text, '') || ' ' || coalesce(u.raw_user_meta_data->>'full_name', '')) like '%' || q || '%'
      order by coalesce(u.raw_user_meta_data->>'full_name', u.email::text) limit result_limit;
  end if;
  if public.has_platform_admin_permission('subscriptions') then
    return query
      select 'Abonnement', b.name || ' · ' || s.plan || ' · ' || s.status, s.id
      from public.business_subscriptions s join public.businesses b on b.id = s.business_id
      where lower(b.name || ' ' || s.plan || ' ' || s.status) like '%' || q || '%'
      order by s.created_at desc limit result_limit;
  end if;
  if public.has_platform_admin_permission('subscription_payments') then
    return query
      select 'Transaction', '#' || left(p.id::text, 8) || ' · ' || b.name || ' · ' || p.status, p.id
      from public.subscription_payments p join public.businesses b on b.id = p.business_id
      where lower(p.id::text || ' ' || b.name || ' ' || p.provider || ' ' || p.status || ' ' || p.plan || ' ' || p.currency || ' ' || p.amount::text) like '%' || q || '%'
      order by p.created_at desc limit result_limit;
  end if;
  if public.has_platform_admin_permission('support') then
    return query
      select 'Ticket', '#' || left(t.id::text, 8) || ' · ' || t.subject, t.id
      from public.support_tickets t
      where lower(t.id::text || ' ' || coalesce(t.subject, '')) like '%' || q || '%'
      order by t.updated_at desc limit result_limit;
  end if;
  if public.has_platform_admin_permission('incidents') then
    return query
      select 'Incident', i.title || ' · ' || i.service, i.id
      from public.platform_incidents i
      where lower(coalesce(i.title, '') || ' ' || coalesce(i.description, '') || ' ' || coalesce(i.service, '') || ' ' || i.id::text) like '%' || q || '%'
      order by i.started_at desc limit result_limit;
  end if;
end;
$$;

revoke all on function public.search_platform_global(text, integer) from public, anon;
grant execute on function public.search_platform_global(text, integer) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260907304000_platform_admin_profile.sql
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('admin-avatars', 'admin-avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "admin avatars are publicly readable" on storage.objects;
drop policy if exists "admin avatars are publicly readable" on storage.objects;
create policy "admin avatars are publicly readable" on storage.objects
  for select using (bucket_id = 'admin-avatars');

drop policy if exists "admins upload own avatar" on storage.objects;
drop policy if exists "admins upload own avatar" on storage.objects;
create policy "admins upload own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'admin-avatars' and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.platform_admins where user_id = auth.uid()));

drop policy if exists "admins update own avatar" on storage.objects;
drop policy if exists "admins update own avatar" on storage.objects;
create policy "admins update own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'admin-avatars' and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.platform_admins where user_id = auth.uid()))
  with check (bucket_id = 'admin-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.get_platform_admin_profile()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare result jsonb;
begin
  if not exists (select 1 from public.platform_admins where user_id = auth.uid()) then
    raise exception 'Accès administrateur requis.';
  end if;
  select jsonb_build_object(
    'full_name', coalesce(u.raw_user_meta_data->>'full_name', ''),
    'first_name', split_part(coalesce(u.raw_user_meta_data->>'full_name', ''), ' ', 1),
    'last_name', nullif(regexp_replace(coalesce(u.raw_user_meta_data->>'full_name', ''), '^[^ ]+ ?', ''), ''),
    'email', u.email::text,
    'avatar_url', u.raw_user_meta_data->>'avatar_url',
    'last_sign_in_at', u.last_sign_in_at,
    'sessions', coalesce((select jsonb_agg(jsonb_build_object(
      'created_at', recent.created_at, 'updated_at', recent.updated_at,
      'user_agent', recent.user_agent, 'ip', recent.ip::text
    ) order by recent.updated_at desc) from (
      select s.created_at, s.updated_at, s.user_agent, s.ip
      from auth.sessions s
      where s.user_id = u.id
      order by s.updated_at desc
      limit 10
    ) recent), '[]'::jsonb)
  ) into result
  from auth.users u where u.id = auth.uid();
  return result;
end;
$$;

revoke all on function public.get_platform_admin_profile() from public, anon;
grant execute on function public.get_platform_admin_profile() to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260907310000_platform_user_detail_rpc_fix.sql
-- ============================================================================
create or replace function public.get_platform_user_detail(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare result jsonb;
begin
  if not public.has_platform_admin_permission('users') then
    raise exception 'Accès administrateur requis.';
  end if;

  select jsonb_build_object(
    'user_id', u.id,
    'first_name', split_part(coalesce(u.raw_user_meta_data->>'full_name', ''), ' ', 1),
    'last_name', nullif(regexp_replace(coalesce(u.raw_user_meta_data->>'full_name', ''), '^[^ ]+ ?', ''), ''),
    'full_name', nullif(u.raw_user_meta_data->>'full_name', ''),
    'email', u.email::text,
    'phone', u.raw_user_meta_data->>'phone',
    'avatar_url', u.raw_user_meta_data->>'avatar_url',
    'created_at', u.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'last_activity_at', (select max(l.created_at) from public.platform_audit_logs l where l.actor_id = u.id),
    'connection_count', 0,
    'status', case when u.banned_until is not null and u.banned_until > now() then 'disabled' else 'active' end,
    'platform_role', pa.role,
    'businesses', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'role', 'owner', 'plan', coalesce(bs.plan, 'free')))
      from public.businesses b
      left join public.business_subscriptions bs on bs.business_id = b.id
      where b.owner_id = u.id
    ), '[]'::jsonb),
    'tickets', '[]'::jsonb,
    'activity', '[]'::jsonb
  )
  into result
  from auth.users u
  left join public.platform_admins pa on pa.user_id = u.id
  where u.id = p_user_id;

  if result is null then raise exception 'Utilisateur introuvable.'; end if;
  return result;
end;
$$;

revoke all on function public.get_platform_user_detail(uuid) from public, anon;
grant execute on function public.get_platform_user_detail(uuid) to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907320000_platform_users_exclude_admins.sql
-- ============================================================================
drop function if exists public.list_platform_users_detailed(integer, integer, text, text, uuid, text, text);
create or replace function public.list_platform_users_detailed(
  p_limit integer default 50, p_offset integer default 0, p_query text default null,
  p_status text default null, p_business_id uuid default null, p_role text default null, p_plan text default null
)
returns table (
  user_id uuid, first_name text, last_name text, full_name text, email text, phone text, avatar_url text,
  business_id uuid, business_name text, business_plan text, business_role text, platform_role text,
  account_status text, created_at timestamptz, last_sign_in_at timestamptz, last_activity_at timestamptz, connection_count bigint
)
language plpgsql stable security definer set search_path = public
as $$
declare q text := lower(trim(coalesce(p_query, '')));
begin
  if not public.has_platform_admin_permission('users') then raise exception 'Accès administrateur requis.'; end if;
  return query
    with memberships as (
      select m.user_id, m.business_id, m.role, row_number() over (partition by m.user_id order by m.created_at) as rank
      from public.business_members m
    ), activity as (
      select l.actor_id, max(l.created_at) as last_activity_at from public.platform_audit_logs l group by l.actor_id
    )
    select u.id, split_part(coalesce(u.raw_user_meta_data->>'full_name', ''), ' ', 1),
      nullif(regexp_replace(coalesce(u.raw_user_meta_data->>'full_name', ''), '^[^ ]+ ?', ''), ''),
      nullif(u.raw_user_meta_data->>'full_name', ''), u.email::text,
      u.raw_user_meta_data->>'phone', u.raw_user_meta_data->>'avatar_url',
      coalesce(m.business_id, b.id), coalesce(bm.name, b.name), coalesce(bs.plan, 'free'),
      case when b.owner_id = u.id then 'owner' else coalesce(m.role, 'none') end, pa.role,
      case when u.banned_until is not null and u.banned_until > now() then 'disabled' else 'active' end,
      u.created_at, u.last_sign_in_at, greatest(u.last_sign_in_at, activity.last_activity_at), 0::bigint
    from auth.users u
    left join memberships m on m.user_id = u.id and m.rank = 1
    left join public.businesses b on b.owner_id = u.id
    left join public.businesses bm on bm.id = m.business_id
    left join public.business_subscriptions bs on bs.business_id = coalesce(m.business_id, b.id)
    left join public.platform_admins pa on pa.user_id = u.id
    left join activity on activity.actor_id = u.id
    where pa.user_id is null
      and (q = '' or lower(concat_ws(' ', u.raw_user_meta_data->>'full_name', u.email::text)) like '%' || q || '%')
      and (p_status is null or p_status = '' or (p_status = 'disabled' and u.banned_until is not null and u.banned_until > now()) or (p_status = 'active' and (u.banned_until is null or u.banned_until <= now())))
      and (p_business_id is null or coalesce(m.business_id, b.id) = p_business_id)
      and (p_role is null or p_role = '' or case when b.owner_id = u.id then 'owner' else coalesce(m.role, 'none') end = p_role)
      and (p_plan is null or p_plan = '' or coalesce(bs.plan, 'free') = p_plan)
    order by u.created_at desc limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

revoke all on function public.list_platform_users_detailed(integer, integer, text, text, uuid, text, text) from public, anon;
grant execute on function public.list_platform_users_detailed(integer, integer, text, text, uuid, text, text) to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907330000_platform_businesses_module.sql
-- ============================================================================
alter table public.businesses add column if not exists sector text;
alter table public.businesses add column if not exists platform_status text not null default 'active';
alter table public.businesses drop constraint if exists businesses_platform_status_check;
alter table public.businesses add constraint businesses_platform_status_check check (platform_status in ('active', 'inactive', 'suspended', 'pending', 'archived'));

drop function if exists public.list_platform_businesses_detailed(integer, integer);
create or replace function public.list_platform_businesses_detailed(p_limit integer default 100, p_offset integer default 0)
returns table (
  id uuid, name text, sector text, owner_id uuid, owner_email text, user_count bigint, plan text,
  subscription_status text, account_status text, created_at timestamptz, last_activity_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('businesses') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select b.id, b.name, b.sector, b.owner_id, u.email::text,
      1 + (select count(*) from public.business_members m where m.business_id = b.id),
      coalesce(bs.plan, 'free'), coalesce(bs.status, 'active'), b.platform_status, b.created_at,
      greatest(b.updated_at, bs.updated_at, (select max(l.created_at) from public.platform_audit_logs l where l.resource_id = b.id))
    from public.businesses b
    left join auth.users u on u.id = b.owner_id
    left join public.business_subscriptions bs on bs.business_id = b.id
    order by b.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.get_platform_business_detail(p_business_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare result jsonb;
begin
  if not public.has_platform_admin_permission('businesses') then raise exception 'Accès administrateur requis.'; end if;
  select jsonb_build_object(
    'id', b.id, 'name', b.name, 'sector', b.sector, 'owner_id', b.owner_id, 'owner_email', owner_user.email,
    'user_count', 1 + (select count(*) from public.business_members m where m.business_id = b.id),
    'plan', coalesce(bs.plan, 'free'), 'subscription_status', coalesce(bs.status, 'active'), 'account_status', b.platform_status,
    'created_at', b.created_at, 'last_activity_at', greatest(b.updated_at, bs.updated_at),
    'logo_url', b.logo_url, 'phone', b.phone, 'email', b.email, 'address', b.address, 'city', b.city, 'country', b.country,
    'users', coalesce((select jsonb_agg(jsonb_build_object('user_id', x.user_id, 'email', x.email, 'name', x.name, 'role', x.role)) from (
      select b.owner_id as user_id, owner_user.email::text, owner_user.raw_user_meta_data->>'full_name' as name, 'owner'::text as role
      union all select m.user_id, member_user.email::text, member_user.raw_user_meta_data->>'full_name', m.role from public.business_members m join auth.users member_user on member_user.id = m.user_id where m.business_id = b.id
    ) x), '[]'::jsonb),
    'subscription', case when bs.id is null then null else jsonb_build_object('plan', bs.plan, 'status', bs.status, 'created_at', bs.created_at, 'expires_at', bs.expires_at) end,
    'activity', jsonb_build_object('invoices', (select count(*) from public.invoices i where i.business_id = b.id), 'clients', (select count(*) from public.clients c where c.business_id = b.id), 'products', (select count(*) from public.products p where p.business_id = b.id), 'last_activity_at', greatest(b.updated_at, bs.updated_at)),
    'tickets', coalesce((select jsonb_agg(t) from (select id, subject, status, priority, created_at from public.support_tickets where business_id = b.id order by created_at desc limit 20) t), '[]'::jsonb),
    'audit', coalesce((select jsonb_agg(a) from (select action, resource_type, result, created_at from public.platform_audit_logs where resource_id = b.id order by created_at desc limit 30) a), '[]'::jsonb)
  ) into result
  from public.businesses b
  left join auth.users owner_user on owner_user.id = b.owner_id
  left join public.business_subscriptions bs on bs.business_id = b.id
  where b.id = p_business_id;
  if result is null then raise exception 'Entreprise introuvable.'; end if;
  return result;
end;
$$;

create or replace function public.set_platform_business_status(p_business_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('businesses') then raise exception 'Accès administrateur requis.'; end if;
  if p_status not in ('active', 'inactive', 'suspended', 'pending', 'archived') then raise exception 'Statut invalide.'; end if;
  update public.businesses set platform_status = p_status, updated_at = now() where id = p_business_id;
  if not found then raise exception 'Entreprise introuvable.'; end if;
  perform public.write_platform_audit('update_status', 'business', p_business_id, 'success', jsonb_build_object('status', p_status));
end;
$$;

revoke all on function public.list_platform_businesses_detailed(integer, integer) from public, anon;
revoke all on function public.get_platform_business_detail(uuid) from public, anon;
revoke all on function public.set_platform_business_status(uuid, text) from public, anon;
grant execute on function public.list_platform_businesses_detailed(integer, integer) to authenticated;
grant execute on function public.get_platform_business_detail(uuid) to authenticated;
grant execute on function public.set_platform_business_status(uuid, text) to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907340000_platform_business_detail_rpc_fix.sql
-- ============================================================================
create or replace function public.get_platform_business_detail(p_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare result jsonb;
begin
  if not public.has_platform_admin_permission('businesses') then
    raise exception 'Accès administrateur requis.';
  end if;
  select jsonb_build_object(
    'id', b.id,
    'name', b.name,
    'sector', b.sector,
    'owner_id', b.owner_id,
    'owner_email', owner_user.email::text,
    'user_count', 1 + (select count(*) from public.business_members m where m.business_id = b.id),
    'plan', coalesce(bs.plan, 'free'),
    'subscription_status', coalesce(bs.status, 'active'),
    'account_status', b.platform_status,
    'created_at', b.created_at,
    'last_activity_at', b.updated_at,
    'logo_url', b.logo_url,
    'phone', b.phone,
    'email', b.email,
    'address', b.address,
    'city', b.city,
    'country', b.country,
    'users', coalesce((
      select jsonb_agg(x.item)
      from (
        select jsonb_build_object('user_id', b.owner_id, 'email', owner_user.email::text, 'name', owner_user.raw_user_meta_data->>'full_name', 'role', 'owner') as item
        union all
        select jsonb_build_object('user_id', m.user_id, 'email', member_user.email::text, 'name', member_user.raw_user_meta_data->>'full_name', 'role', m.role)
        from public.business_members m
        left join auth.users member_user on member_user.id = m.user_id
        where m.business_id = b.id
      ) x
    ), '[]'::jsonb),
    'subscription', case when bs.id is null then null else jsonb_build_object('plan', bs.plan, 'status', bs.status, 'created_at', bs.created_at, 'expires_at', bs.expires_at) end,
    'activity', jsonb_build_object('invoices', (select count(*) from public.invoices i where i.business_id = b.id), 'clients', (select count(*) from public.clients c where c.business_id = b.id), 'products', (select count(*) from public.products p where p.business_id = b.id), 'last_activity_at', b.updated_at),
    'tickets', '[]'::jsonb,
    'audit', '[]'::jsonb
  )
  into result
  from public.businesses b
  left join auth.users owner_user on owner_user.id = b.owner_id
  left join public.business_subscriptions bs on bs.business_id = b.id
  where b.id = p_business_id;
  if result is null then raise exception 'Entreprise introuvable.'; end if;
  return result;
end;
$$;

revoke all on function public.get_platform_business_detail(uuid) from public, anon;
grant execute on function public.get_platform_business_detail(uuid) to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907350000_platform_businesses_exclude_admins.sql
-- ============================================================================
drop function if exists public.list_platform_businesses_detailed(integer, integer);
create or replace function public.list_platform_businesses_detailed(p_limit integer default 100, p_offset integer default 0)
returns table (
  id uuid, name text, sector text, owner_id uuid, owner_email text, user_count bigint, plan text,
  subscription_status text, account_status text, created_at timestamptz, last_activity_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('businesses') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select b.id, b.name, b.sector, b.owner_id, u.email::text,
      1 + (select count(*) from public.business_members m where m.business_id = b.id),
      coalesce(bs.plan, 'free'), coalesce(bs.status, 'active'), b.platform_status, b.created_at,
      greatest(b.updated_at, bs.updated_at, (select max(l.created_at) from public.platform_audit_logs l where l.resource_id = b.id))
    from public.businesses b
    left join auth.users u on u.id = b.owner_id
    left join public.business_subscriptions bs on bs.business_id = b.id
    where not exists (select 1 from public.platform_admins pa where pa.user_id = b.owner_id)
    order by b.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

revoke all on function public.list_platform_businesses_detailed(integer, integer) from public, anon;
grant execute on function public.list_platform_businesses_detailed(integer, integer) to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907360000_platform_subscriptions_module.sql
-- ============================================================================
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  price numeric(12,2) not null default 0 check (price >= 0),
  currency text not null default 'XOF',
  billing_period text not null default 'monthly',
  features jsonb not null default '[]'::jsonb,
  limits jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.subscription_plans (code, name, description, price, features, limits)
values
  ('free', 'FREE', 'Pour démarrer la facturation simplement.', 0, '["Factures standard"]', '{"users":1,"invoices":20,"clients":50,"products":50,"storage_mb":100}'),
  ('basic', 'BASIC', 'Les essentiels pour une petite entreprise.', 5000, '["Factures avancées","Exports","Rapports"]', '{"users":2,"invoices":100,"clients":250,"products":250,"storage_mb":1000}'),
  ('pro', 'PRO', 'Les outils avancés pour une équipe en croissance.', 15000, '["Équipe","Audit","Factures récurrentes","Tableau de bord avancé"]', '{"users":5,"invoices":500,"clients":1000,"products":1000,"storage_mb":5000}'),
  ('business', 'BUSINESS', 'Une offre complète pour les organisations structurées.', 35000, '["Toutes les fonctionnalités Pro","Support prioritaire"]', '{"users":25,"invoices":2000,"clients":10000,"products":10000,"storage_mb":20000}')
on conflict (code) do nothing;

create table if not exists public.subscription_plan_history (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.business_subscriptions(id) on delete cascade,
  from_plan text,
  to_plan text not null,
  from_status text,
  to_status text not null,
  reason text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists subscription_plan_history_subscription_idx
  on public.subscription_plan_history (subscription_id, created_at desc);

create or replace function public.record_subscription_plan_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' or old.plan is distinct from new.plan or old.status is distinct from new.status then
    insert into public.subscription_plan_history(subscription_id, from_plan, to_plan, from_status, to_status, changed_by, reason)
    values (new.id, case when tg_op = 'INSERT' then null else old.plan end, new.plan,
      case when tg_op = 'INSERT' then null else old.status end, new.status, auth.uid(),
      case when tg_op = 'INSERT' then 'Création de l’abonnement' else 'Mise à jour administrative' end);
  end if;
  return new;
end;
$$;

drop trigger if exists subscription_plan_history_trigger on public.business_subscriptions;
create trigger subscription_plan_history_trigger
after insert or update of plan, status on public.business_subscriptions
for each row execute function public.record_subscription_plan_change();

alter table public.subscription_plans enable row level security;
alter table public.subscription_plan_history enable row level security;

create or replace function public.list_platform_subscription_plans()
returns table (id uuid, code text, name text, description text, price numeric, currency text, billing_period text, features jsonb, limits jsonb, status text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('subscriptions') then raise exception 'Accès administrateur requis.'; end if;
  return query select p.id, p.code, p.name, p.description, p.price, p.currency, p.billing_period, p.features, p.limits, p.status
  from public.subscription_plans p order by p.price, p.name;
end;
$$;

create or replace function public.get_platform_subscription_detail(p_subscription_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare result jsonb;
begin
  if not public.has_platform_admin_permission('subscriptions') then raise exception 'Accès administrateur requis.'; end if;
  select jsonb_build_object(
    'id', s.id, 'business_id', s.business_id, 'business_name', b.name, 'plan', s.plan, 'status', s.status,
    'monthly_invoice_limit', s.monthly_invoice_limit, 'expires_at', s.expires_at, 'renewal_at', s.expires_at, 'created_at', s.created_at,
    'history', coalesce((select jsonb_agg(h order by h.created_at desc) from public.subscription_plan_history h where h.subscription_id = s.id), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'business_id', p.business_id, 'business_name', b.name, 'plan', p.plan, 'amount', p.amount, 'currency', p.currency, 'status', p.status, 'provider', p.provider, 'created_at', p.created_at, 'completed_at', p.completed_at) order by p.created_at desc) from public.subscription_payments p where p.business_id = s.business_id), '[]'::jsonb)
  ) into result
  from public.business_subscriptions s join public.businesses b on b.id = s.business_id where s.id = p_subscription_id;
  if result is null then raise exception 'Abonnement introuvable.'; end if;
  return result;
end;
$$;

revoke all on function public.list_platform_subscription_plans() from public, anon;
grant execute on function public.list_platform_subscription_plans() to authenticated;
revoke all on function public.get_platform_subscription_detail(uuid) from public, anon;
grant execute on function public.get_platform_subscription_detail(uuid) to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907370000_platform_subscription_admin_filter.sql
-- ============================================================================
create or replace function public.list_platform_admin_subscriptions(p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, business_id uuid, business_name text, plan text, status text, monthly_invoice_limit integer, expires_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('subscriptions') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select s.id, s.business_id, b.name, s.plan, s.status, s.monthly_invoice_limit, s.expires_at, s.created_at
    from public.business_subscriptions s
    join public.businesses b on b.id = s.business_id
    where not exists (select 1 from public.platform_admins pa where pa.user_id = b.owner_id)
    order by s.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

drop function if exists public.list_platform_subscription_payments(integer, integer);
create or replace function public.list_platform_subscription_payments(p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, business_id uuid, business_name text, plan text, amount numeric, currency text, status text, provider text, created_at timestamptz, completed_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('subscription_payments') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select p.id, p.business_id, b.name, p.plan, p.amount, p.currency, p.status, p.provider, p.created_at, p.completed_at
    from public.subscription_payments p
    join public.businesses b on b.id = p.business_id
    where not exists (select 1 from public.platform_admins pa where pa.user_id = b.owner_id)
    order by p.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.get_platform_subscription_detail(p_subscription_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare result jsonb;
begin
  if not public.has_platform_admin_permission('subscriptions') then raise exception 'Accès administrateur requis.'; end if;
  select jsonb_build_object(
    'id', s.id, 'business_id', s.business_id, 'business_name', b.name, 'plan', s.plan, 'status', s.status,
    'monthly_invoice_limit', s.monthly_invoice_limit, 'expires_at', s.expires_at, 'renewal_at', s.expires_at, 'created_at', s.created_at,
    'history', coalesce((select jsonb_agg(h order by h.created_at desc) from public.subscription_plan_history h where h.subscription_id = s.id), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'business_id', p.business_id, 'business_name', b.name, 'plan', p.plan, 'amount', p.amount, 'currency', p.currency, 'status', p.status, 'provider', p.provider, 'created_at', p.created_at, 'completed_at', p.completed_at) order by p.created_at desc) from public.subscription_payments p where p.business_id = s.business_id), '[]'::jsonb)
  ) into result
  from public.business_subscriptions s
  join public.businesses b on b.id = s.business_id
  where s.id = p_subscription_id
    and not exists (select 1 from public.platform_admins pa where pa.user_id = b.owner_id);
  if result is null then raise exception 'Abonnement introuvable.'; end if;
  return result;
end;
$$;

notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907380000_subscription_expiration_dates.sql
-- ============================================================================
create or replace function public.ensure_subscription_expiration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.plan = 'free' then
    new.expires_at := null;
  elsif new.expires_at is null then
    new.expires_at := coalesce(new.created_at, now()) + interval '31 days';
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_subscription_expiration_trigger on public.business_subscriptions;
create trigger ensure_subscription_expiration_trigger
before insert or update of plan, expires_at on public.business_subscriptions
for each row execute function public.ensure_subscription_expiration();

update public.business_subscriptions
set expires_at = created_at + interval '31 days',
    updated_at = now()
where plan <> 'free'
  and expires_at is null;

notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907390000_platform_admin_protection.sql
-- ============================================================================
create or replace function public.reject_platform_admin_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.businesses b
    join public.platform_admins pa on pa.user_id = b.owner_id
    where b.id = new.business_id
  ) then
    raise exception 'Un administrateur plateforme ne peut pas souscrire à un abonnement.';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_platform_admin_subscription_trigger on public.business_subscriptions;
create trigger reject_platform_admin_subscription_trigger
before insert or update of business_id, plan, status on public.business_subscriptions
for each row execute function public.reject_platform_admin_subscription();

create or replace function public.reject_platform_admin_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.businesses b
    join public.platform_admins pa on pa.user_id = b.owner_id
    where b.id = new.business_id
  ) then
    raise exception 'Un administrateur plateforme ne peut pas effectuer de paiement d’abonnement.';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_platform_admin_payment_trigger on public.subscription_payments;
create trigger reject_platform_admin_payment_trigger
before insert or update of business_id, plan, status on public.subscription_payments
for each row execute function public.reject_platform_admin_payment();

create or replace function public.set_platform_user_status(p_user_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('users') then raise exception 'Accès administrateur requis.'; end if;
  if exists (select 1 from public.platform_admins where user_id = p_user_id) then
    raise exception 'Le compte administrateur plateforme est protégé et ne peut pas être désactivé ici.';
  end if;
  if p_status not in ('active', 'disabled') then raise exception 'Statut invalide.'; end if;
  update auth.users set banned_until = case when p_status = 'disabled' then 'infinity'::timestamptz else null end where id = p_user_id;
  if not found then raise exception 'Utilisateur introuvable.'; end if;
  perform public.write_platform_audit(case when p_status = 'disabled' then 'disable' else 'activate' end, 'platform_user', p_user_id);
end;
$$;

create or replace function public.delete_platform_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('user_management') then raise exception 'Permission insuffisante pour supprimer un utilisateur.'; end if;
  if p_user_id = auth.uid() then raise exception 'Vous ne pouvez pas supprimer votre propre compte administrateur.'; end if;
  if exists (select 1 from public.platform_admins where user_id = p_user_id) then
    raise exception 'Le compte administrateur plateforme est protégé et ne peut pas être supprimé ici.';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then raise exception 'Utilisateur introuvable.'; end if;
  perform public.write_platform_audit('delete', 'platform_user', p_user_id);
  delete from auth.users where id = p_user_id;
end;
$$;

create or replace function public.list_platform_admin_businesses(p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, name text, owner_id uuid, owner_email text, created_at timestamptz, plan text, subscription_status text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('businesses') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select b.id, b.name, b.owner_id, u.email::text, b.created_at,
      coalesce(bs.plan, 'free'), coalesce(bs.status, 'active')
    from public.businesses b
    left join auth.users u on u.id = b.owner_id
    left join public.business_subscriptions bs on bs.business_id = b.id
    where not exists (select 1 from public.platform_admins pa where pa.user_id = b.owner_id)
    order by b.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907400000_subscription_catalog_alignment.sql
-- ============================================================================
alter table public.business_subscriptions
  drop constraint if exists business_subscriptions_plan_check,
  drop constraint if exists business_subscriptions_status_check;

alter table public.business_subscriptions
  add constraint business_subscriptions_plan_check check (plan in ('free', 'basic', 'starter', 'pro', 'business')),
  add constraint business_subscriptions_status_check check (status in ('active', 'pending', 'trialing', 'past_due', 'expired', 'cancelled', 'suspended'));

alter table public.subscription_payments
  drop constraint if exists subscription_payments_plan_check,
  drop constraint if exists subscription_payments_status_check;

alter table public.subscription_payments
  add constraint subscription_payments_plan_check check (plan in ('basic', 'starter', 'pro', 'business')),
  add constraint subscription_payments_status_check check (status in ('pending', 'completed', 'failed', 'cancelled'));

create or replace function public.ensure_subscription_expiration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.plan = 'free' then
    new.expires_at := null;
  elsif new.expires_at is null then
    new.expires_at := coalesce(new.created_at, now()) + interval '31 days';
  end if;
  return new;
end;
$$;

update public.business_subscriptions
set status = 'expired', updated_at = now()
where expires_at is not null and expires_at <= now()
  and status in ('active', 'trialing', 'past_due');

notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907410000_platform_payments_support_detail.sql
-- ============================================================================
alter table public.subscription_payments add column if not exists internal_reference text;
alter table public.subscription_payments add column if not exists confirmation_data jsonb not null default '{}'::jsonb;
create unique index if not exists subscription_payments_internal_reference_idx on public.subscription_payments (internal_reference) where internal_reference is not null;

drop function if exists public.list_platform_subscription_payments(integer, integer);
drop function if exists public.list_platform_subscription_payments(integer, integer);
create or replace function public.list_platform_subscription_payments(p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, business_id uuid, business_name text, plan text, amount numeric, currency text, status text, provider text, provider_token text, internal_reference text, created_at timestamptz, completed_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('subscription_payments') then raise exception 'Accès administrateur requis.'; end if;
  return query select p.id, p.business_id, b.name, p.plan, p.amount, p.currency, p.status, p.provider, p.provider_token, p.internal_reference, p.created_at, p.completed_at
    from public.subscription_payments p join public.businesses b on b.id = p.business_id
    where not exists (select 1 from public.platform_admins pa where pa.user_id = b.owner_id)
    order by p.created_at desc limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.get_platform_support_ticket_detail(p_ticket_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare result jsonb;
begin
  if not public.has_platform_admin_permission('support') then raise exception 'Accès administrateur requis.'; end if;
  select jsonb_build_object('id', t.id, 'business_id', t.business_id, 'business_name', b.name, 'user_id', t.user_id, 'user_email', u.email,
    'subject', t.subject, 'priority', t.priority, 'status', t.status, 'assigned_to', t.assigned_to, 'created_at', t.created_at, 'updated_at', t.updated_at,
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'author_email', au.email, 'body', m.body, 'internal', m.internal, 'created_at', m.created_at) order by m.created_at) from public.support_ticket_messages m left join auth.users au on au.id = m.author_id where m.ticket_id = t.id), '[]'::jsonb))
  into result from public.support_tickets t left join public.businesses b on b.id = t.business_id left join auth.users u on u.id = t.user_id where t.id = p_ticket_id;
  if result is null then raise exception 'Ticket introuvable.'; end if;
  return result;
end;
$$;

create or replace function public.update_platform_ticket_priority(p_ticket_id uuid, p_priority text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('support') then raise exception 'Accès administrateur requis.'; end if;
  if p_priority not in ('low', 'normal', 'high', 'urgent') then raise exception 'Priorité invalide.'; end if;
  update public.support_tickets set priority = p_priority, updated_at = now() where id = p_ticket_id;
  if not found then raise exception 'Ticket introuvable.'; end if;
  perform public.write_platform_audit('update_priority', 'support_ticket', p_ticket_id, 'success', jsonb_build_object('priority', p_priority));
end;
$$;

revoke all on function public.list_platform_subscription_payments(integer, integer) from public, anon;
revoke all on function public.get_platform_support_ticket_detail(uuid) from public, anon;
revoke all on function public.update_platform_ticket_priority(uuid, text) from public, anon;
grant execute on function public.list_platform_subscription_payments(integer, integer) to authenticated;
grant execute on function public.get_platform_support_ticket_detail(uuid) to authenticated;
grant execute on function public.update_platform_ticket_priority(uuid, text) to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907420000_platform_payment_webhooks.sql
-- ============================================================================
alter table public.subscription_payments add column if not exists provider_confirmed_at timestamptz;
alter table public.subscription_payments add column if not exists webhook_event_id text;
create unique index if not exists subscription_payments_webhook_event_idx on public.subscription_payments (webhook_event_id) where webhook_event_id is not null;

alter table public.subscription_payments drop constraint if exists subscription_payments_status_check;
alter table public.subscription_payments add constraint subscription_payments_status_check check (status in ('pending', 'completed', 'failed', 'refunded', 'cancelled'));

drop function if exists public.list_platform_subscription_payments(integer, integer);
drop function if exists public.list_platform_subscription_payments(integer, integer);
create or replace function public.list_platform_subscription_payments(p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, business_id uuid, business_name text, plan text, amount numeric, currency text, status text, provider text, provider_token text, internal_reference text, confirmation_data jsonb, provider_confirmed_at timestamptz, created_at timestamptz, completed_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('subscription_payments') then raise exception 'Accès administrateur requis.'; end if;
  return query select p.id, p.business_id, b.name, p.plan, p.amount, p.currency, p.status, p.provider, p.provider_token, p.internal_reference, p.confirmation_data, p.provider_confirmed_at, p.created_at, p.completed_at
    from public.subscription_payments p join public.businesses b on b.id = p.business_id
    where not exists (select 1 from public.platform_admins pa where pa.user_id = b.owner_id)
    order by p.created_at desc limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.process_subscription_payment_webhook(
  p_webhook_event_id text,
  p_provider_token text,
  p_status text,
  p_confirmation_data jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare payment_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'Cette confirmation est réservée au webhook du prestataire.'; end if;
  if nullif(trim(p_webhook_event_id), '') is null or nullif(trim(p_provider_token), '') is null then raise exception 'Références webhook obligatoires.'; end if;
  if p_status not in ('completed', 'failed', 'refunded', 'cancelled') then raise exception 'Statut prestataire invalide.'; end if;
  if exists (select 1 from public.subscription_payments where webhook_event_id = p_webhook_event_id) then
    select id into payment_id from public.subscription_payments where webhook_event_id = p_webhook_event_id;
    return payment_id;
  end if;
  update public.subscription_payments
  set status = p_status, provider_token = p_provider_token, provider_confirmed_at = now(),
      confirmation_data = coalesce(p_confirmation_data, '{}'::jsonb),
      completed_at = case when p_status = 'completed' then now() else completed_at end,
      webhook_event_id = p_webhook_event_id
  where provider_token = p_provider_token
  returning id into payment_id;
  if payment_id is null then raise exception 'Paiement introuvable pour cette référence prestataire.'; end if;
  return payment_id;
end;
$$;

revoke all on function public.process_subscription_payment_webhook(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.process_subscription_payment_webhook(text, text, text, jsonb) to service_role;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907430000_platform_support_actions.sql
-- ============================================================================
create or replace function public.assign_platform_ticket(p_ticket_id uuid, p_agent_id uuid default null)
returns void language plpgsql security definer set search_path = public
as $$
declare target_agent uuid := coalesce(p_agent_id, auth.uid());
begin
  if not public.has_platform_admin_permission('support') then raise exception 'Accès administrateur requis.'; end if;
  if not exists (select 1 from public.platform_admins where user_id = target_agent) then raise exception 'Agent support invalide.'; end if;
  update public.support_tickets set assigned_to = target_agent, updated_at = now() where id = p_ticket_id;
  if not found then raise exception 'Ticket introuvable.'; end if;
  perform public.write_platform_audit('assign', 'support_ticket', p_ticket_id, 'success', jsonb_build_object('assigned_to', target_agent));
end;
$$;

revoke all on function public.assign_platform_ticket(uuid, uuid) from public, anon;
grant execute on function public.assign_platform_ticket(uuid, uuid) to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907440000_platform_analytics_security.sql
-- ============================================================================
create or replace function public.get_platform_analytics(
  p_from timestamptz default now() - interval '30 days',
  p_to timestamptz default now(),
  p_plan text default null,
  p_sector text default null,
  p_business_type text default null
) returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare result jsonb;
begin
  if not public.has_platform_admin_permission('analytics') then raise exception 'Accès administrateur requis.'; end if;
  with scope as (
    select b.id, b.created_at, b.platform_status, coalesce(bs.plan, 'free') plan
    from businesses b left join business_subscriptions bs on bs.business_id = b.id
    where not exists (select 1 from platform_admins pa where pa.user_id = b.owner_id)
      and (p_plan is null or coalesce(bs.plan, 'free') = p_plan)
      and (p_sector is null or b.sector = p_sector)
  ), current_metrics as (
    select count(*) filter (where created_at between p_from and p_to) signups,
      count(*) filter (where platform_status = 'active') active_businesses,
      count(*) filter (where plan <> 'free') paid_businesses,
      coalesce((select count(*) from business_members m where m.created_at between p_from and p_to), 0) active_users,
      coalesce((select sum(amount) from subscription_payments p join scope s on s.id = p.business_id where p.status = 'completed' and p.created_at between p_from and p_to), 0) revenue,
      coalesce((select sum(price) from subscription_plans where status = 'active' and code in (select plan from scope where plan <> 'free')), 0) mrr
    from scope
  ), previous_metrics as (
    select count(*) filter (where created_at between p_from - (p_to-p_from) and p_from) signups from scope
  )
  select jsonb_build_object('current', to_jsonb(c), 'previous', to_jsonb(pm), 'feature_usage', jsonb_build_array(
    jsonb_build_object('feature','Factures','usage',(select count(*) from invoices i where i.created_at between p_from and p_to)),
    jsonb_build_object('feature','Clients','usage',(select count(*) from clients c where c.created_at between p_from and p_to)),
    jsonb_build_object('feature','Produits','usage',(select count(*) from products pr where pr.created_at between p_from and p_to))
  )) into result from current_metrics c cross join previous_metrics pm;
  return result;
end;
$$;

create or replace function public.list_platform_security_events(p_limit integer default 100)
returns table (id uuid, action text, resource_type text, result text, actor_email text, created_at timestamptz, context jsonb)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('audit') then raise exception 'Accès administrateur requis.'; end if;
  return query select l.id, l.action, l.resource_type, l.result, u.email::text, l.created_at, l.context
    from platform_audit_logs l left join auth.users u on u.id = l.actor_id
    where l.resource_type ilike '%security%' or l.action ilike '%login%' or l.action in ('disable','delete','update_role','access_denied')
    order by l.created_at desc limit greatest(1, least(p_limit, 200));
end;
$$;

revoke all on function public.get_platform_analytics(timestamptz,timestamptz,text,text,text) from public, anon;
grant execute on function public.get_platform_analytics(timestamptz,timestamptz,text,text,text) to authenticated;
revoke all on function public.list_platform_security_events(integer) from public, anon;
grant execute on function public.list_platform_security_events(integer) to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907450000_platform_analytics_complete.sql
-- ============================================================================
alter table public.businesses add column if not exists business_type text;

create or replace function public.get_platform_analytics(
  p_from timestamptz default now() - interval '30 days',
  p_to timestamptz default now(),
  p_plan text default null,
  p_sector text default null,
  p_business_type text default null
) returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare result jsonb; period interval := p_to - p_from;
begin
  if not public.has_platform_admin_permission('analytics') then raise exception 'Accès administrateur requis.'; end if;
  with scoped as (
    select b.id, b.created_at, b.platform_status, coalesce(s.plan, 'free') plan
    from businesses b left join business_subscriptions s on s.business_id = b.id
    where not exists (select 1 from platform_admins pa where pa.user_id = b.owner_id)
      and (p_plan is null or coalesce(s.plan, 'free') = p_plan)
      and (p_sector is null or b.sector = p_sector)
      and (p_business_type is null or b.business_type = p_business_type)
  ), periods as (
    select
      count(*) filter (where created_at >= p_from and created_at < p_to)::numeric signups,
      count(*) filter (where platform_status = 'active')::numeric active_businesses,
      count(*) filter (where plan <> 'free' and created_at >= p_from and created_at < p_to)::numeric paid_conversions,
      count(*) filter (where created_at >= p_from and created_at < p_to)::numeric total_signups,
      count(*) filter (where created_at >= p_from - period and created_at < p_from)::numeric previous_signups
    from scoped
  ), commercial as (
    select
      coalesce(sum(case when s.status in ('active','trialing') then coalesce(p.price, 0) else 0 end), 0)::numeric mrr,
      count(*) filter (where s.expires_at between p_from and p_to)::numeric renewals,
      count(*) filter (where s.status in ('cancelled','expired','suspended') and s.updated_at between p_from and p_to)::numeric churn,
      coalesce((select sum(pay.amount) from subscription_payments pay join scoped sc on sc.id = pay.business_id where pay.status = 'completed' and pay.created_at between p_from and p_to), 0)::numeric revenue
    from business_subscriptions s join scoped sc on sc.id = s.business_id
    left join subscription_plans p on p.code = s.plan
  ), usage as (
    select jsonb_build_array(
      jsonb_build_object('feature','Factures','usage',(select count(*) from invoices where created_at between p_from and p_to)),
      jsonb_build_object('feature','Clients','usage',(select count(*) from clients where created_at between p_from and p_to)),
      jsonb_build_object('feature','Produits','usage',(select count(*) from products where created_at between p_from and p_to)),
      jsonb_build_object('feature','Utilisateurs actifs','usage',(select count(*) from business_members where created_at between p_from and p_to))
    ) feature_usage
  )
  select jsonb_build_object(
    'current', jsonb_build_object(
      'signups', periods.signups, 'active_users', (select count(*) from business_members where created_at between p_from and p_to),
      'active_businesses', periods.active_businesses, 'activation_rate', case when periods.total_signups = 0 then 0 else round(periods.active_businesses / periods.total_signups * 100, 2) end,
      'conversion_rate', case when periods.total_signups = 0 then 0 else round(periods.paid_conversions / periods.total_signups * 100, 2) end,
      'paid_conversions', periods.paid_conversions, 'renewals', commercial.renewals, 'churn', commercial.churn,
      'mrr', commercial.mrr, 'arr', commercial.mrr * 12, 'revenue', commercial.revenue
    ),
    'previous', jsonb_build_object('signups', periods.previous_signups),
    'feature_usage', usage.feature_usage
  ) into result from periods cross join commercial cross join usage;
  return result;
end;
$$;

notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907460000_platform_analytics_period_comparison.sql
-- ============================================================================
create or replace function public.get_platform_analytics(
  p_from timestamptz default now() - interval '30 days',
  p_to timestamptz default now(),
  p_plan text default null,
  p_sector text default null,
  p_business_type text default null
) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  result jsonb;
  period interval := greatest(p_to - p_from, interval '1 day');
begin
  if not public.has_platform_admin_permission('analytics') then
    raise exception 'Accès administrateur requis.';
  end if;

  with scope as (
    select b.id, b.created_at, b.platform_status, coalesce(bs.plan, 'free') plan
    from businesses b
    left join business_subscriptions bs on bs.business_id = b.id
    where not exists (select 1 from platform_admins pa where pa.user_id = b.owner_id)
      and (p_plan is null or coalesce(bs.plan, 'free') = p_plan)
      and (p_sector is null or b.sector = p_sector)
      and (p_business_type is null or b.business_type = p_business_type)
  ), metrics as (
    select
      count(*) filter (where s.created_at >= p_from and s.created_at < p_to)::numeric signups,
      count(*) filter (where s.created_at >= p_from - period and s.created_at < p_from)::numeric previous_signups,
      count(*) filter (where s.platform_status = 'active' and s.created_at < p_to)::numeric active_businesses,
      count(*) filter (where s.platform_status = 'active' and s.created_at < p_from)::numeric previous_active_businesses,
      count(*) filter (where s.plan <> 'free' and s.created_at >= p_from and s.created_at < p_to)::numeric paid_conversions,
      count(*) filter (where s.plan <> 'free' and s.created_at >= p_from - period and s.created_at < p_from)::numeric previous_paid_conversions,
      count(*) filter (where s.created_at >= p_from and s.created_at < p_to)::numeric total_signups,
      count(*) filter (where s.created_at >= p_from - period and s.created_at < p_from)::numeric previous_total_signups
    from scope s
  ), commercial as (
    select
      coalesce(sum(case when bs.status in ('active','trialing') and bs.created_at < p_to then coalesce(sp.price, 0) else 0 end), 0)::numeric mrr,
      coalesce(sum(case when bs.status in ('active','trialing') and bs.created_at < p_from then coalesce(sp.price, 0) else 0 end), 0)::numeric previous_mrr,
      count(*) filter (where bs.expires_at >= p_from and bs.expires_at < p_to)::numeric renewals,
      count(*) filter (where bs.expires_at >= p_from - period and bs.expires_at < p_from)::numeric previous_renewals,
      count(*) filter (where bs.status in ('cancelled','expired','suspended') and bs.updated_at >= p_from and bs.updated_at < p_to)::numeric churn,
      count(*) filter (where bs.status in ('cancelled','expired','suspended') and bs.updated_at >= p_from - period and bs.updated_at < p_from)::numeric previous_churn,
      coalesce((select sum(pay.amount) from subscription_payments pay join scope ps on ps.id = pay.business_id where pay.status = 'completed' and pay.created_at >= p_from and pay.created_at < p_to), 0)::numeric revenue,
      coalesce((select sum(pay.amount) from subscription_payments pay join scope ps on ps.id = pay.business_id where pay.status = 'completed' and pay.created_at >= p_from - period and pay.created_at < p_from), 0)::numeric previous_revenue
    from business_subscriptions bs
    join scope s on s.id = bs.business_id
    left join subscription_plans sp on sp.code = bs.plan
  ), usage as (
    select jsonb_build_array(
      jsonb_build_object('feature','Factures','usage',(select count(*) from invoices i join scope s on s.id = i.business_id where i.created_at >= p_from and i.created_at < p_to)),
      jsonb_build_object('feature','Clients','usage',(select count(*) from clients c join scope s on s.id = c.business_id where c.created_at >= p_from and c.created_at < p_to)),
      jsonb_build_object('feature','Produits','usage',(select count(*) from products pr join scope s on s.id = pr.business_id where pr.created_at >= p_from and pr.created_at < p_to)),
      jsonb_build_object('feature','Utilisateurs actifs','usage',(select count(*) from business_members m join scope s on s.id = m.business_id where m.created_at >= p_from and m.created_at < p_to))
    ) feature_usage,
    jsonb_build_array(
      jsonb_build_object('feature','Factures','usage',(select count(*) from invoices i join scope s on s.id = i.business_id where i.created_at >= p_from - period and i.created_at < p_from)),
      jsonb_build_object('feature','Clients','usage',(select count(*) from clients c join scope s on s.id = c.business_id where c.created_at >= p_from - period and c.created_at < p_from)),
      jsonb_build_object('feature','Produits','usage',(select count(*) from products pr join scope s on s.id = pr.business_id where pr.created_at >= p_from - period and pr.created_at < p_from)),
      jsonb_build_object('feature','Utilisateurs actifs','usage',(select count(*) from business_members m join scope s on s.id = m.business_id where m.created_at >= p_from - period and m.created_at < p_from))
    ) previous_feature_usage
  )
  select jsonb_build_object(
    'current', jsonb_build_object(
      'signups', m.signups, 'active_users', (select count(*) from business_members bm join scope s on s.id = bm.business_id where bm.created_at >= p_from and bm.created_at < p_to),
      'active_businesses', m.active_businesses, 'activation_rate', case when m.total_signups = 0 then 0 else round(m.active_businesses / m.total_signups * 100, 2) end,
      'conversion_rate', case when m.total_signups = 0 then 0 else round(m.paid_conversions / m.total_signups * 100, 2) end,
      'paid_conversions', m.paid_conversions, 'renewals', c.renewals, 'churn', c.churn,
      'mrr', c.mrr, 'arr', c.mrr * 12, 'revenue', c.revenue
    ),
    'previous', jsonb_build_object(
      'signups', m.previous_signups, 'active_users', (select count(*) from business_members bm join scope s on s.id = bm.business_id where bm.created_at >= p_from - period and bm.created_at < p_from),
      'active_businesses', m.previous_active_businesses, 'activation_rate', case when m.previous_total_signups = 0 then 0 else round(m.previous_active_businesses / m.previous_total_signups * 100, 2) end,
      'conversion_rate', case when m.previous_total_signups = 0 then 0 else round(m.previous_paid_conversions / m.previous_total_signups * 100, 2) end,
      'paid_conversions', m.previous_paid_conversions, 'renewals', c.previous_renewals, 'churn', c.previous_churn,
      'mrr', c.previous_mrr, 'arr', c.previous_mrr * 12, 'revenue', c.previous_revenue
    ),
    'feature_usage', u.feature_usage,
    'previous_feature_usage', u.previous_feature_usage
  ) into result
  from metrics m cross join commercial c cross join usage u;
  return result;
end;
$$;

notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907470000_platform_audit_context.sql
-- ============================================================================
alter table public.platform_audit_logs
  add column if not exists ip_address inet;

create index if not exists platform_audit_logs_resource_idx
  on public.platform_audit_logs (resource_type, resource_id, created_at desc);

create or replace function public.write_platform_audit(
  p_action text,
  p_resource_type text,
  p_resource_id uuid default null,
  p_result text default 'success',
  p_context jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  request_headers jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  forwarded_ip text := coalesce(request_headers ->> 'x-forwarded-for', request_headers ->> 'x-real-ip');
begin
  if not exists (select 1 from public.platform_admins where user_id = auth.uid()) then
    raise exception 'Accès administrateur requis.';
  end if;
  insert into public.platform_audit_logs(actor_id, action, resource_type, resource_id, result, ip_address, context)
  values (
    auth.uid(),
    p_action,
    p_resource_type,
    p_resource_id,
    p_result,
    nullif(split_part(forwarded_ip, ',', 1), '')::inet,
    jsonb_build_object(
      'user_agent', request_headers ->> 'user-agent',
      'before', coalesce(p_context -> 'before', null),
      'after', coalesce(p_context -> 'after', null),
      'details', coalesce(p_context - 'before' - 'after', '{}'::jsonb)
    )
  );
end;
$$;

drop function if exists public.list_platform_audit_logs(integer, integer);

create or replace function public.list_platform_audit_logs(p_limit integer default 100, p_offset integer default 0)
returns table (
  id uuid, actor_id uuid, actor_email text, action text, resource_type text,
  resource_id uuid, result text, ip_address inet, context jsonb, created_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('audit') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select l.id, l.actor_id, u.email::text, l.action, l.resource_type, l.resource_id,
      l.result, l.ip_address, l.context, l.created_at
    from public.platform_audit_logs l
    left join auth.users u on u.id = l.actor_id
    order by l.created_at desc
    limit greatest(1, least(p_limit, 200)) offset greatest(p_offset, 0);
end;
$$;

revoke all on function public.write_platform_audit(text, text, uuid, text, jsonb) from public, anon;
grant execute on function public.write_platform_audit(text, text, uuid, text, jsonb) to authenticated;
revoke all on function public.list_platform_audit_logs(integer, integer) from public, anon;
grant execute on function public.list_platform_audit_logs(integer, integer) to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907480000_platform_audit_deletion.sql
-- ============================================================================
create or replace function public.delete_platform_audit_logs(p_log_ids uuid[])
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  deleted_count integer;
begin
  if not exists (
    select 1 from public.platform_admins
    where user_id = auth.uid() and role = 'super_admin'
  ) then
    raise exception 'Seul le super administrateur peut supprimer les journaux.';
  end if;
  if coalesce(array_length(p_log_ids, 1), 0) = 0
    or array_length(p_log_ids, 1) > 100 then
    raise exception 'La sélection doit contenir entre 1 et 100 journaux.';
  end if;

  perform public.write_platform_audit(
    'delete',
    'platform_audit_logs',
    null,
    'success',
    jsonb_build_object('details', jsonb_build_object('deleted_ids', to_jsonb(p_log_ids), 'count', array_length(p_log_ids, 1)))
  );

  delete from public.platform_audit_logs where id = any(p_log_ids);
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.delete_platform_audit_logs(uuid[]) from public, anon;
grant execute on function public.delete_platform_audit_logs(uuid[]) to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260907_subscription_limits.sql
-- ============================================================================
insert into public.business_subscriptions (business_id)
select b.id
from public.businesses b
where not exists (
  select 1
  from public.business_subscriptions s
  where s.business_id = b.id
);

create or replace function public.initialize_business_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.business_subscriptions (business_id)
  values (new.id)
  on conflict (business_id) do nothing;
  return new;
end;
$$;

drop trigger if exists initialize_business_subscription on public.businesses;
create trigger initialize_business_subscription
after insert on public.businesses
for each row execute function public.initialize_business_subscription();

drop policy if exists "business members read subscriptions" on public.business_subscriptions;
drop policy if exists "business members read subscriptions" on public.business_subscriptions;
create policy "business members read subscriptions" on public.business_subscriptions
  for select using (public.is_business_member(business_id, 'viewer'));

drop trigger if exists audit_business_subscriptions on public.business_subscriptions;
create trigger audit_business_subscriptions
after insert or update or delete on public.business_subscriptions
for each row execute function public.write_audit_log();

drop policy if exists "business members read businesses" on public.businesses;
drop policy if exists "business members read businesses" on public.businesses;
create policy "business members read businesses" on public.businesses
  for select using (public.is_business_member(id, 'viewer'));

create or replace function public.is_business_owner(p_business_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.businesses
    where id = p_business_id and owner_id = auth.uid()
  );
$$;

revoke all on function public.is_business_owner(uuid) from public, anon;
grant execute on function public.is_business_owner(uuid) to authenticated;

create or replace function public.get_business_role(p_business_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select case
    when exists (
      select 1 from public.businesses
      where id = p_business_id and owner_id = auth.uid()
    ) then 'owner'
    else coalesce((
      select role
      from public.business_members
      where business_id = p_business_id and user_id = auth.uid()
    ), 'none')
  end;
$$;

revoke all on function public.get_business_role(uuid) from public, anon;
grant execute on function public.get_business_role(uuid) to authenticated;

create or replace function public.update_business_subscription(
  p_business_id uuid,
  p_plan text,
  p_status text default 'active',
  p_expires_at timestamptz default null
)
returns public.business_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_limit integer;
  updated_subscription public.business_subscriptions;
begin
  if not public.is_business_owner(p_business_id) then
    raise exception 'Seul le propriétaire peut modifier l’abonnement.';
  end if;

  plan_limit := case p_plan
    when 'free' then 20
    when 'starter' then 100
    when 'pro' then 500
    else 0
  end;
  if plan_limit = 0 then
    raise exception 'Plan d’abonnement invalide.';
  end if;
  if p_status not in ('active', 'trialing', 'past_due', 'cancelled') then
    raise exception 'Statut d’abonnement invalide.';
  end if;

  insert into public.business_subscriptions (business_id, plan, status, monthly_invoice_limit, expires_at)
  values (p_business_id, p_plan, p_status, plan_limit, p_expires_at)
  on conflict (business_id) do update set
    plan = excluded.plan,
    status = excluded.status,
    monthly_invoice_limit = excluded.monthly_invoice_limit,
    expires_at = excluded.expires_at,
    updated_at = now()
  returning * into updated_subscription;

  return updated_subscription;
end;
$$;

revoke all on function public.update_business_subscription(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.update_business_subscription(uuid, text, text, timestamptz) to authenticated;

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
security invoker
set search_path = public
as $$
declare
  line jsonb;
  product_row record;
  invoice_id uuid;
  invoice_number text;
  subscription_row record;
  invoice_count integer;
  month_start date := date_trunc('month', p_issue_date)::date;
  next_month date := (date_trunc('month', p_issue_date) + interval '1 month')::date;
  subtotal numeric := 0;
  discount_amount numeric;
  tax_amount numeric;
  total_amount numeric;
  quantity numeric;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;

  if not exists (
    select 1 from public.clients
    where id = p_client_id and business_id = p_business_id
  ) then
    raise exception 'Client non autorisé.';
  end if;

  select *
  into subscription_row
  from public.business_subscriptions
  where business_id = p_business_id
  for update;

  if not found then
    raise exception 'Abonnement non configuré pour cette entreprise.';
  end if;
  if subscription_row.status not in ('active', 'trialing') then
    raise exception 'Votre abonnement ne permet pas de créer des factures.';
  end if;
  if subscription_row.expires_at is not null and subscription_row.expires_at < now() then
    raise exception 'Votre abonnement a expiré.';
  end if;

  select count(*)::integer
  into invoice_count
  from public.invoices
  where business_id = p_business_id
    and issue_date >= month_start
    and issue_date < next_month
    and status <> 'CANCELLED';

  if invoice_count >= subscription_row.monthly_invoice_limit then
    raise exception 'La limite mensuelle de % factures est atteinte.', subscription_row.monthly_invoice_limit;
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'La facture doit contenir au moins une ligne.';
  end if;

  for line in select value from jsonb_array_elements(p_lines)
  loop
    quantity := (line->>'quantity')::numeric;
    if quantity <= 0 then
      raise exception 'La quantité doit être positive.';
    end if;

    select id, name, price, product_type, stock_quantity
    into product_row
    from public.products
    where id = (line->>'product_id')::uuid
      and business_id = p_business_id
    for update;

    if not found then
      raise exception 'Produit non autorisé.';
    end if;
    if product_row.product_type = 'product' and product_row.stock_quantity < quantity then
      raise exception 'Stock insuffisant pour %.', product_row.name;
    end if;
    subtotal := subtotal + product_row.price * quantity;
  end loop;

  discount_amount := least(greatest(coalesce(p_discount, 0), 0), subtotal);
  tax_amount := (subtotal - discount_amount) * greatest(coalesce(p_tax_rate, 0), 0) / 100;
  total_amount := subtotal - discount_amount + tax_amount;
  invoice_number := public.next_invoice_number(p_business_id, extract(year from p_issue_date)::integer);

  insert into public.invoices (
    business_id, client_id, invoice_number, issue_date, due_date,
    subtotal, discount, tax, total, status
  ) values (
    p_business_id, p_client_id, invoice_number, p_issue_date, p_due_date,
    subtotal, discount_amount, tax_amount, total_amount, 'DRAFT'
  ) returning id into invoice_id;

  for line in select value from jsonb_array_elements(p_lines)
  loop
    quantity := (line->>'quantity')::numeric;
    select id, name, price, product_type
    into product_row
    from public.products
    where id = (line->>'product_id')::uuid and business_id = p_business_id;

    insert into public.invoice_items (invoice_id, product_id, description, quantity, unit_price)
    values (invoice_id, product_row.id, product_row.name, quantity, product_row.price);

    if product_row.product_type = 'product' then
      update public.products
      set stock_quantity = stock_quantity - quantity, updated_at = now()
      where id = product_row.id and business_id = p_business_id;
      insert into public.stock_movements (business_id, product_id, quantity, movement_type, note)
      values (p_business_id, product_row.id, -quantity, 'out', format('Vente liée à %s', invoice_number));
    end if;
  end loop;

  return invoice_number;
end;
$$;

revoke all on function public.create_invoice_with_lines(uuid, uuid, date, date, numeric, numeric, jsonb) from public, anon;
grant execute on function public.create_invoice_with_lines(uuid, uuid, date, date, numeric, numeric, jsonb) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260908001000_platform_settings_categories.sql
-- ============================================================================
insert into public.platform_settings(key, value) values
  ('platform_logo_url', ''),
  ('general_info', 'Plateforme de facturation et de gestion pour les entreprises du Bénin.'),
  ('email_notifications', 'enabled'),
  ('system_notifications', 'enabled'),
  ('alert_notifications', 'enabled'),
  ('session_duration_minutes', '480'),
  ('security_rules', 'Mots de passe de 8 caractères minimum.'),
  ('login_settings', 'Authentification Supabase et confirmation e-mail.'),
  ('subscription_plans', 'Free, Starter, Pro et Business'),
  ('subscription_rules', 'Les limites sont contrôlées côté serveur.'),
  ('commercial_settings', 'Tarification configurée dans le module Abonnements.'),
  ('timezone', 'Africa/Porto-Novo'),
  ('maintenance_mode', 'disabled'),
  ('pdf_provider', 'Génération locale sécurisée')
on conflict (key) do nothing;

create or replace function public.update_platform_setting(p_key text, p_value text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('settings') then
    raise exception 'Accès administrateur requis.';
  end if;
  if p_key not in (
    'platform_name', 'platform_logo_url', 'support_email', 'support_phone', 'general_info',
    'default_currency', 'country', 'payment_provider',
    'email_notifications', 'system_notifications', 'alert_notifications',
    'session_duration_minutes', 'security_rules', 'login_settings',
    'subscription_plans', 'subscription_rules', 'commercial_settings',
    'timezone', 'maintenance_mode', 'pdf_provider'
  ) then
    raise exception 'Paramètre non modifiable.';
  end if;
  if p_key = 'session_duration_minutes' and (p_value !~ '^[0-9]+$' or p_value::integer < 15 or p_value::integer > 43200) then
    raise exception 'La durée de session doit être comprise entre 15 et 43200 minutes.';
  end if;
  if p_key in ('email_notifications', 'system_notifications', 'alert_notifications', 'maintenance_mode')
    and p_value not in ('enabled', 'disabled') then
    raise exception 'Valeur booléenne de paramètre invalide.';
  end if;
  insert into public.platform_settings(key, value, updated_by, updated_at)
  values (p_key, coalesce(trim(p_value), ''), auth.uid(), now())
  on conflict (key) do update set value = excluded.value, updated_by = auth.uid(), updated_at = now();
  perform public.write_platform_audit('update', 'platform_setting', null, 'success', jsonb_build_object('key', p_key));
end;
$$;

revoke all on function public.update_platform_setting(text, text) from public, anon;
grant execute on function public.update_platform_setting(text, text) to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260908002000_public_subscription_plans.sql
-- ============================================================================
create or replace function public.list_public_subscription_plans()
returns table (
  id uuid,
  code text,
  name text,
  description text,
  price numeric,
  currency text,
  billing_period text,
  features jsonb,
  limits jsonb,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.code, p.name, p.description, p.price, p.currency,
    p.billing_period, p.features, p.limits, p.status
  from public.subscription_plans p
  where p.status = 'active'
  order by p.price, p.name
$$;

revoke all on function public.list_public_subscription_plans() from public;
grant execute on function public.list_public_subscription_plans() to anon, authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260908003000_public_support_requests.sql
-- ============================================================================
drop function if exists public.submit_public_support_request(text, text, text, text);
create or replace function public.submit_public_support_request(
  p_name text,
  p_email text,
  p_subject text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket_id uuid;
  message_body text;
begin
  if nullif(trim(p_name), '') is null
     or nullif(trim(p_email), '') is null
     or nullif(trim(p_subject), '') is null
     or nullif(trim(p_body), '') is null then
    raise exception 'Tous les champs de la demande sont obligatoires.';
  end if;

  if length(trim(p_name)) > 120 or length(trim(p_email)) > 320
     or length(trim(p_subject)) > 160 or length(trim(p_body)) > 5000 then
    raise exception 'La demande dépasse la longueur autorisée.';
  end if;

  if trim(p_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Adresse e-mail invalide.';
  end if;

  insert into public.support_tickets (user_id, subject, priority, status)
  values (
    auth.uid(),
    trim(p_subject),
    case when lower(trim(p_subject)) in ('paiement ou abonnement', 'signaler un problème') then 'high' else 'normal' end,
    'open'
  )
  returning id into ticket_id;

  message_body := format('Nom : %s
E-mail : %s

%s', trim(p_name), trim(p_email), trim(p_body));

  insert into public.support_ticket_messages (ticket_id, author_id, body, internal)
  values (ticket_id, auth.uid(), message_body, false);

  return ticket_id;
end;
$$;

revoke all on function public.submit_public_support_request(text, text, text, text) from public;
grant execute on function public.submit_public_support_request(text, text, text, text) to anon, authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260908004000_public_support_replies.sql
-- ============================================================================
create or replace function public.list_my_support_tickets()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Connexion requise pour consulter vos demandes.';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id,
      'subject', t.subject,
      'priority', t.priority,
      'status', t.status,
      'created_at', t.created_at,
      'updated_at', t.updated_at,
      'messages', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', m.id,
          'body', m.body,
          'internal', m.internal,
          'author_role', case when m.author_id = auth.uid() then 'vous' else 'support' end,
          'created_at', m.created_at
        ) order by m.created_at)
        from public.support_ticket_messages m
        where m.ticket_id = t.id and (m.internal = false or m.author_id = auth.uid())
      ), '[]'::jsonb)
    ) order by t.updated_at desc)
    from public.support_tickets t
    where t.user_id = auth.uid()
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_my_support_tickets() from public, anon;
grant execute on function public.list_my_support_tickets() to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260908005000_public_support_tracking.sql
-- ============================================================================
alter table public.support_tickets
  add column if not exists access_code_hash text;

create index if not exists support_tickets_access_code_idx
  on public.support_tickets (id, access_code_hash);

drop function if exists public.submit_public_support_request(text, text, text, text);
create or replace function public.submit_public_support_request(p_name text, p_email text, p_subject text, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ticket_id uuid;
  access_code text;
begin
  if nullif(trim(p_name), '') is null or nullif(trim(p_email), '') is null
     or nullif(trim(p_subject), '') is null or nullif(trim(p_body), '') is null then
    raise exception 'Tous les champs de la demande sont obligatoires.';
  end if;
  if length(trim(p_name)) > 120 or length(trim(p_email)) > 320
     or length(trim(p_subject)) > 160 or length(trim(p_body)) > 5000 then
    raise exception 'La demande dépasse la longueur autorisée.';
  end if;
  if trim(p_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Adresse e-mail invalide.';
  end if;
  access_code := upper(encode(gen_random_bytes(5), 'hex'));
  insert into public.support_tickets (user_id, subject, priority, status, access_code_hash)
  values (auth.uid(), trim(p_subject),
    case when lower(trim(p_subject)) in ('paiement ou abonnement', 'signaler un problème') then 'high' else 'normal' end,
    'open', encode(digest(access_code, 'sha256'), 'hex'))
  returning id into ticket_id;
  insert into public.support_ticket_messages (ticket_id, author_id, body, internal)
  values (ticket_id, auth.uid(), format('Nom : %s
E-mail : %s

%s', trim(p_name), trim(p_email), trim(p_body)), false);
  return jsonb_build_object('ticket_id', ticket_id, 'access_code', access_code);
end;
$$;

create or replace function public.get_public_support_ticket(p_ticket_id uuid, p_access_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  select jsonb_build_object('id', t.id, 'subject', t.subject, 'priority', t.priority,
    'status', t.status, 'created_at', t.created_at, 'updated_at', t.updated_at,
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'body', m.body,
      'internal', false, 'author_role', case when m.author_id is null then 'vous' else 'support' end,
      'created_at', m.created_at) order by m.created_at)
      from public.support_ticket_messages m where m.ticket_id = t.id and m.internal = false), '[]'::jsonb))
  into result from public.support_tickets t
  where t.id = p_ticket_id and t.access_code_hash = encode(digest(upper(trim(p_access_code)), 'sha256'), 'hex');
  if result is null then raise exception 'Code de suivi invalide.'; end if;
  return result;
end;
$$;

create or replace function public.reply_public_support_ticket(p_ticket_id uuid, p_access_code text, p_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if nullif(trim(p_body), '') is null or length(trim(p_body)) > 5000 then
    raise exception 'Le message est obligatoire et limité à 5000 caractères.';
  end if;
  if not exists (select 1 from public.support_tickets where id = p_ticket_id and access_code_hash = encode(digest(upper(trim(p_access_code)), 'sha256'), 'hex')) then
    raise exception 'Code de suivi invalide.';
  end if;
  insert into public.support_ticket_messages (ticket_id, author_id, body, internal)
  values (p_ticket_id, auth.uid(), trim(p_body), false);
  update public.support_tickets set updated_at = now(), status = 'open' where id = p_ticket_id;
end;
$$;

revoke all on function public.submit_public_support_request(text, text, text, text) from public;
revoke all on function public.get_public_support_ticket(uuid, text) from public;
revoke all on function public.reply_public_support_ticket(uuid, text, text) from public;
grant execute on function public.submit_public_support_request(text, text, text, text) to anon, authenticated;
grant execute on function public.get_public_support_ticket(uuid, text) to anon, authenticated;
grant execute on function public.reply_public_support_ticket(uuid, text, text) to anon, authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260908006000_platform_overview_periods.sql
-- ============================================================================
create or replace function public.get_platform_admin_overview_period(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  range_from timestamptz := coalesce(p_from, '-infinity'::timestamptz);
  range_to timestamptz := coalesce(p_to, 'infinity'::timestamptz);
begin
  if not public.has_platform_admin_permission('overview') then
    raise exception 'Accès administrateur requis.';
  end if;
  if range_from >= range_to then
    raise exception 'Période d’analyse invalide.';
  end if;
  return jsonb_build_object(
    'business_count', (select count(*) from public.businesses b where b.created_at >= range_from and b.created_at < range_to),
    'member_count', (select count(distinct bm.user_id) from public.business_members bm where bm.created_at >= range_from and bm.created_at < range_to),
    'invoice_count', (select count(*) from public.invoices i where i.issue_date >= (range_from at time zone 'Africa/Porto-Novo')::date and i.issue_date < (range_to at time zone 'Africa/Porto-Novo')::date),
    'revenue', coalesce((select sum(p.amount) from public.payments p where p.payment_date >= (range_from at time zone 'Africa/Porto-Novo')::date and p.payment_date < (range_to at time zone 'Africa/Porto-Novo')::date), 0),
    'subscription_revenue', coalesce((select sum(sp.amount) from public.subscription_payments sp where sp.status = 'completed' and sp.created_at >= range_from and sp.created_at < range_to), 0),
    'active_subscriptions', (select count(*) from public.business_subscriptions bs where bs.status in ('active', 'trialing')),
    'pending_payments', (select count(*) from public.subscription_payments sp where sp.status = 'pending' and sp.created_at >= range_from and sp.created_at < range_to),
    'open_ticket_count', (select count(*) from public.support_tickets t where t.status in ('open', 'in_progress', 'waiting') and t.created_at >= range_from and t.created_at < range_to),
    'security_alert_count', (select count(*) from public.platform_notifications n where n.severity = 'critical' and n.read_at is null and n.created_at >= range_from and n.created_at < range_to),
    'recent_businesses', coalesce((
      select jsonb_agg(row_to_json(recent)) from (
        select b.id, b.name, b.created_at, coalesce(bs.plan, 'free') as plan, coalesce(bs.status, 'active') as subscription_status
        from public.businesses b left join public.business_subscriptions bs on bs.business_id = b.id
        where b.created_at >= range_from and b.created_at < range_to
        order by b.created_at desc limit 10
      ) recent
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_platform_admin_overview_period(timestamptz, timestamptz) from public, anon;
grant execute on function public.get_platform_admin_overview_period(timestamptz, timestamptz) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260908007000_platform_overview_benin_timezone.sql
-- ============================================================================
create or replace function public.get_platform_admin_overview_period(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  range_from timestamptz := coalesce(p_from, '-infinity'::timestamptz);
  range_to timestamptz := coalesce(p_to, 'infinity'::timestamptz);
begin
  if not public.has_platform_admin_permission('overview') then
    raise exception 'Accès administrateur requis.';
  end if;
  if range_from >= range_to then
    raise exception 'Période d’analyse invalide.';
  end if;
  return jsonb_build_object(
    'business_count', (select count(*) from public.businesses b where b.created_at >= range_from and b.created_at < range_to),
    'member_count', (select count(distinct bm.user_id) from public.business_members bm where bm.created_at >= range_from and bm.created_at < range_to),
    'invoice_count', (select count(*) from public.invoices i where i.issue_date >= (range_from at time zone 'Africa/Porto-Novo')::date and i.issue_date < (range_to at time zone 'Africa/Porto-Novo')::date),
    'revenue', coalesce((select sum(p.amount) from public.payments p where p.payment_date >= (range_from at time zone 'Africa/Porto-Novo')::date and p.payment_date < (range_to at time zone 'Africa/Porto-Novo')::date), 0),
    'subscription_revenue', coalesce((select sum(sp.amount) from public.subscription_payments sp where sp.status = 'completed' and sp.created_at >= range_from and sp.created_at < range_to), 0),
    'active_subscriptions', (select count(*) from public.business_subscriptions bs where bs.status in ('active', 'trialing')),
    'pending_payments', (select count(*) from public.subscription_payments sp where sp.status = 'pending' and sp.created_at >= range_from and sp.created_at < range_to),
    'open_ticket_count', (select count(*) from public.support_tickets t where t.status in ('open', 'in_progress', 'waiting') and t.created_at >= range_from and t.created_at < range_to),
    'security_alert_count', (select count(*) from public.platform_notifications n where n.severity = 'critical' and n.read_at is null and n.created_at >= range_from and n.created_at < range_to),
    'recent_businesses', coalesce((
      select jsonb_agg(row_to_json(recent)) from (
        select b.id, b.name, b.created_at, coalesce(bs.plan, 'free') as plan, coalesce(bs.status, 'active') as subscription_status
        from public.businesses b left join public.business_subscriptions bs on bs.business_id = b.id
        where b.created_at >= range_from and b.created_at < range_to
        order by b.created_at desc limit 10
      ) recent
    ), '[]'::jsonb)
  );
end;
$$;

-- ============================================================================
-- Source: supabase/migrations/20260908008000_platform_overview_revenue_support_metrics.sql
-- ============================================================================
create or replace function public.get_platform_admin_overview_period(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  range_from timestamptz := coalesce(p_from, '-infinity'::timestamptz);
  range_to timestamptz := coalesce(p_to, 'infinity'::timestamptz);
  month_from timestamptz := date_trunc('month', now() at time zone 'Africa/Porto-Novo') at time zone 'Africa/Porto-Novo';
  previous_month_from timestamptz := date_trunc('month', now() at time zone 'Africa/Porto-Novo') - interval '1 month';
  month_to timestamptz := date_trunc('month', now() at time zone 'Africa/Porto-Novo') + interval '1 month';
begin
  if not public.has_platform_admin_permission('overview') then
    raise exception 'Accès administrateur requis.';
  end if;
  if range_from >= range_to then
    raise exception 'Période d’analyse invalide.';
  end if;
  return jsonb_build_object(
    'business_count', (select count(*) from public.businesses b where b.created_at >= range_from and b.created_at < range_to),
    'member_count', (select count(distinct bm.user_id) from public.business_members bm where bm.created_at >= range_from and bm.created_at < range_to),
    'invoice_count', (select count(*) from public.invoices i where i.issue_date >= (range_from at time zone 'Africa/Porto-Novo')::date and i.issue_date < (range_to at time zone 'Africa/Porto-Novo')::date),
    'revenue', coalesce((select sum(p.amount) from public.payments p where p.payment_date >= (range_from at time zone 'Africa/Porto-Novo')::date and p.payment_date < (range_to at time zone 'Africa/Porto-Novo')::date), 0),
    'subscription_revenue', coalesce((select sum(sp.amount) from public.subscription_payments sp where sp.status = 'completed' and sp.created_at >= range_from and sp.created_at < range_to), 0),
    'revenue_month', coalesce((select sum(sp.amount) from public.subscription_payments sp where sp.status = 'completed' and sp.created_at >= month_from and sp.created_at < month_to), 0),
    'revenue_previous_month', coalesce((select sum(sp.amount) from public.subscription_payments sp where sp.status = 'completed' and sp.created_at >= previous_month_from and sp.created_at < month_from), 0),
    'revenue_change_percent', (
      select case when previous_total = 0 then case when current_total = 0 then 0 else null end
        else round(((current_total - previous_total) / previous_total) * 100, 1) end
      from (
        select
          coalesce((select sum(amount) from public.subscription_payments where status = 'completed' and created_at >= month_from and created_at < month_to), 0)::numeric current_total,
          coalesce((select sum(amount) from public.subscription_payments where status = 'completed' and created_at >= previous_month_from and created_at < month_from), 0)::numeric previous_total
      ) totals
    ),
    'revenue_by_plan', coalesce((
      select jsonb_agg(jsonb_build_object('plan', plan, 'amount', amount, 'payments', payments) order by plan)
      from (
        select sp.plan, sum(sp.amount) amount, count(*) payments
        from public.subscription_payments sp
        where sp.status = 'completed' and sp.created_at >= range_from and sp.created_at < range_to
        group by sp.plan
      ) plans
    ), '[]'::jsonb),
    'failed_payments', (select count(*) from public.subscription_payments where status = 'failed' and created_at >= range_from and created_at < range_to),
    'refund_amount', coalesce((select sum(amount) from public.subscription_payments where status = 'refunded' and created_at >= range_from and created_at < range_to), 0),
    'unpaid_payments', jsonb_build_object(
      'count', (select count(*) from public.subscription_payments where status = 'pending' and created_at >= range_from and created_at < range_to),
      'amount', coalesce((select sum(amount) from public.subscription_payments where status = 'pending' and created_at >= range_from and created_at < range_to), 0)
    ),
    'monthly_recurring_revenue', coalesce((
      select sum(coalesce(sp.price, 0))
      from public.business_subscriptions bs
      left join public.subscription_plans sp on sp.code = bs.plan
      where bs.status in ('active', 'trialing')
    ), 0),
    'currency', coalesce((select currency from public.subscription_plans where status = 'active' order by price desc limit 1), 'XOF'),
    'active_subscriptions', (select count(*) from public.business_subscriptions where status in ('active', 'trialing')),
    'pending_payments', (select count(*) from public.subscription_payments where status = 'pending' and created_at >= range_from and created_at < range_to),
    'open_ticket_count', (select count(*) from public.support_tickets where status in ('open', 'in_progress', 'waiting') and created_at >= range_from and created_at < range_to),
    'urgent_ticket_count', (select count(*) from public.support_tickets where priority = 'urgent' and status in ('open', 'in_progress', 'waiting') and created_at >= range_from and created_at < range_to),
    'unanswered_ticket_count', (select count(*) from public.support_tickets t where t.status in ('open', 'in_progress', 'waiting') and t.created_at >= range_from and t.created_at < range_to and not exists (
      select 1 from public.support_ticket_messages m join public.platform_admins pa on pa.user_id = m.author_id
      where m.ticket_id = t.id and m.internal = false
    )),
    'oldest_open_ticket_hours', (select extract(epoch from (now() - min(created_at))) / 3600 from public.support_tickets where status in ('open', 'in_progress', 'waiting') and created_at >= range_from and created_at < range_to),
    'average_first_response_hours', (select avg(extract(epoch from (first_response - created_at)) / 3600) from (
      select t.created_at, min(m.created_at) first_response
      from public.support_tickets t
      join public.support_ticket_messages m on m.ticket_id = t.id and m.internal = false
      join public.platform_admins pa on pa.user_id = m.author_id
      where t.created_at >= range_from and t.created_at < range_to
      group by t.id
    ) responses),
    'average_resolution_hours', (select avg(extract(epoch from (updated_at - created_at)) / 3600) from public.support_tickets where status in ('resolved', 'closed') and created_at >= range_from and created_at < range_to),
    'sla_at_risk_ticket_count', (select count(*) from public.support_tickets t where t.status in ('open', 'in_progress', 'waiting') and t.created_at >= range_from and t.created_at < range_to and now() - t.created_at >= case t.priority when 'urgent' then interval '2 hours' when 'high' then interval '8 hours' else interval '24 hours' end),
    'tickets_by_priority', coalesce((
      select jsonb_agg(jsonb_build_object('priority', priority, 'count', count) order by priority)
      from (
        select priority, count(*) count
        from public.support_tickets
        where status in ('open', 'in_progress', 'waiting') and created_at >= range_from and created_at < range_to
        group by priority
      ) priorities
    ), '[]'::jsonb),
    'security_alert_count', (select count(*) from public.platform_notifications where severity = 'critical' and read_at is null and created_at >= range_from and created_at < range_to),
    'recent_businesses', coalesce((
      select jsonb_agg(row_to_json(recent)) from (
        select b.id, b.name, b.created_at, coalesce(bs.plan, 'free') as plan, coalesce(bs.status, 'active') as subscription_status
        from public.businesses b left join public.business_subscriptions bs on bs.business_id = b.id
        where b.created_at >= range_from and b.created_at < range_to
        order by b.created_at desc limit 10
      ) recent
    ), '[]'::jsonb)
  );
end;
$$;

notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260908009000_platform_operational_summary.sql
-- ============================================================================
create or replace function public.get_platform_operational_summary()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  checked_at timestamptz := clock_timestamp();
begin
  if not public.has_platform_admin_permission('overview') then
    raise exception 'Accès administrateur requis.';
  end if;
  return jsonb_build_object(
    'health_checks', coalesce((select jsonb_agg(to_jsonb(h)) from public.check_platform_health() h), '[]'::jsonb),
    'active_incident', (select to_jsonb(i) from (
      select id, title, severity, status, started_at from public.platform_incidents
      where status <> 'resolved' order by started_at desc limit 1
    ) i),
    'latest_admin_logins', coalesce((
      select jsonb_agg(jsonb_build_object('actor_email', u.email, 'created_at', l.created_at, 'result', l.result) order by l.created_at desc)
      from public.platform_audit_logs l left join auth.users u on u.id = l.actor_id
      where l.action ilike '%login%' limit 10
    ), '[]'::jsonb),
    'unusual_login_count', (select count(*) from public.platform_audit_logs where (action ilike '%login%' and context->>'unusual' = 'true') or action ilike '%unusual%'),
    'failed_login_count', (select count(*) from public.platform_audit_logs where action ilike '%login%' and result = 'failure' and created_at >= now() - interval '30 days'),
    'suspended_account_count', (select count(*) from public.platform_admins where status = 'suspended'),
    'recent_admin_count', (select count(*) from public.platform_admins where created_at >= now() - interval '30 days'),
    'active_session_count', (select count(*) from auth.sessions where not_after > now()),
    'mfa_enabled_count', (select count(distinct user_id) from auth.mfa_factors where status = 'verified' and user_id in (select user_id from public.platform_admins)),
    'mfa_total_count', (select count(*) from public.platform_admins),
    'recent_critical_actions', coalesce((
      select jsonb_agg(jsonb_build_object('action', l.action, 'resource_type', l.resource_type, 'actor_email', u.email, 'created_at', l.created_at, 'result', l.result) order by l.created_at desc)
      from public.platform_audit_logs l left join auth.users u on u.id = l.actor_id
      where l.action in ('disable', 'delete', 'update_role', 'access_denied') or l.resource_type ilike '%security%'
      limit 10
    ), '[]'::jsonb),
    'checked_at', checked_at
  );
end;
$$;

revoke all on function public.get_platform_operational_summary() from public, anon;
grant execute on function public.get_platform_operational_summary() to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260908010000_platform_activity_timeline.sql
-- ============================================================================
create or replace function public.list_platform_activity(p_limit integer default 20)
returns table (
  id text,
  type text,
  label text,
  detail text,
  created_at timestamptz,
  resource_type text,
  resource_id uuid
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('overview') then
    raise exception 'Accès administrateur requis.';
  end if;
  return query
  select event.id, event.type, event.label, event.detail, event.created_at, event.resource_type, event.resource_id
  from (
    select ('business-' || b.id::text) id, 'business' type, 'Entreprise créée' label, b.name detail, b.created_at, 'business' resource_type, b.id resource_id
    from public.businesses b
    union all
    select ('member-' || bm.user_id::text || '-' || extract(epoch from bm.created_at)::text), 'user', 'Utilisateur inscrit', coalesce(u.email, 'Utilisateur'), bm.created_at, 'user', bm.user_id
    from public.business_members bm left join auth.users u on u.id = bm.user_id
    union all
    select ('payment-' || p.id::text), 'payment', case when p.status = 'completed' then 'Paiement reçu' else 'Paiement ' || p.status end, p.amount::text || ' ' || p.currency, p.created_at, 'subscription_payment', p.id
    from public.subscription_payments p
    union all
    select ('ticket-' || t.id::text), 'ticket', 'Ticket ouvert', t.subject, t.created_at, 'support_ticket', t.id
    from public.support_tickets t
    union all
    select ('incident-' || i.id::text), 'incident', 'Incident déclaré', i.title, i.started_at, 'platform_incident', i.id
    from public.platform_incidents i
    union all
    select ('setting-' || l.id::text), 'setting', 'Paramètre modifié', l.action, l.created_at, l.resource_type, l.resource_id
    from public.platform_audit_logs l where l.resource_type ilike '%setting%'
    union all
    select ('login-' || l.id::text), 'login', 'Administrateur connecté', coalesce(u.email, 'Administrateur'), l.created_at, 'admin_login', l.actor_id
    from public.platform_audit_logs l left join auth.users u on u.id = l.actor_id where l.action ilike '%login%'
    union all
    select ('subscription-' || h.id::text), 'subscription', 'Abonnement changé', h.from_plan || ' → ' || h.to_plan, h.created_at, 'business_subscription', h.subscription_id
    from public.subscription_plan_history h
  ) event
  order by event.created_at desc
  limit greatest(1, least(p_limit, 100));
end;
$$;

revoke all on function public.list_platform_activity(integer) from public, anon;
grant execute on function public.list_platform_activity(integer) to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20260908011000_platform_overview_role_masking.sql
-- ============================================================================
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

-- ============================================================================
-- Source: supabase/migrations/20260908012000_platform_growth_metrics.sql
-- ============================================================================
insert into public.platform_settings(key, value)
values ('monthly_revenue_goal', '{"amount":1000000,"currency":"XOF"}')
on conflict (key) do nothing;

create or replace function public.get_platform_growth_metrics(p_from timestamptz default null, p_to timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  from_at timestamptz := coalesce(p_from, date_trunc('month', now()));
  to_at timestamptz := coalesce(p_to, now());
  previous_from timestamptz := from_at - (to_at - from_at);
  current_revenue numeric := coalesce((select sum(amount) from subscription_payments where status in ('paid','succeeded') and created_at >= from_at and created_at < to_at), 0);
  previous_revenue numeric := coalesce((select sum(amount) from subscription_payments where status in ('paid','succeeded') and created_at >= previous_from and created_at < from_at), 0);
  goal numeric := coalesce((select ((value::jsonb)->>'amount')::numeric from platform_settings where key = 'monthly_revenue_goal'), 1000000);
  active_start bigint := (select count(*) from businesses where created_at < from_at);
  active_end bigint := (select count(*) from businesses where created_at < to_at);
  churned bigint := (select count(*) from businesses where platform_status in ('cancelled','suspended','expired') and updated_at >= from_at and updated_at < to_at);
begin
  return jsonb_build_object(
    'monthly_revenue_goal', goal,
    'goal_progress_percent', case when goal > 0 then round(current_revenue / goal * 100, 1) else 0 end,
    'growth_percent', case when previous_revenue > 0 then round((current_revenue - previous_revenue) / previous_revenue * 100, 1) else null end,
    'retention_rate', case when active_start > 0 then round(greatest(active_start - churned, 0)::numeric / active_start * 100, 1) else 100 end,
    'churn_rate', case when active_start > 0 then round(churned::numeric / active_start * 100, 1) else 0 end
  );
end;
$$;

grant execute on function public.get_platform_growth_metrics(timestamptz, timestamptz) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260908013000_platform_search_metadata.sql
-- ============================================================================
drop function if exists public.search_platform_global(text, integer);

create function public.search_platform_global(p_query text, p_limit integer default 20)
returns table (category text, label text, resource_id uuid, status text, last_activity_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare q text := lower(trim(coalesce(p_query, ''))); n integer := greatest(1, least(coalesce(p_limit, 20), 20));
begin
  if length(q) < 2 then return; end if;
  if public.has_platform_admin_permission('businesses') then
    return query select 'Entreprise', b.name, b.id, null::text, b.updated_at from businesses b where lower(coalesce(b.name,'')) like '%'||q||'%' order by b.updated_at desc limit n;
  end if;
  if public.has_platform_admin_permission('users') then
    return query select 'Utilisateur', coalesce(u.raw_user_meta_data->>'full_name', u.email::text), u.id, null::text, u.last_sign_in_at from auth.users u where lower(coalesce(u.email::text,'')||' '||coalesce(u.raw_user_meta_data->>'full_name','')) like '%'||q||'%' order by u.last_sign_in_at desc nulls last limit n;
  end if;
  if public.has_platform_admin_permission('subscription_payments') then
    return query select 'Transaction', '#'||left(p.id::text,8)||' · '||b.name, p.id, p.status, p.created_at from subscription_payments p join businesses b on b.id=p.business_id where lower(p.id::text||' '||b.name||' '||p.status) like '%'||q||'%' order by p.created_at desc limit n;
  end if;
  if public.has_platform_admin_permission('support') then
    return query select 'Ticket', '#'||left(t.id::text,8)||' · '||t.subject, t.id, t.status, t.updated_at from support_tickets t where lower(t.id::text||' '||coalesce(t.subject,'')) like '%'||q||'%' order by t.updated_at desc limit n;
  end if;
end;
$$;
grant execute on function public.search_platform_global(text, integer) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260908014000_platform_search_complete_metadata.sql
-- ============================================================================
drop function if exists public.search_platform_global(text, integer);

create function public.search_platform_global(p_query text, p_limit integer default 20)
returns table (category text, label text, resource_id uuid, status text, last_activity_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare q text := lower(trim(coalesce(p_query, ''))); n integer := greatest(1, least(coalesce(p_limit, 20), 20));
begin
  if length(q) < 2 then return; end if;
  if public.has_platform_admin_permission('businesses') then
    return query select 'Entreprise', b.name, b.id, b.platform_status, b.updated_at from businesses b where lower(coalesce(b.name,'')) like '%'||q||'%' order by b.updated_at desc limit n;
  end if;
  if public.has_platform_admin_permission('users') then
    return query select 'Utilisateur', coalesce(u.raw_user_meta_data->>'full_name', u.email::text), u.id, null::text, u.last_sign_in_at from auth.users u where lower(coalesce(u.email::text,'')||' '||coalesce(u.raw_user_meta_data->>'full_name','')) like '%'||q||'%' order by u.last_sign_in_at desc nulls last limit n;
  end if;
  if public.has_platform_admin_permission('subscriptions') then
    return query select 'Abonnement', b.name||' · '||s.plan, s.id, s.status, s.updated_at from business_subscriptions s join businesses b on b.id=s.business_id where lower(b.name||' '||s.plan||' '||s.status) like '%'||q||'%' order by s.updated_at desc limit n;
  end if;
  if public.has_platform_admin_permission('subscription_payments') then
    return query select 'Transaction', '#'||left(p.id::text,8)||' · '||b.name, p.id, p.status, p.created_at from subscription_payments p join businesses b on b.id=p.business_id where lower(p.id::text||' '||b.name||' '||p.status) like '%'||q||'%' order by p.created_at desc limit n;
  end if;
  if public.has_platform_admin_permission('support') then
    return query select 'Ticket', '#'||left(t.id::text,8)||' · '||t.subject, t.id, t.status, t.updated_at from support_tickets t where lower(t.id::text||' '||coalesce(t.subject,'')) like '%'||q||'%' order by t.updated_at desc limit n;
  end if;
  if public.has_platform_admin_permission('incidents') then
    return query select 'Incident', i.title||' · '||i.service, i.id, i.status, i.started_at from platform_incidents i where lower(i.title||' '||i.service||' '||i.status) like '%'||q||'%' order by i.started_at desc limit n;
  end if;
end;
$$;
grant execute on function public.search_platform_global(text, integer) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260908150000_owner_business_metadata.sql
-- ============================================================================
alter table public.clients
  add column if not exists client_type text not null default 'individual' check (client_type in ('individual', 'company')),
  add column if not exists notes text,
  add column if not exists status text not null default 'active' check (status in ('active', 'archived')),
  add column if not exists archived_at timestamptz;

alter table public.products
  add column if not exists reference text,
  add column if not exists category text not null default 'other',
  add column if not exists sub_category text,
  add column if not exists active boolean not null default true;

-- ============================================================================
-- Source: supabase/migrations/20260908151000_real_schema_rls.sql
-- ============================================================================
-- ============================================================
-- FactureFacile - RLS exact sur le schéma réel du projet
-- ============================================================
-- Ce fichier cible les tables réellement présentes dans le repo
-- et sécurise l'accès par entreprise + rôle plateforme.
-- ============================================================

create or replace function public.is_business_member(p_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and b.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.business_members bm
    where bm.business_id = p_business_id
      and bm.user_id = auth.uid()
  );
$$;

create or replace function public.is_business_admin(p_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and b.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.business_members bm
    where bm.business_id = p_business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  );
$$;

create or replace function public.is_business_owner(p_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and b.owner_id = auth.uid()
  );
$$;

create or replace function public.is_platform_super_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = auth.uid()
      and pa.role = 'super_admin'
  );
$$;

-- ============================================================
-- Activation RLS sur les tables réelles du projet
-- ============================================================
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'businesses',
    'clients',
    'products',
    'stock_movements',
    'invoices',
    'invoice_items',
    'payments',
    'expenses',
    'business_members',
    'business_invitations',
    'business_subscriptions',
    'subscription_payments',
    'audit_logs',
    'recurring_invoices',
    'recurring_invoice_runs',
    'invoice_counters',
    'invoice_reminders',
    'platform_admins',
    'platform_notifications',
    'platform_notification_preferences',
    'platform_notification_deliveries',
    'support_tickets',
    'support_ticket_messages',
    'platform_audit_logs',
    'platform_incidents',
    'platform_integrations',
    'platform_content',
    'platform_settings',
    'subscription_plans',
    'subscription_plan_history'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);
    end if;
  end loop;
end $$;

-- ============================================================
-- Table: businesses
-- ============================================================
drop policy if exists "businesses_select_own_business" on public.businesses;
drop policy if exists "businesses_select_own_business" on public.businesses;
create policy "businesses_select_own_business" on public.businesses
for select
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.business_members bm where bm.business_id = businesses.id and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "businesses_update_own_business" on public.businesses;
drop policy if exists "businesses_update_own_business" on public.businesses;
create policy "businesses_update_own_business" on public.businesses
for update
using (
  owner_id = auth.uid()
  or public.is_platform_super_admin()
)
with check (
  owner_id = auth.uid()
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: business_members
-- ============================================================
drop policy if exists "business_members_select_own_business" on public.business_members;
drop policy if exists "business_members_select_own_business" on public.business_members;
create policy "business_members_select_own_business" on public.business_members
for select
using (
  public.is_business_member(business_members.business_id)
  or public.is_platform_super_admin()
);

drop policy if exists "business_members_insert_own_business" on public.business_members;
drop policy if exists "business_members_insert_own_business" on public.business_members;
create policy "business_members_insert_own_business" on public.business_members
for insert
with check (
  public.is_business_admin(business_members.business_id)
  or public.is_platform_super_admin()
);

drop policy if exists "business_members_update_own_business" on public.business_members;
drop policy if exists "business_members_update_own_business" on public.business_members;
create policy "business_members_update_own_business" on public.business_members
for update
using (
  public.is_business_admin(business_members.business_id)
  or public.is_platform_super_admin()
)
with check (
  public.is_business_admin(business_members.business_id)
  or public.is_platform_super_admin()
);

drop policy if exists "business_members_delete_own_business" on public.business_members;
drop policy if exists "business_members_delete_own_business" on public.business_members;
create policy "business_members_delete_own_business" on public.business_members
for delete
using (
  public.is_business_admin(business_members.business_id)
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: business_invitations
-- ============================================================
drop policy if exists "business_invitations_select_own_business" on public.business_invitations;
drop policy if exists "business_invitations_select_own_business" on public.business_invitations;
create policy "business_invitations_select_own_business" on public.business_invitations
for select
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = business_invitations.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "business_invitations_insert_own_business" on public.business_invitations;
drop policy if exists "business_invitations_insert_own_business" on public.business_invitations;
create policy "business_invitations_insert_own_business" on public.business_invitations
for insert
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = business_invitations.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "business_invitations_update_own_business" on public.business_invitations;
drop policy if exists "business_invitations_update_own_business" on public.business_invitations;
create policy "business_invitations_update_own_business" on public.business_invitations
for update
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = business_invitations.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = business_invitations.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: clients
-- ============================================================
drop policy if exists "clients_select_own_business" on public.clients;
drop policy if exists "clients_select_own_business" on public.clients;
create policy "clients_select_own_business" on public.clients
for select
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = clients.business_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "clients_insert_own_business" on public.clients;
drop policy if exists "clients_insert_own_business" on public.clients;
create policy "clients_insert_own_business" on public.clients
for insert
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = clients.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin', 'member')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "clients_update_own_business" on public.clients;
drop policy if exists "clients_update_own_business" on public.clients;
create policy "clients_update_own_business" on public.clients
for update
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = clients.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = clients.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "clients_delete_own_business" on public.clients;
drop policy if exists "clients_delete_own_business" on public.clients;
create policy "clients_delete_own_business" on public.clients
for delete
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = clients.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: products
-- ============================================================
drop policy if exists "products_select_own_business" on public.products;
drop policy if exists "products_select_own_business" on public.products;
create policy "products_select_own_business" on public.products
for select
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = products.business_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "products_insert_own_business" on public.products;
drop policy if exists "products_insert_own_business" on public.products;
create policy "products_insert_own_business" on public.products
for insert
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = products.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin', 'member')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "products_update_own_business" on public.products;
drop policy if exists "products_update_own_business" on public.products;
create policy "products_update_own_business" on public.products
for update
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = products.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = products.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "products_delete_own_business" on public.products;
drop policy if exists "products_delete_own_business" on public.products;
create policy "products_delete_own_business" on public.products
for delete
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = products.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: stock_movements
-- ============================================================
drop policy if exists "stock_movements_select_own_business" on public.stock_movements;
drop policy if exists "stock_movements_select_own_business" on public.stock_movements;
create policy "stock_movements_select_own_business" on public.stock_movements
for select
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = stock_movements.business_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "stock_movements_insert_own_business" on public.stock_movements;
drop policy if exists "stock_movements_insert_own_business" on public.stock_movements;
create policy "stock_movements_insert_own_business" on public.stock_movements
for insert
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = stock_movements.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin', 'member')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "stock_movements_update_own_business" on public.stock_movements;
drop policy if exists "stock_movements_update_own_business" on public.stock_movements;
create policy "stock_movements_update_own_business" on public.stock_movements
for update
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = stock_movements.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = stock_movements.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: invoices
-- ============================================================
drop policy if exists "invoices_select_own_business" on public.invoices;
drop policy if exists "invoices_select_own_business" on public.invoices;
create policy "invoices_select_own_business" on public.invoices
for select
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = invoices.business_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "invoices_insert_own_business" on public.invoices;
drop policy if exists "invoices_insert_own_business" on public.invoices;
create policy "invoices_insert_own_business" on public.invoices
for insert
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = invoices.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin', 'member')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "invoices_update_own_business" on public.invoices;
drop policy if exists "invoices_update_own_business" on public.invoices;
create policy "invoices_update_own_business" on public.invoices
for update
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = invoices.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = invoices.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "invoices_delete_own_business" on public.invoices;
drop policy if exists "invoices_delete_own_business" on public.invoices;
create policy "invoices_delete_own_business" on public.invoices
for delete
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = invoices.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: invoice_items
-- ============================================================
drop policy if exists "invoice_items_select_own_business" on public.invoice_items;
drop policy if exists "invoice_items_select_own_business" on public.invoice_items;
create policy "invoice_items_select_own_business" on public.invoice_items
for select
using (
  exists (
    select 1
    from public.invoices inv
    join public.business_members bm on bm.business_id = inv.business_id
    where inv.id = invoice_items.invoice_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "invoice_items_insert_own_business" on public.invoice_items;
drop policy if exists "invoice_items_insert_own_business" on public.invoice_items;
create policy "invoice_items_insert_own_business" on public.invoice_items
for insert
with check (
  exists (
    select 1
    from public.invoices inv
    join public.business_members bm on bm.business_id = inv.business_id
    where inv.id = invoice_items.invoice_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin', 'member')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "invoice_items_update_own_business" on public.invoice_items;
drop policy if exists "invoice_items_update_own_business" on public.invoice_items;
create policy "invoice_items_update_own_business" on public.invoice_items
for update
using (
  exists (
    select 1
    from public.invoices inv
    join public.business_members bm on bm.business_id = inv.business_id
    where inv.id = invoice_items.invoice_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
)
with check (
  exists (
    select 1
    from public.invoices inv
    join public.business_members bm on bm.business_id = inv.business_id
    where inv.id = invoice_items.invoice_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: payments
-- ============================================================
drop policy if exists "payments_select_own_business" on public.payments;
drop policy if exists "payments_select_own_business" on public.payments;
create policy "payments_select_own_business" on public.payments
for select
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = payments.business_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "payments_insert_own_business" on public.payments;
drop policy if exists "payments_insert_own_business" on public.payments;
create policy "payments_insert_own_business" on public.payments
for insert
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = payments.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin', 'member')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "payments_update_own_business" on public.payments;
drop policy if exists "payments_update_own_business" on public.payments;
create policy "payments_update_own_business" on public.payments
for update
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = payments.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = payments.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: expenses
-- ============================================================
drop policy if exists "expenses_select_own_business" on public.expenses;
drop policy if exists "expenses_select_own_business" on public.expenses;
create policy "expenses_select_own_business" on public.expenses
for select
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = expenses.business_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "expenses_insert_own_business" on public.expenses;
drop policy if exists "expenses_insert_own_business" on public.expenses;
create policy "expenses_insert_own_business" on public.expenses
for insert
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = expenses.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin', 'member')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "expenses_update_own_business" on public.expenses;
drop policy if exists "expenses_update_own_business" on public.expenses;
create policy "expenses_update_own_business" on public.expenses
for update
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = expenses.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = expenses.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "expenses_delete_own_business" on public.expenses;
drop policy if exists "expenses_delete_own_business" on public.expenses;
create policy "expenses_delete_own_business" on public.expenses
for delete
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = expenses.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: business_subscriptions
-- ============================================================
drop policy if exists "business_subscriptions_select_own_business" on public.business_subscriptions;
drop policy if exists "business_subscriptions_select_own_business" on public.business_subscriptions;
create policy "business_subscriptions_select_own_business" on public.business_subscriptions
for select
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = business_subscriptions.business_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "business_subscriptions_update_own_business" on public.business_subscriptions;
drop policy if exists "business_subscriptions_update_own_business" on public.business_subscriptions;
create policy "business_subscriptions_update_own_business" on public.business_subscriptions
for update
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = business_subscriptions.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = business_subscriptions.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: subscription_payments
-- ============================================================
drop policy if exists "subscription_payments_select_own_business" on public.subscription_payments;
drop policy if exists "subscription_payments_select_own_business" on public.subscription_payments;
create policy "subscription_payments_select_own_business" on public.subscription_payments
for select
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = subscription_payments.business_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "subscription_payments_update_own_business" on public.subscription_payments;
drop policy if exists "subscription_payments_update_own_business" on public.subscription_payments;
create policy "subscription_payments_update_own_business" on public.subscription_payments
for update
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = subscription_payments.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = subscription_payments.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: audit_logs
-- ============================================================
drop policy if exists "audit_logs_select_own_business" on public.audit_logs;
drop policy if exists "audit_logs_select_own_business" on public.audit_logs;
create policy "audit_logs_select_own_business" on public.audit_logs
for select
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = audit_logs.business_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "audit_logs_insert_own_business" on public.audit_logs;
drop policy if exists "audit_logs_insert_own_business" on public.audit_logs;
create policy "audit_logs_insert_own_business" on public.audit_logs
for insert
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = audit_logs.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: recurring_invoices
-- ============================================================
drop policy if exists "recurring_invoices_select_own_business" on public.recurring_invoices;
drop policy if exists "recurring_invoices_select_own_business" on public.recurring_invoices;
create policy "recurring_invoices_select_own_business" on public.recurring_invoices
for select
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = recurring_invoices.business_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "recurring_invoices_update_own_business" on public.recurring_invoices;
drop policy if exists "recurring_invoices_update_own_business" on public.recurring_invoices;
create policy "recurring_invoices_update_own_business" on public.recurring_invoices
for update
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = recurring_invoices.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = recurring_invoices.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: recurring_invoice_runs
-- ============================================================
drop policy if exists "recurring_invoice_runs_select_own_business" on public.recurring_invoice_runs;
drop policy if exists "recurring_invoice_runs_select_own_business" on public.recurring_invoice_runs;
create policy "recurring_invoice_runs_select_own_business" on public.recurring_invoice_runs
for select
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = recurring_invoice_runs.business_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: invoice_counters
-- ============================================================
drop policy if exists "invoice_counters_select_own_business" on public.invoice_counters;
drop policy if exists "invoice_counters_select_own_business" on public.invoice_counters;
create policy "invoice_counters_select_own_business" on public.invoice_counters
for select
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = invoice_counters.business_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "invoice_counters_update_own_business" on public.invoice_counters;
drop policy if exists "invoice_counters_update_own_business" on public.invoice_counters;
create policy "invoice_counters_update_own_business" on public.invoice_counters
for update
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = invoice_counters.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = invoice_counters.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: invoice_reminders
-- ============================================================
drop policy if exists "invoice_reminders_select_own_business" on public.invoice_reminders;
drop policy if exists "invoice_reminders_select_own_business" on public.invoice_reminders;
create policy "invoice_reminders_select_own_business" on public.invoice_reminders
for select
using (
  exists (
    select 1
    from public.invoices inv
    join public.business_members bm on bm.business_id = inv.business_id
    where inv.id = invoice_reminders.invoice_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "invoice_reminders_update_own_business" on public.invoice_reminders;
drop policy if exists "invoice_reminders_update_own_business" on public.invoice_reminders;
create policy "invoice_reminders_update_own_business" on public.invoice_reminders
for update
using (
  exists (
    select 1
    from public.invoices inv
    join public.business_members bm on bm.business_id = inv.business_id
    where inv.id = invoice_reminders.invoice_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
)
with check (
  exists (
    select 1
    from public.invoices inv
    join public.business_members bm on bm.business_id = inv.business_id
    where inv.id = invoice_reminders.invoice_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Platform / admin tables
-- ============================================================
drop policy if exists "platform_admins_only_super_admin" on public.platform_admins;
drop policy if exists "platform_admins_only_super_admin" on public.platform_admins;
create policy "platform_admins_only_super_admin" on public.platform_admins
for all
using (public.is_platform_super_admin())
with check (public.is_platform_super_admin());

drop policy if exists "support_tickets_select_own_business" on public.support_tickets;
drop policy if exists "support_tickets_select_own_business" on public.support_tickets;
create policy "support_tickets_select_own_business" on public.support_tickets
for select
using (
  business_id is null and auth.uid() is not null
  or exists (
    select 1 from public.business_members bm
    where bm.business_id = support_tickets.business_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "support_tickets_insert_own_business" on public.support_tickets;
drop policy if exists "support_tickets_insert_own_business" on public.support_tickets;
create policy "support_tickets_insert_own_business" on public.support_tickets
for insert
with check (
  (business_id is not null and exists (
    select 1 from public.business_members bm
    where bm.business_id = support_tickets.business_id
      and bm.user_id = auth.uid()
  ))
  or public.is_platform_super_admin()
);

drop policy if exists "support_tickets_update_own_business" on public.support_tickets;
drop policy if exists "support_tickets_update_own_business" on public.support_tickets;
create policy "support_tickets_update_own_business" on public.support_tickets
for update
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = support_tickets.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = support_tickets.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "support_ticket_messages_select_own_business" on public.support_ticket_messages;
drop policy if exists "support_ticket_messages_select_own_business" on public.support_ticket_messages;
create policy "support_ticket_messages_select_own_business" on public.support_ticket_messages
for select
using (
  exists (
    select 1
    from public.support_tickets t
    join public.business_members bm on bm.business_id = t.business_id
    where t.id = support_ticket_messages.ticket_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "support_ticket_messages_insert_own_business" on public.support_ticket_messages;
drop policy if exists "support_ticket_messages_insert_own_business" on public.support_ticket_messages;
create policy "support_ticket_messages_insert_own_business" on public.support_ticket_messages
for insert
with check (
  exists (
    select 1
    from public.support_tickets t
    join public.business_members bm on bm.business_id = t.business_id
    where t.id = support_ticket_messages.ticket_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin', 'member')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "platform_notifications_select_own_user" on public.platform_notifications;
drop policy if exists "platform_notifications_select_own_user" on public.platform_notifications;
create policy "platform_notifications_select_own_user" on public.platform_notifications
for select
using (
  recipient_user_id = auth.uid()
  or recipient_role is null
  or public.is_platform_super_admin()
);

drop policy if exists "platform_notifications_update_own_user" on public.platform_notifications;
drop policy if exists "platform_notifications_update_own_user" on public.platform_notifications;
create policy "platform_notifications_update_own_user" on public.platform_notifications
for update
using (
  recipient_user_id = auth.uid()
  or public.is_platform_super_admin()
)
with check (
  recipient_user_id = auth.uid()
  or public.is_platform_super_admin()
);

drop policy if exists "platform_notification_preferences_select_own_user" on public.platform_notification_preferences;
drop policy if exists "platform_notification_preferences_select_own_user" on public.platform_notification_preferences;
create policy "platform_notification_preferences_select_own_user" on public.platform_notification_preferences
for select
using (user_id = auth.uid() or public.is_platform_super_admin());

drop policy if exists "platform_notification_preferences_update_own_user" on public.platform_notification_preferences;
drop policy if exists "platform_notification_preferences_update_own_user" on public.platform_notification_preferences;
create policy "platform_notification_preferences_update_own_user" on public.platform_notification_preferences
for update
using (user_id = auth.uid() or public.is_platform_super_admin())
with check (user_id = auth.uid() or public.is_platform_super_admin());

drop policy if exists "platform_notification_deliveries_select_own_user" on public.platform_notification_deliveries;
drop policy if exists "platform_notification_deliveries_select_own_user" on public.platform_notification_deliveries;
create policy "platform_notification_deliveries_select_own_user" on public.platform_notification_deliveries
for select
using (user_id = auth.uid() or public.is_platform_super_admin());

drop policy if exists "platform_notification_deliveries_update_own_user" on public.platform_notification_deliveries;
drop policy if exists "platform_notification_deliveries_update_own_user" on public.platform_notification_deliveries;
create policy "platform_notification_deliveries_update_own_user" on public.platform_notification_deliveries
for update
using (user_id = auth.uid() or public.is_platform_super_admin())
with check (user_id = auth.uid() or public.is_platform_super_admin());

drop policy if exists "platform_audit_logs_super_admin_only" on public.platform_audit_logs;
drop policy if exists "platform_audit_logs_super_admin_only" on public.platform_audit_logs;
create policy "platform_audit_logs_super_admin_only" on public.platform_audit_logs
for all
using (public.is_platform_super_admin())
with check (public.is_platform_super_admin());

drop policy if exists "platform_incidents_super_admin_only" on public.platform_incidents;
drop policy if exists "platform_incidents_super_admin_only" on public.platform_incidents;
create policy "platform_incidents_super_admin_only" on public.platform_incidents
for all
using (public.is_platform_super_admin())
with check (public.is_platform_super_admin());

drop policy if exists "platform_integrations_super_admin_only" on public.platform_integrations;
drop policy if exists "platform_integrations_super_admin_only" on public.platform_integrations;
create policy "platform_integrations_super_admin_only" on public.platform_integrations
for all
using (public.is_platform_super_admin())
with check (public.is_platform_super_admin());

drop policy if exists "platform_content_super_admin_only" on public.platform_content;
drop policy if exists "platform_content_super_admin_only" on public.platform_content;
create policy "platform_content_super_admin_only" on public.platform_content
for all
using (public.is_platform_super_admin())
with check (public.is_platform_super_admin());

drop policy if exists "platform_settings_super_admin_only" on public.platform_settings;
drop policy if exists "platform_settings_super_admin_only" on public.platform_settings;
create policy "platform_settings_super_admin_only" on public.platform_settings
for all
using (public.is_platform_super_admin())
with check (public.is_platform_super_admin());

drop policy if exists "subscription_plans_super_admin_only" on public.subscription_plans;
drop policy if exists "subscription_plans_super_admin_only" on public.subscription_plans;
create policy "subscription_plans_super_admin_only" on public.subscription_plans
for all
using (public.is_platform_super_admin())
with check (public.is_platform_super_admin());

drop policy if exists "subscription_plan_history_super_admin_only" on public.subscription_plan_history;
drop policy if exists "subscription_plan_history_super_admin_only" on public.subscription_plan_history;
create policy "subscription_plan_history_super_admin_only" on public.subscription_plan_history
for all
using (public.is_platform_super_admin())
with check (public.is_platform_super_admin());

-- ============================================================
-- Fin : vérification rapide
-- ============================================================
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'businesses', 'clients', 'products', 'stock_movements', 'invoices', 'invoice_items', 'payments', 'expenses',
    'business_members', 'business_invitations', 'business_subscriptions', 'subscription_payments', 'audit_logs',
    'recurring_invoices', 'recurring_invoice_runs', 'invoice_counters', 'invoice_reminders',
    'platform_admins', 'platform_notifications', 'platform_notification_preferences', 'platform_notification_deliveries',
    'support_tickets', 'support_ticket_messages', 'platform_audit_logs', 'platform_incidents', 'platform_integrations',
    'platform_content', 'platform_settings', 'subscription_plans', 'subscription_plan_history'
  )
order by tablename;

-- ============================================================================
-- Source: supabase/migrations/20260908_recurring_subscription_limits.sql
-- ============================================================================
alter table public.recurring_invoice_runs
  drop constraint if exists recurring_invoice_runs_status_check;

alter table public.recurring_invoice_runs
  add constraint recurring_invoice_runs_status_check
  check (status in ('issued', 'skipped_stock', 'skipped_subscription'));

drop policy if exists "team members read recurring invoice runs" on public.recurring_invoice_runs;
drop policy if exists "team members read recurring invoice runs" on public.recurring_invoice_runs;
create policy "team members read recurring invoice runs" on public.recurring_invoice_runs
  for select using (public.is_business_member(business_id, 'viewer'));

create or replace function public.process_due_recurring_invoices()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  recurring record;
  subscription_row record;
  invoice_id uuid;
  invoice_number text;
  processed integer := 0;
  invoice_count integer;
  next_date date;
begin
  perform pg_advisory_xact_lock(hashtext('facturefacile:recurring-invoices'));

  for recurring in
    select r.*, p.name as product_name, p.price as product_price, p.product_type, p.stock_quantity
    from public.recurring_invoices r
    join public.products p on p.id = r.product_id and p.business_id = r.business_id
    where r.active = true and r.next_issue_date <= current_date
    order by r.next_issue_date, r.created_at
  loop
    next_date := case recurring.frequency
      when 'weekly' then recurring.next_issue_date + 7
      when 'monthly' then (recurring.next_issue_date + interval '1 month')::date
      when 'quarterly' then (recurring.next_issue_date + interval '3 months')::date
      when 'yearly' then (recurring.next_issue_date + interval '1 year')::date
    end;

    select *
    into subscription_row
    from public.business_subscriptions
    where business_id = recurring.business_id
    for update;

    if not found
      or subscription_row.status not in ('active', 'trialing')
      or (subscription_row.expires_at is not null and subscription_row.expires_at < now()) then
      insert into public.recurring_invoice_runs (
        recurring_invoice_id, business_id, issue_date, status, message
      ) values (
        recurring.id, recurring.business_id, recurring.next_issue_date,
        'skipped_subscription', 'Abonnement inactif, expiré ou non configuré.'
      );
      update public.recurring_invoices
      set next_issue_date = next_date
      where id = recurring.id;
      continue;
    end if;

    select count(*)::integer
    into invoice_count
    from public.invoices
    where business_id = recurring.business_id
      and issue_date >= date_trunc('month', recurring.next_issue_date)::date
      and issue_date < (date_trunc('month', recurring.next_issue_date) + interval '1 month')::date
      and status <> 'CANCELLED';

    if invoice_count >= subscription_row.monthly_invoice_limit then
      insert into public.recurring_invoice_runs (
        recurring_invoice_id, business_id, issue_date, status, message
      ) values (
        recurring.id, recurring.business_id, recurring.next_issue_date,
        'skipped_subscription', format('Limite mensuelle de %s factures atteinte.', subscription_row.monthly_invoice_limit)
      );
      update public.recurring_invoices
      set next_issue_date = next_date
      where id = recurring.id;
      continue;
    end if;

    if recurring.product_type = 'product' and recurring.stock_quantity < 1 then
      insert into public.recurring_invoice_runs (
        recurring_invoice_id, business_id, issue_date, status, message
      ) values (
        recurring.id, recurring.business_id, recurring.next_issue_date,
        'skipped_stock', 'Stock insuffisant pour générer la facture.'
      );
      continue;
    end if;

    invoice_number := public.next_invoice_number(recurring.business_id, extract(year from recurring.next_issue_date)::integer);
    insert into public.invoices (
      business_id, client_id, invoice_number, issue_date, due_date,
      status, subtotal, total
    ) values (
      recurring.business_id, recurring.client_id, invoice_number, recurring.next_issue_date,
      recurring.next_issue_date + recurring.due_days, 'SENT',
      recurring.product_price, recurring.product_price
    ) returning id into invoice_id;

    insert into public.invoice_items (
      invoice_id, product_id, description, quantity, unit_price
    ) values (
      invoice_id, recurring.product_id, recurring.product_name, 1, recurring.product_price
    );

    if recurring.product_type = 'product' then
      update public.products
      set stock_quantity = stock_quantity - 1, updated_at = now()
      where id = recurring.product_id and business_id = recurring.business_id and stock_quantity >= 1;

      if not found then
        raise exception 'Stock insuffisant pour la récurrence %', recurring.id;
      end if;

      insert into public.stock_movements (
        business_id, product_id, quantity, movement_type, note
      ) values (
        recurring.business_id, recurring.product_id, -1,
        'out', format('Vente récurrente liée à %s', invoice_number)
      );
    end if;

    update public.recurring_invoices
    set next_issue_date = next_date, last_issued_date = recurring.next_issue_date
    where id = recurring.id;

    insert into public.recurring_invoice_runs (
      recurring_invoice_id, business_id, issue_date, status, invoice_id, message
    ) values (
      recurring.id, recurring.business_id, recurring.next_issue_date,
      'issued', invoice_id, 'Facture générée automatiquement.'
    );

    processed := processed + 1;
  end loop;

  return processed;
end;
$$;

revoke all on function public.process_due_recurring_invoices() from public, anon, authenticated;
grant execute on function public.process_due_recurring_invoices() to service_role;

-- ============================================================================
-- Source: supabase/migrations/20260909130000_fix_business_member_rls_recursion.sql
-- ============================================================================
-- Avoid recursive evaluation between businesses and business_members policies.
drop policy if exists "business_members_select_own_business" on public.business_members;
drop policy if exists "business_members_select_own_business" on public.business_members;
create policy "business_members_select_own_business" on public.business_members
for select
using (
  public.is_business_member(business_members.business_id, 'viewer')
  or public.is_platform_super_admin()
);

drop policy if exists "business_members_insert_own_business" on public.business_members;
drop policy if exists "business_members_insert_own_business" on public.business_members;
create policy "business_members_insert_own_business" on public.business_members
for insert
with check (
  public.is_business_admin(business_members.business_id)
  or public.is_platform_super_admin()
);

drop policy if exists "business_members_update_own_business" on public.business_members;
drop policy if exists "business_members_update_own_business" on public.business_members;
create policy "business_members_update_own_business" on public.business_members
for update
using (
  public.is_business_admin(business_members.business_id)
  or public.is_platform_super_admin()
)
with check (
  public.is_business_admin(business_members.business_id)
  or public.is_platform_super_admin()
);

drop policy if exists "business_members_delete_own_business" on public.business_members;
drop policy if exists "business_members_delete_own_business" on public.business_members;
create policy "business_members_delete_own_business" on public.business_members
for delete
using (
  public.is_business_admin(business_members.business_id)
  or public.is_platform_super_admin()
);

-- ============================================================================
-- Source: supabase/migrations/20260909132000_fix_business_rls_recursion.sql
-- ============================================================================
-- Keep membership checks behind SECURITY DEFINER helpers so table policies
-- never evaluate businesses and business_members recursively.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'business_members'
  loop
    execute format('drop policy if exists %I on public.business_members', policy_record.policyname);
  end loop;
end $$;

drop policy if exists "businesses_select_own_business" on public.businesses;
drop policy if exists "businesses_select_own_business" on public.businesses;
create policy "businesses_select_own_business" on public.businesses
for select
using (
  owner_id = auth.uid()
  or public.is_business_member(businesses.id, 'viewer')
  or public.is_platform_super_admin()
);

drop policy if exists "business_members_select_own_business" on public.business_members;

create policy "business_members_select_own_business" on public.business_members
for select
using (
  public.is_business_member(business_members.business_id, 'viewer')
  or public.is_platform_super_admin()
);

drop policy if exists "business_members_insert_own_business" on public.business_members;

create policy "business_members_insert_own_business" on public.business_members
for insert
with check (
  public.is_business_member(business_members.business_id, 'admin')
  or public.is_platform_super_admin()
);

drop policy if exists "business_members_update_own_business" on public.business_members;

create policy "business_members_update_own_business" on public.business_members
for update
using (
  public.is_business_member(business_members.business_id, 'admin')
  or public.is_platform_super_admin()
)
with check (
  public.is_business_member(business_members.business_id, 'admin')
  or public.is_platform_super_admin()
);

drop policy if exists "business_members_delete_own_business" on public.business_members;

create policy "business_members_delete_own_business" on public.business_members
for delete
using (
  public.is_business_member(business_members.business_id, 'admin')
  or public.is_platform_super_admin()
);

-- ============================================================================
-- Source: supabase/migrations/20260909140000_harden_owner_subscription_access.sql
-- ============================================================================
-- Only the business owner or a trusted platform administrator may mutate a subscription.
drop policy if exists "business_subscriptions_update_own_business" on public.business_subscriptions;
drop policy if exists "business_subscriptions_update_owner_only" on public.business_subscriptions;
create policy "business_subscriptions_update_owner_only" on public.business_subscriptions
for update
using (
  public.is_business_owner(business_subscriptions.business_id)
  or public.is_platform_super_admin()
)
with check (
  public.is_business_owner(business_subscriptions.business_id)
  or public.is_platform_super_admin()
);

-- ============================================================================
-- Source: supabase/migrations/20260909142000_restrict_public_support_ticket_reads.sql
-- ============================================================================
-- Public tickets are accessed through their access-code RPCs. Direct table
-- reads are limited to the ticket creator (when authenticated) or platform staff.
drop policy if exists "support_tickets_select_own_business" on public.support_tickets;
drop policy if exists "support_tickets_select_own_business" on public.support_tickets;
create policy "support_tickets_select_own_business" on public.support_tickets
for select
using (
  (business_id is null and user_id = auth.uid())
  or exists (
    select 1
    from public.business_members bm
    where bm.business_id = support_tickets.business_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "support_ticket_messages_select_own_business" on public.support_ticket_messages;
drop policy if exists "support_ticket_messages_select_own_business" on public.support_ticket_messages;
create policy "support_ticket_messages_select_own_business" on public.support_ticket_messages
for select
using (
  exists (
    select 1
    from public.support_tickets t
    where t.id = support_ticket_messages.ticket_id
      and (
        (t.business_id is null and t.user_id = auth.uid())
        or exists (
          select 1
          from public.business_members bm
          where bm.business_id = t.business_id
            and bm.user_id = auth.uid()
        )
      )
  )
  or public.is_platform_super_admin()
);

-- ============================================================================
-- Source: supabase/migrations/20260909144500_lock_subscription_payment_mutations.sql
-- ============================================================================
-- Subscription payment records are immutable from the client.
-- Payment creation and status transitions are handled by trusted server-side
-- flows using service_role, while authenticated users retain read-only access.
drop policy if exists "subscription_payments_update_own_business" on public.subscription_payments;
drop policy if exists "subscription_payments_update_owner_only" on public.subscription_payments;
drop policy if exists "subscription_payments_insert_own_business" on public.subscription_payments;
drop policy if exists "subscription_payments_delete_own_business" on public.subscription_payments;

-- ============================================================================
-- Source: supabase/migrations/20260909144900_require_active_platform_admin.sql
-- ============================================================================
-- Suspended and disabled platform administrators must lose access immediately,
-- including when an existing JWT remains valid in the browser.
create or replace function public.get_platform_admin_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.platform_admins
  where user_id = auth.uid()
    and status = 'active'
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins
    where user_id = auth.uid()
      and status = 'active'
  )
$$;

create or replace function public.is_platform_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins
    where user_id = auth.uid()
      and role = 'super_admin'
      and status = 'active'
  )
$$;

create or replace function public.has_platform_admin_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins
    where user_id = auth.uid()
      and status = 'active'
      and (
        role in ('super_admin', 'admin')
        or (role = 'support' and p_permission in ('overview', 'users', 'businesses', 'subscriptions'))
        or (role = 'finance' and p_permission in ('overview', 'subscriptions', 'subscription_payments'))
        or (role = 'analyst' and p_permission in ('overview', 'users', 'businesses', 'subscriptions', 'subscription_payments'))
      )
  )
$$;

-- ============================================================================
-- Source: supabase/migrations/20260909161000_detailed_stock_movements.sql
-- ============================================================================
alter table public.stock_movements
  add column if not exists previous_stock numeric(12, 2),
  add column if not exists new_stock numeric(12, 2),
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists stock_movements_business_created_at_idx
  on public.stock_movements (business_id, created_at desc);

-- ============================================================================
-- Source: supabase/migrations/20260909162000_product_images.sql
-- ============================================================================
alter table public.products add column if not exists image_url text;

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "product images are publicly readable" on storage.objects;
drop policy if exists "product images are publicly readable" on storage.objects;
create policy "product images are publicly readable" on storage.objects for select using (bucket_id = 'product-images');

drop policy if exists "business members upload product images" on storage.objects;
drop policy if exists "business members upload product images" on storage.objects;
create policy "business members upload product images" on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and public.is_business_member((storage.foldername(name))[1]::uuid, 'member')
  );

drop policy if exists "business members update product images" on storage.objects;
drop policy if exists "business members update product images" on storage.objects;
create policy "business members update product images" on storage.objects for update
  using (
    bucket_id = 'product-images'
    and public.is_business_member((storage.foldername(name))[1]::uuid, 'member')
  )
  with check (
    bucket_id = 'product-images'
    and public.is_business_member((storage.foldername(name))[1]::uuid, 'member')
  );

drop policy if exists "business members delete product images" on storage.objects;
drop policy if exists "business members delete product images" on storage.objects;
create policy "business members delete product images" on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and public.is_business_member((storage.foldername(name))[1]::uuid, 'member')
  );

-- ============================================================================
-- Source: supabase/migrations/20260909171000_atomic_stock_movements.sql
-- ============================================================================
drop function if exists public.apply_stock_movement(uuid, uuid, numeric, text, text);
create or replace function public.apply_stock_movement(
  p_business_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_movement_type text,
  p_note text default null
)
returns table (
  movement_id uuid,
  previous_stock numeric,
  new_stock numeric
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  product_row public.products%rowtype;
  delta numeric;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;

  if p_product_id is null or p_quantity is null or p_quantity < 0
     or (p_movement_type in ('in', 'out') and p_quantity = 0) then
    raise exception 'La quantité doit être positive, sauf pour un ajustement à zéro.';
  end if;

  if p_movement_type not in ('in', 'out', 'adjustment') then
    raise exception 'Type de mouvement invalide.';
  end if;

  select *
  into product_row
  from public.products
  where id = p_product_id
    and business_id = p_business_id
    and product_type = 'product'
  for update;

  if not found then
    raise exception 'Produit non autorisé ou non stockable.';
  end if;

  delta := case
    when p_movement_type = 'in' then p_quantity
    when p_movement_type = 'out' then -p_quantity
    else p_quantity - product_row.stock_quantity
  end;

  if product_row.stock_quantity + delta < 0 then
    raise exception 'Le stock ne peut pas être négatif.';
  end if;

  update public.products
  set stock_quantity = product_row.stock_quantity + delta,
      updated_at = now()
  where id = product_row.id;

  insert into public.stock_movements (
    business_id, product_id, quantity, movement_type, note,
    previous_stock, new_stock, created_by
  )
  values (
    p_business_id, product_row.id, delta, p_movement_type, nullif(trim(p_note), ''),
    product_row.stock_quantity, product_row.stock_quantity + delta, auth.uid()
  )
  returning id, previous_stock, new_stock
  into movement_id, previous_stock, new_stock;

  return next;
end;
$$;

revoke all on function public.apply_stock_movement(uuid, uuid, numeric, text, text) from public, anon;
grant execute on function public.apply_stock_movement(uuid, uuid, numeric, text, text) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260909180000_persistent_stock_alerts.sql
-- ============================================================================
create table if not exists public.business_notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  type text not null,
  alert_key text not null,
  title text not null,
  message text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  product_id uuid references public.products(id) on delete cascade,
  read_at timestamptz,
  archived_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, alert_key)
);

create index if not exists business_notifications_business_idx
  on public.business_notifications (business_id, active, created_at desc);

alter table public.business_notifications enable row level security;

drop policy if exists "business members read notifications" on public.business_notifications;

create policy "business members read notifications" on public.business_notifications for select
using (public.is_business_member(business_id, 'viewer'));

create or replace function public.mark_business_notification_read(
  p_business_id uuid,
  p_notification_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_business_member(p_business_id, 'viewer') then
    raise exception 'Entreprise non autorisée.';
  end if;
  update public.business_notifications
  set read_at = coalesce(read_at, now()), updated_at = now()
  where id = p_notification_id and business_id = p_business_id and active = true;
end;
$$;

revoke all on function public.mark_business_notification_read(uuid, uuid) from public, anon;
grant execute on function public.mark_business_notification_read(uuid, uuid) to authenticated;

create or replace function public.sync_product_stock_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  alert_key text := 'stock:' || new.id::text;
  is_low boolean := new.product_type = 'product' and new.stock_quantity <= new.low_stock_threshold;
begin
  if is_low then
    insert into public.business_notifications (
      business_id, type, alert_key, title, message, severity, product_id,
      read_at, archived_at, active, updated_at
    )
    values (
      new.business_id, 'stock', alert_key,
      case when new.stock_quantity <= 0 then 'Rupture de stock' else 'Stock faible' end,
      case when new.stock_quantity <= 0
        then 'Rupture de stock : ' || new.name || '.'
        else 'Stock faible : ' || new.name || ' (' || new.stock_quantity || ' restant(s)).'
      end,
      case when new.stock_quantity <= 0 then 'critical' else 'warning' end,
      new.id, null, null, true, now()
    )
    on conflict (business_id, alert_key) do update
      set title = excluded.title, message = excluded.message, severity = excluded.severity,
          active = true, archived_at = null, read_at = case
            when business_notifications.active = false then null
            else business_notifications.read_at
          end, updated_at = now();
  else
    update public.business_notifications as n
    set active = false, updated_at = now()
    where n.business_id = new.business_id and n.alert_key = alert_key and n.active = true;
  end if;
  return new;
end;
$$;

drop trigger if exists products_stock_alert_trigger on public.products;
create trigger products_stock_alert_trigger
after insert or update of stock_quantity, low_stock_threshold, product_type, name
on public.products
for each row execute function public.sync_product_stock_alert();

revoke all on function public.sync_product_stock_alert() from public, anon, authenticated;

update public.products
set updated_at = updated_at
where product_type = 'product';

-- ============================================================================
-- Source: supabase/migrations/20260909182000_delete_stock_movement.sql
-- ============================================================================
create or replace function public.delete_stock_movement(
  p_business_id uuid,
  p_movement_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  movement_row public.stock_movements%rowtype;
  product_row public.products%rowtype;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;

  select *
  into movement_row
  from public.stock_movements
  where id = p_movement_id
    and business_id = p_business_id
  for update;

  if not found then
    raise exception 'Mouvement introuvable.';
  end if;

  select *
  into product_row
  from public.products
  where id = movement_row.product_id
    and business_id = p_business_id
  for update;

  if not found then
    raise exception 'Produit associé introuvable.';
  end if;

  if exists (
    select 1
    from public.stock_movements newer
    where newer.product_id = movement_row.product_id
      and newer.business_id = p_business_id
      and (newer.created_at, newer.id) > (movement_row.created_at, movement_row.id)
  ) then
    raise exception 'Seul le dernier mouvement de ce produit peut être supprimé.';
  end if;

  if product_row.stock_quantity - movement_row.quantity < 0 then
    raise exception 'La suppression rendrait le stock négatif.';
  end if;

  update public.products
  set stock_quantity = product_row.stock_quantity - movement_row.quantity,
      updated_at = now()
  where id = product_row.id;

  delete from public.stock_movements
  where id = movement_row.id;
end;
$$;

revoke all on function public.delete_stock_movement(uuid, uuid) from public, anon;
grant execute on function public.delete_stock_movement(uuid, uuid) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260909184000_draft_invoice_stock_policy.sql
-- ============================================================================
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
security invoker
set search_path = public
as $$
declare
  line jsonb;
  product_row record;
  invoice_id uuid;
  invoice_number text;
  subscription_row record;
  invoice_count integer;
  month_start date := date_trunc('month', p_issue_date)::date;
  next_month date := (date_trunc('month', p_issue_date) + interval '1 month')::date;
  subtotal numeric := 0;
  discount_amount numeric;
  tax_amount numeric;
  total_amount numeric;
  quantity numeric;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;

  if not exists (
    select 1 from public.clients
    where id = p_client_id and business_id = p_business_id
  ) then
    raise exception 'Client non autorisé.';
  end if;

  select *
  into subscription_row
  from public.business_subscriptions
  where business_id = p_business_id
  for update;

  if not found then
    raise exception 'Abonnement non configuré pour cette entreprise.';
  end if;
  if subscription_row.status not in ('active', 'trialing') then
    raise exception 'Votre abonnement ne permet pas de créer des factures.';
  end if;
  if subscription_row.expires_at is not null and subscription_row.expires_at < now() then
    raise exception 'Votre abonnement a expiré.';
  end if;

  select count(*)::integer
  into invoice_count
  from public.invoices
  where business_id = p_business_id
    and issue_date >= month_start
    and issue_date < next_month
    and status <> 'CANCELLED';

  if invoice_count >= subscription_row.monthly_invoice_limit then
    raise exception 'La limite mensuelle de % factures est atteinte.', subscription_row.monthly_invoice_limit;
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'La facture doit contenir au moins une ligne.';
  end if;

  for line in select value from jsonb_array_elements(p_lines)
  loop
    quantity := (line->>'quantity')::numeric;
    if quantity <= 0 then
      raise exception 'La quantité doit être positive.';
    end if;

    select id, name, price, product_type, stock_quantity
    into product_row
    from public.products
    where id = (line->>'product_id')::uuid
      and business_id = p_business_id
    for update;

    if not found then
      raise exception 'Produit non autorisé.';
    end if;
    if product_row.product_type = 'product' and product_row.stock_quantity < quantity then
      raise exception 'Stock insuffisant pour %.', product_row.name;
    end if;
    subtotal := subtotal + product_row.price * quantity;
  end loop;

  discount_amount := least(greatest(coalesce(p_discount, 0), 0), subtotal);
  tax_amount := (subtotal - discount_amount) * greatest(coalesce(p_tax_rate, 0), 0) / 100;
  total_amount := subtotal - discount_amount + tax_amount;
  invoice_number := public.next_invoice_number(p_business_id, extract(year from p_issue_date)::integer);

  insert into public.invoices (
    business_id, client_id, invoice_number, issue_date, due_date,
    subtotal, discount, tax, total, status
  ) values (
    p_business_id, p_client_id, invoice_number, p_issue_date, p_due_date,
    subtotal, discount_amount, tax_amount, total_amount, 'DRAFT'
  ) returning id into invoice_id;

  for line in select value from jsonb_array_elements(p_lines)
  loop
    quantity := (line->>'quantity')::numeric;
    select id, name, price
    into product_row
    from public.products
    where id = (line->>'product_id')::uuid
      and business_id = p_business_id;

    insert into public.invoice_items (invoice_id, product_id, description, quantity, unit_price)
    values (invoice_id, product_row.id, product_row.name, quantity, product_row.price);
  end loop;

  return invoice_number;
end;
$$;

revoke all on function public.create_invoice_with_lines(uuid, uuid, date, date, numeric, numeric, jsonb) from public, anon;
grant execute on function public.create_invoice_with_lines(uuid, uuid, date, date, numeric, numeric, jsonb) to authenticated;

create or replace function public.cancel_invoice_with_stock_restore(
  p_business_id uuid,
  p_invoice_number text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  invoice_row public.invoices;
  item record;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;

  select *
  into invoice_row
  from public.invoices
  where business_id = p_business_id
    and invoice_number = p_invoice_number
  for update;

  if not found then
    raise exception 'Facture introuvable.';
  end if;
  if invoice_row.status = 'PAID' then
    raise exception 'Une facture payée ne peut pas être annulée.';
  end if;
  if invoice_row.status = 'CANCELLED' then
    return;
  end if;

  for item in
    select ii.product_id, ii.quantity
    from public.invoice_items ii
    join public.products p on p.id = ii.product_id
    where ii.invoice_id = invoice_row.id
      and p.product_type = 'product'
      and exists (
        select 1
        from public.stock_movements sm
        where sm.business_id = p_business_id
          and sm.product_id = ii.product_id
          and sm.movement_type = 'out'
          and sm.note = format('Vente liée à %s', p_invoice_number)
      )
  loop
    perform public.apply_stock_movement(
      p_business_id,
      item.product_id,
      item.quantity,
      'in',
      format('Restauration après annulation de %s', p_invoice_number)
    );
  end loop;

  update public.invoices
  set status = 'CANCELLED', updated_at = now()
  where id = invoice_row.id;
end;
$$;

revoke all on function public.cancel_invoice_with_stock_restore(uuid, text) from public, anon;
grant execute on function public.cancel_invoice_with_stock_restore(uuid, text) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260909190000_invoice_cancellation_stock_restore.sql
-- ============================================================================
create or replace function public.cancel_invoice_with_stock_restore(
  p_business_id uuid,
  p_invoice_number text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  invoice_row public.invoices;
  item record;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;

  select *
  into invoice_row
  from public.invoices
  where business_id = p_business_id
    and invoice_number = p_invoice_number
  for update;

  if not found then
    raise exception 'Facture introuvable.';
  end if;
  if invoice_row.status = 'PAID' then
    raise exception 'Une facture payée ne peut pas être annulée.';
  end if;
  if invoice_row.status = 'CANCELLED' then
    return;
  end if;

  for item in
    select ii.product_id, ii.quantity
    from public.invoice_items ii
    join public.products p on p.id = ii.product_id
    where ii.invoice_id = invoice_row.id
      and p.product_type = 'product'
  loop
    perform public.apply_stock_movement(
      p_business_id,
      item.product_id,
      item.quantity,
      'in',
      format('Restauration après annulation de %s', p_invoice_number)
    );
  end loop;

  update public.invoices
  set status = 'CANCELLED', updated_at = now()
  where id = invoice_row.id;
end;
$$;

revoke all on function public.cancel_invoice_with_stock_restore(uuid, text) from public, anon;
grant execute on function public.cancel_invoice_with_stock_restore(uuid, text) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260909190500_expense_module_enrichment.sql
-- ============================================================================
create index if not exists expenses_business_date_idx
  on public.expenses (business_id, expense_date desc, created_at desc);

create index if not exists expenses_business_category_idx
  on public.expenses (business_id, category);

-- ============================================================================
-- Source: supabase/migrations/20260909195600_fix_stock_alert_trigger.sql
-- ============================================================================
create or replace function public.sync_product_stock_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alert_key text := 'stock:' || new.id::text;
  is_low boolean := new.product_type = 'product' and new.stock_quantity <= new.low_stock_threshold;
begin
  if is_low then
    insert into public.business_notifications (
      business_id, type, alert_key, title, message, severity, product_id,
      read_at, archived_at, active, updated_at
    )
    values (
      new.business_id, 'stock', v_alert_key,
      case when new.stock_quantity <= 0 then 'Rupture de stock' else 'Stock faible' end,
      case when new.stock_quantity <= 0
        then 'Rupture de stock : ' || new.name || '.'
        else 'Stock faible : ' || new.name || ' (' || new.stock_quantity || ' restant(s)).'
      end,
      case when new.stock_quantity <= 0 then 'critical' else 'warning' end,
      new.id, null, null, true, now()
    )
    on conflict (business_id, alert_key) do update
      set title = excluded.title, message = excluded.message, severity = excluded.severity,
          active = true, archived_at = null, read_at = case
            when business_notifications.active = false then null
            else business_notifications.read_at
          end, updated_at = now();
  else
    update public.business_notifications as n
    set active = false, updated_at = now()
    where n.business_id = new.business_id
      and n.alert_key = v_alert_key
      and n.active = true;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_product_stock_alert() from public, anon, authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260909195700_fix_atomic_stock_return.sql
-- ============================================================================
create or replace function public.apply_stock_movement(
  p_business_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_movement_type text,
  p_note text default null
)
returns table (
  movement_id uuid,
  previous_stock numeric,
  new_stock numeric
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  product_row public.products%rowtype;
  delta numeric;
  v_movement_id uuid;
  v_previous_stock numeric;
  v_new_stock numeric;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;

  if p_product_id is null or p_quantity is null or p_quantity < 0
     or (p_movement_type in ('in', 'out') and p_quantity = 0) then
    raise exception 'La quantité doit être positive, sauf pour un ajustement à zéro.';
  end if;

  if p_movement_type not in ('in', 'out', 'adjustment') then
    raise exception 'Type de mouvement invalide.';
  end if;

  select *
  into product_row
  from public.products
  where id = p_product_id
    and business_id = p_business_id
    and product_type = 'product'
  for update;

  if not found then
    raise exception 'Produit non autorisé ou non stockable.';
  end if;

  delta := case
    when p_movement_type = 'in' then p_quantity
    when p_movement_type = 'out' then -p_quantity
    else p_quantity - product_row.stock_quantity
  end;

  if product_row.stock_quantity + delta < 0 then
    raise exception 'Le stock ne peut pas être négatif.';
  end if;

  update public.products
  set stock_quantity = product_row.stock_quantity + delta,
      updated_at = now()
  where id = product_row.id;

  insert into public.stock_movements (
    business_id, product_id, quantity, movement_type, note,
    previous_stock, new_stock, created_by
  )
  values (
    p_business_id, product_row.id, delta, p_movement_type, nullif(trim(p_note), ''),
    product_row.stock_quantity, product_row.stock_quantity + delta, auth.uid()
  )
  returning stock_movements.id, stock_movements.previous_stock, stock_movements.new_stock
  into v_movement_id, v_previous_stock, v_new_stock;

  movement_id := v_movement_id;
  previous_stock := v_previous_stock;
  new_stock := v_new_stock;
  return next;
end;
$$;

revoke all on function public.apply_stock_movement(uuid, uuid, numeric, text, text) from public, anon;
grant execute on function public.apply_stock_movement(uuid, uuid, numeric, text, text) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260909201500_owner_advanced_invoice_types.sql
-- ============================================================================
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
  created_invoice_number text;
begin
  if p_invoice_type not in ('STANDARD', 'PROFORMA', 'DEPOSIT', 'CREDIT_NOTE', 'FINAL') then
    raise exception 'Type de facture invalide.';
  end if;

  if p_invoice_type <> 'STANDARD' and not public.is_business_owner(p_business_id) then
    select plan into subscription_plan
    from public.business_subscriptions
    where business_id = p_business_id
      and status in ('active', 'trialing')
      and (expires_at is null or expires_at > now());
    if subscription_plan not in ('starter', 'pro', 'business') then
      raise exception 'Les types de facture avancés nécessitent un abonnement actif.';
    end if;
  end if;

  created_invoice_number := public.create_invoice_with_lines(
    p_business_id, p_client_id, p_issue_date, p_due_date,
    p_discount, p_tax_rate, p_lines
  );
  update public.invoices as target_invoice
  set invoice_type = p_invoice_type, updated_at = now()
  where target_invoice.business_id = p_business_id
    and target_invoice.invoice_number = created_invoice_number;
  return created_invoice_number;
end;
$$;

-- ============================================================================
-- Source: supabase/migrations/20260909202500_restore_invoice_type_subscription_guard.sql
-- ============================================================================
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
  created_invoice_number text;
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
      raise exception 'Les types de facture avancés nécessitent un abonnement actif.';
    end if;
  end if;

  created_invoice_number := public.create_invoice_with_lines(
    p_business_id, p_client_id, p_issue_date, p_due_date,
    p_discount, p_tax_rate, p_lines
  );
  update public.invoices as target_invoice
  set invoice_type = p_invoice_type, updated_at = now()
  where target_invoice.business_id = p_business_id
    and target_invoice.invoice_number = created_invoice_number;
  return created_invoice_number;
end;
$$;

-- ============================================================================
-- Source: supabase/migrations/20260909210000_recurring_invoice_team_access.sql
-- ============================================================================
drop policy if exists "business owners manage recurring invoices" on public.recurring_invoices;

drop policy if exists "team members read recurring invoices" on public.recurring_invoices;

create policy "team members read recurring invoices" on public.recurring_invoices
  for select
  using (public.is_business_member(business_id, 'viewer'));

drop policy if exists "team members manage recurring invoices" on public.recurring_invoices;

create policy "team members manage recurring invoices" on public.recurring_invoices
  for all
  using (public.is_business_member(business_id, 'member'))
  with check (public.is_business_member(business_id, 'member'));

-- ============================================================================
-- Source: supabase/migrations/20260909211000_allow_business_recurring_invoices.sql
-- ============================================================================
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

  if not found
    or subscription_row.plan not in ('starter', 'pro', 'business')
    or subscription_row.status not in ('active', 'trialing')
    or (subscription_row.expires_at is not null and subscription_row.expires_at < now()) then
    raise exception 'Les factures récurrentes nécessitent un abonnement Starter, Pro ou Business actif.';
  end if;

  insert into public.recurring_invoices (
    business_id,
    client_id,
    product_id,
    frequency,
    next_issue_date,
    due_days
  )
  values (
    p_business_id,
    p_client_id,
    p_product_id,
    p_frequency,
    p_next_issue_date,
    p_due_days
  )
  returning * into created_recurring;

  return created_recurring;
end;
$$;

revoke all on function public.create_recurring_invoice(uuid, uuid, uuid, text, date, integer) from public, anon;
grant execute on function public.create_recurring_invoice(uuid, uuid, uuid, text, date, integer) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260909212000_restrict_recurring_invoices_to_demo_owner.sql
-- ============================================================================
drop policy if exists "team members read recurring invoices" on public.recurring_invoices;
drop policy if exists "team members manage recurring invoices" on public.recurring_invoices;
drop policy if exists "recurring_invoices_select_own_business" on public.recurring_invoices;
drop policy if exists "recurring_invoices_update_own_business" on public.recurring_invoices;

drop policy if exists "demo owner reads recurring invoices" on public.recurring_invoices;

create policy "demo owner reads recurring invoices" on public.recurring_invoices
  for select
  using (
    public.is_business_member(business_id, 'viewer')
    and lower(coalesce((select email from auth.users where id = auth.uid()), '')) = 'azoganlandry3@gmail.com'
  );

drop policy if exists "demo owner manages recurring invoices" on public.recurring_invoices;

create policy "demo owner manages recurring invoices" on public.recurring_invoices
  for all
  using (
    public.is_business_member(business_id, 'member')
    and lower(coalesce((select email from auth.users where id = auth.uid()), '')) = 'azoganlandry3@gmail.com'
  )
  with check (
    public.is_business_member(business_id, 'member')
    and lower(coalesce((select email from auth.users where id = auth.uid()), '')) = 'azoganlandry3@gmail.com'
  );

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
  created_recurring public.recurring_invoices;
begin
  if not public.is_business_member(p_business_id, 'member')
    or lower(coalesce((select email from auth.users where id = auth.uid()), '')) <> 'azoganlandry3@gmail.com' then
    raise exception 'Les factures récurrentes sont disponibles uniquement pour le compte de démonstration Dossou.';
  end if;

  insert into public.recurring_invoices (
    business_id, client_id, product_id, frequency, next_issue_date, due_days
  )
  values (
    p_business_id, p_client_id, p_product_id, p_frequency, p_next_issue_date, p_due_days
  )
  returning * into created_recurring;

  return created_recurring;
end;
$$;

revoke all on function public.create_recurring_invoice(uuid, uuid, uuid, text, date, integer) from public, anon;
grant execute on function public.create_recurring_invoice(uuid, uuid, uuid, text, date, integer) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260909213000_fix_demo_recurring_auth_check.sql
-- ============================================================================
drop policy if exists "demo owner reads recurring invoices" on public.recurring_invoices;
drop policy if exists "demo owner manages recurring invoices" on public.recurring_invoices;

drop policy if exists "demo owner reads recurring invoices" on public.recurring_invoices;

create policy "demo owner reads recurring invoices" on public.recurring_invoices
  for select
  using (
    public.is_business_member(business_id, 'viewer')
    and lower(coalesce(auth.jwt()->>'email', '')) = 'azoganlandry3@gmail.com'
  );

drop policy if exists "demo owner manages recurring invoices" on public.recurring_invoices;

create policy "demo owner manages recurring invoices" on public.recurring_invoices
  for all
  using (
    public.is_business_member(business_id, 'member')
    and lower(coalesce(auth.jwt()->>'email', '')) = 'azoganlandry3@gmail.com'
  )
  with check (
    public.is_business_member(business_id, 'member')
    and lower(coalesce(auth.jwt()->>'email', '')) = 'azoganlandry3@gmail.com'
  );

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
  created_recurring public.recurring_invoices;
begin
  if not public.is_business_member(p_business_id, 'member')
    or lower(coalesce(auth.jwt()->>'email', '')) <> 'azoganlandry3@gmail.com' then
    raise exception 'Les factures récurrentes sont disponibles uniquement pour le compte de démonstration Dossou.';
  end if;

  insert into public.recurring_invoices (
    business_id, client_id, product_id, frequency, next_issue_date, due_days
  )
  values (
    p_business_id, p_client_id, p_product_id, p_frequency, p_next_issue_date, p_due_days
  )
  returning * into created_recurring;

  return created_recurring;
end;
$$;

revoke all on function public.create_recurring_invoice(uuid, uuid, uuid, text, date, integer) from public, anon;
grant execute on function public.create_recurring_invoice(uuid, uuid, uuid, text, date, integer) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260909220000_team_management_complete.sql
-- ============================================================================
create or replace function public.list_business_team(p_business_id uuid)
returns table (
  id uuid,
  user_id uuid,
  email text,
  full_name text,
  role text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    m.id,
    m.user_id,
    u.email::text,
    nullif(u.raw_user_meta_data->>'full_name', ''),
    m.role,
    m.created_at
  from public.business_members m
  join auth.users u on u.id = m.user_id
  where m.business_id = p_business_id
    and public.is_business_member(p_business_id, 'viewer')
  order by m.created_at;
$$;

revoke all on function public.list_business_team(uuid) from public, anon;
grant execute on function public.list_business_team(uuid) to authenticated;

create or replace function public.update_business_member_role(p_member_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.business_members;
begin
  if p_role not in ('admin', 'member', 'viewer') then
    raise exception 'Rôle d’équipe invalide.';
  end if;

  select * into target
  from public.business_members
  where id = p_member_id
  for update;

  if not found
     or not public.is_business_admin(target.business_id)
     or target.user_id = auth.uid() then
    raise exception 'Vous ne pouvez pas modifier ce membre.';
  end if;

  update public.business_members
  set role = p_role
  where id = p_member_id;
end;
$$;

revoke all on function public.update_business_member_role(uuid, text) from public, anon;
grant execute on function public.update_business_member_role(uuid, text) to authenticated;

create or replace function public.cancel_business_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.business_invitations;
begin
  select * into target
  from public.business_invitations
  where id = p_invitation_id
  for update;

  if not found or not public.is_business_admin(target.business_id) then
    raise exception 'Vous ne pouvez pas annuler cette invitation.';
  end if;

  delete from public.business_invitations where id = p_invitation_id;
end;
$$;

revoke all on function public.cancel_business_invitation(uuid) from public, anon;
grant execute on function public.cancel_business_invitation(uuid) to authenticated;

create or replace function public.remove_business_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.business_members;
begin
  select * into target
  from public.business_members
  where id = p_member_id
  for update;

  if not found
     or not public.is_business_admin(target.business_id)
     or target.user_id = auth.uid() then
    raise exception 'Vous ne pouvez pas retirer ce membre.';
  end if;

  delete from public.business_members where id = p_member_id;
end;
$$;

revoke all on function public.remove_business_member(uuid) from public, anon;
grant execute on function public.remove_business_member(uuid) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260909223000_team_invitation_validation.sql
-- ============================================================================
alter table public.business_invitations
  add column if not exists validated_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists full_name text,
  add column if not exists invited_user_id uuid references auth.users(id) on delete cascade;

create or replace function public.validate_business_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.business_invitations;
begin
  select * into target
  from public.business_invitations
  where id = p_invitation_id
  for update;

  if not found or not public.is_business_admin(target.business_id) then
    raise exception 'Vous ne pouvez pas valider cette invitation.';
  end if;
  if target.accepted_at is not null then
    raise exception 'Cette invitation est déjà activée.';
  end if;
  if target.expires_at <= now() then
    raise exception 'Cette invitation est expirée.';
  end if;
  if target.invited_user_id is null then
    raise exception 'Compte invité introuvable.';
  end if;

  update public.business_invitations
  set validated_at = coalesce(validated_at, now()), sent_at = coalesce(sent_at, now())
  where id = p_invitation_id;
  insert into public.business_members (business_id, user_id, role)
  values (target.business_id, target.invited_user_id, target.role)
  on conflict (business_id, user_id) do update set role = excluded.role;
end;
$$;

revoke all on function public.validate_business_invitation(uuid) from public, anon;
grant execute on function public.validate_business_invitation(uuid) to authenticated;

create or replace function public.accept_business_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.business_invitations;
  member_id uuid;
begin
  select * into invitation
  from public.business_invitations
  where token = p_token
    and validated_at is not null
    and accepted_at is null
    and expires_at > now()
    and lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
  for update;
  if not found then
    raise exception 'Invitation non validée, expirée ou non liée à votre email.';
  end if;

  insert into public.business_members (business_id, user_id, role)
  values (invitation.business_id, auth.uid(), invitation.role)
  on conflict (business_id, user_id) do update set role = excluded.role
  returning id into member_id;

  update public.business_invitations set accepted_at = now() where id = invitation.id;
  return member_id;
end;
$$;

revoke all on function public.accept_business_invitation(text) from public, anon;
grant execute on function public.accept_business_invitation(text) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260909224000_team_account_activation.sql
-- ============================================================================
alter table public.business_invitations
  add column if not exists full_name text,
  add column if not exists invited_user_id uuid references auth.users(id) on delete cascade;

create or replace function public.validate_business_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare target public.business_invitations;
begin
  select * into target from public.business_invitations where id = p_invitation_id for update;
  if not found or not public.is_business_admin(target.business_id) then raise exception 'Vous ne pouvez pas valider cette invitation.'; end if;
  if target.accepted_at is not null then raise exception 'Cette invitation est déjà activée.'; end if;
  if target.expires_at <= now() then raise exception 'Cette invitation est expirée.'; end if;
  if target.invited_user_id is null then raise exception 'Compte invité introuvable.'; end if;
  update public.business_invitations set validated_at = coalesce(validated_at, now()), sent_at = coalesce(sent_at, now()) where id = p_invitation_id;
  insert into public.business_members (business_id, user_id, role) values (target.business_id, target.invited_user_id, target.role)
    on conflict (business_id, user_id) do update set role = excluded.role;
end;
$$;

revoke all on function public.validate_business_invitation(uuid) from public, anon;
grant execute on function public.validate_business_invitation(uuid) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260909230000_demo_team_member_limit_override.sql
-- ============================================================================
create or replace function public.enforce_subscription_member_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_members integer;
  member_limit integer;
  is_demo_owner boolean;
begin
  select exists (
    select 1
    from public.businesses b
    join auth.users u on u.id = b.owner_id
    where b.id = new.business_id
      and lower(u.email) = 'azoganlandry3@gmail.com'
  ) into is_demo_owner;

  if is_demo_owner then
    return new;
  end if;

  select count(*)::integer into current_members
  from public.business_members
  where business_id = new.business_id;

  select case plan
    when 'free' then 1
    when 'starter' then 1
    when 'pro' then 5
    when 'business' then 25
    else 1
  end into member_limit
  from public.business_subscriptions
  where business_id = new.business_id
    and status in ('active', 'trialing')
    and (expires_at is null or expires_at > now());

  if coalesce(member_limit, 1) <= current_members
     and not exists (
       select 1 from public.business_members
       where business_id = new.business_id and user_id = new.user_id
     ) then
    raise exception 'La limite de % utilisateur(s) de votre abonnement est atteinte.', member_limit;
  end if;
  return new;
end;
$$;

-- ============================================================================
-- Source: supabase/migrations/20260909231000_audit_log_deletion.sql
-- ============================================================================
drop policy if exists "audit_logs_delete_own_business" on public.audit_logs;
drop policy if exists "audit_logs_delete_own_business" on public.audit_logs;
create policy "audit_logs_delete_own_business" on public.audit_logs
for delete
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = audit_logs.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

-- ============================================================================
-- Source: supabase/migrations/20260909232000_fix_direct_team_activation_status.sql
-- ============================================================================
create or replace function public.validate_business_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.business_invitations;
begin
  select * into target
  from public.business_invitations
  where id = p_invitation_id
  for update;

  if not found or not public.is_business_admin(target.business_id) then
    raise exception 'Vous ne pouvez pas valider cette invitation.';
  end if;
  if target.accepted_at is not null then
    raise exception 'Cette invitation est déjà activée.';
  end if;
  if target.expires_at <= now() then
    raise exception 'Cette invitation est expirée.';
  end if;
  if target.invited_user_id is null then
    raise exception 'Compte invité introuvable.';
  end if;

  update public.business_invitations
  set validated_at = coalesce(validated_at, now()),
      sent_at = coalesce(sent_at, now()),
      accepted_at = now()
  where id = p_invitation_id;

  insert into public.business_members (business_id, user_id, role)
  values (target.business_id, target.invited_user_id, target.role)
  on conflict (business_id, user_id) do update set role = excluded.role;
end;
$$;

revoke all on function public.validate_business_invitation(uuid) from public, anon;
grant execute on function public.validate_business_invitation(uuid) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260909_subscription_payments.sql
-- ============================================================================
create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  plan text not null check (plan in ('starter', 'pro')),
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'XOF',
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'cancelled')),
  provider text not null default 'paydunya',
  provider_token text unique,
  provider_url text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.subscription_payments enable row level security;

drop policy if exists "business members read subscription payments" on public.subscription_payments;
drop policy if exists "business members read subscription payments" on public.subscription_payments;
create policy "business members read subscription payments" on public.subscription_payments
  for select using (public.is_business_member(business_id, 'viewer'));

drop trigger if exists audit_subscription_payments on public.subscription_payments;
create trigger audit_subscription_payments
after insert or update or delete on public.subscription_payments
for each row execute function public.write_audit_log();

create index if not exists subscription_payments_business_created_idx
  on public.subscription_payments (business_id, created_at desc);

delete from public.subscription_payments older
where older.status = 'pending'
  and exists (
    select 1
    from public.subscription_payments newer
    where newer.business_id = older.business_id
      and newer.plan = older.plan
      and newer.status = 'pending'
      and newer.created_at > older.created_at
  );

create unique index if not exists subscription_payments_pending_plan_idx
  on public.subscription_payments (business_id, plan)
  where status = 'pending';

create or replace function public.complete_subscription_payment(p_payment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row record;
  plan_limit integer;
begin
  select *
  into payment_row
  from public.subscription_payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Paiement introuvable.';
  end if;
  if payment_row.status = 'completed' then
    return false;
  end if;

  plan_limit := case payment_row.plan when 'starter' then 100 when 'pro' then 500 else 0 end;
  if plan_limit = 0 then
    raise exception 'Plan de paiement invalide.';
  end if;

  update public.business_subscriptions
  set plan = payment_row.plan,
      status = 'active',
      monthly_invoice_limit = plan_limit,
      expires_at = greatest(coalesce(expires_at, now()), now()) + interval '31 days',
      updated_at = now()
  where business_id = payment_row.business_id;

  if not found then
    raise exception 'Abonnement introuvable.';
  end if;

  update public.subscription_payments
  set status = 'completed', completed_at = now()
  where id = payment_row.id;
  return true;
end;
$$;

revoke all on function public.complete_subscription_payment(uuid) from public, anon, authenticated;
grant execute on function public.complete_subscription_payment(uuid) to service_role;

create or replace function public.update_business_subscription(
  p_business_id uuid,
  p_plan text,
  p_status text default 'active',
  p_expires_at timestamptz default null
)
returns public.business_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_subscription public.business_subscriptions;
begin
  if not public.is_business_owner(p_business_id) then
    raise exception 'Seul le propriétaire peut modifier l’abonnement.';
  end if;
  if p_plan <> 'free' then
    raise exception 'Les plans payants doivent être activés après un paiement PayDunya.';
  end if;
  if p_status not in ('active', 'cancelled') then
    raise exception 'Statut manuel invalide.';
  end if;

  update public.business_subscriptions
  set plan = 'free',
      status = p_status,
      monthly_invoice_limit = 20,
      expires_at = p_expires_at,
      updated_at = now()
  where business_id = p_business_id
  returning * into updated_subscription;

  if not found then
    raise exception 'Abonnement introuvable.';
  end if;
  return updated_subscription;
end;
$$;

revoke all on function public.update_business_subscription(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.update_business_subscription(uuid, text, text, timestamptz) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20260910_invoice_reminders.sql
-- ============================================================================
create table if not exists public.invoice_reminders (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  reminder_date date not null default current_date,
  reminder_type text not null default 'overdue',
  created_at timestamptz not null default now()
);

alter table public.invoice_reminders
  add column if not exists invoice_id uuid,
  add column if not exists reminder_date date default current_date,
  add column if not exists reminder_type text default 'overdue',
  add column if not exists created_at timestamptz default now();

create unique index if not exists invoice_reminders_invoice_date_type_idx
  on public.invoice_reminders (invoice_id, reminder_date, reminder_type);

alter table public.invoice_reminders enable row level security;

drop policy if exists "owners and members can read invoice reminders" on public.invoice_reminders;
drop policy if exists "owners and members can read invoice reminders" on public.invoice_reminders;
create policy "owners and members can read invoice reminders" on public.invoice_reminders for select
  using (exists (
    select 1 from public.invoices i
    left join public.business_members m
      on m.business_id = i.business_id
     and m.user_id = auth.uid()
    left join public.businesses b
      on b.id = i.business_id
    where i.id = invoice_id
      and (m.user_id is not null or b.owner_id = auth.uid())
  ));

-- ============================================================================
-- Source: supabase/migrations/20261016160000_advance_skipped_recurring_invoices.sql
-- ============================================================================
create or replace function public.process_due_recurring_invoices()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  recurring record;
  subscription_row record;
  invoice_id uuid;
  invoice_number text;
  processed integer := 0;
  invoice_count integer;
  next_date date;
begin
  perform pg_advisory_xact_lock(hashtext('facturefacile:recurring-invoices'));

  for recurring in
    select r.*, p.name as product_name, p.price as product_price, p.product_type, p.stock_quantity
    from public.recurring_invoices r
    join public.products p on p.id = r.product_id and p.business_id = r.business_id
    where r.active = true and r.next_issue_date <= current_date
    order by r.next_issue_date, r.created_at
  loop
    next_date := case recurring.frequency
      when 'weekly' then recurring.next_issue_date + 7
      when 'monthly' then (recurring.next_issue_date + interval '1 month')::date
      when 'quarterly' then (recurring.next_issue_date + interval '3 months')::date
      when 'yearly' then (recurring.next_issue_date + interval '1 year')::date
    end;

    select *
    into subscription_row
    from public.business_subscriptions
    where business_id = recurring.business_id
    for update;

    if not found
      or subscription_row.status not in ('active', 'trialing')
      or (subscription_row.expires_at is not null and subscription_row.expires_at < now()) then
      insert into public.recurring_invoice_runs (
        recurring_invoice_id, business_id, issue_date, status, message
      ) values (
        recurring.id, recurring.business_id, recurring.next_issue_date,
        'skipped_subscription', 'Abonnement inactif, expiré ou non configuré.'
      );
      update public.recurring_invoices
      set next_issue_date = next_date
      where id = recurring.id;
      continue;
    end if;

    select count(*)::integer
    into invoice_count
    from public.invoices
    where business_id = recurring.business_id
      and issue_date >= date_trunc('month', recurring.next_issue_date)::date
      and issue_date < (date_trunc('month', recurring.next_issue_date) + interval '1 month')::date
      and status <> 'CANCELLED';

    if invoice_count >= subscription_row.monthly_invoice_limit then
      insert into public.recurring_invoice_runs (
        recurring_invoice_id, business_id, issue_date, status, message
      ) values (
        recurring.id, recurring.business_id, recurring.next_issue_date,
        'skipped_subscription', format('Limite mensuelle de %s factures atteinte.', subscription_row.monthly_invoice_limit)
      );
      update public.recurring_invoices
      set next_issue_date = next_date
      where id = recurring.id;
      continue;
    end if;

    if recurring.product_type = 'product' and recurring.stock_quantity < 1 then
      insert into public.recurring_invoice_runs (
        recurring_invoice_id, business_id, issue_date, status, message
      ) values (
        recurring.id, recurring.business_id, recurring.next_issue_date,
        'skipped_stock', 'Stock insuffisant pour générer la facture.'
      );
      update public.recurring_invoices
      set next_issue_date = next_date
      where id = recurring.id;
      continue;
    end if;

    invoice_number := public.next_invoice_number(recurring.business_id, extract(year from recurring.next_issue_date)::integer);
    insert into public.invoices (
      business_id, client_id, invoice_number, issue_date, due_date,
      status, subtotal, total
    ) values (
      recurring.business_id, recurring.client_id, invoice_number, recurring.next_issue_date,
      recurring.next_issue_date + recurring.due_days, 'SENT',
      recurring.product_price, recurring.product_price
    ) returning id into invoice_id;

    insert into public.invoice_items (
      invoice_id, product_id, description, quantity, unit_price
    ) values (
      invoice_id, recurring.product_id, recurring.product_name, 1, recurring.product_price
    );

    if recurring.product_type = 'product' then
      update public.products
      set stock_quantity = stock_quantity - 1, updated_at = now()
      where id = recurring.product_id and business_id = recurring.business_id and stock_quantity >= 1;

      if not found then
        raise exception 'Stock insuffisant pour la récurrence %', recurring.id;
      end if;

      insert into public.stock_movements (
        business_id, product_id, quantity, movement_type, note
      ) values (
        recurring.business_id, recurring.product_id, -1,
        'out', format('Vente récurrente liée à %s', invoice_number)
      );
    end if;

    update public.recurring_invoices
    set next_issue_date = next_date, last_issued_date = recurring.next_issue_date
    where id = recurring.id;

    insert into public.recurring_invoice_runs (
      recurring_invoice_id, business_id, issue_date, status, invoice_id, message
    ) values (
      recurring.id, recurring.business_id, recurring.next_issue_date,
      'issued', invoice_id, 'Facture générée automatiquement.'
    );

    processed := processed + 1;
  end loop;

  return processed;
end;
$$;

revoke all on function public.process_due_recurring_invoices() from public, anon, authenticated;
grant execute on function public.process_due_recurring_invoices() to service_role;

-- ============================================================================
-- Source: supabase/migrations/20261016161000_recurring_run_notifications.sql
-- ============================================================================
create or replace function public.notify_recurring_invoice_run()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.business_notifications (
    business_id, type, alert_key, title, message, severity
  )
  values (
    new.business_id,
    'recurring_invoice',
    'recurring-run:' || new.id::text,
    case new.status
      when 'issued' then 'Facture récurrente générée'
      when 'skipped_stock' then 'Facture récurrente ignorée : stock insuffisant'
      else 'Facture récurrente ignorée : abonnement ou limite'
    end,
    format(
      'Échéance du %s. %s',
      to_char(new.issue_date, 'DD/MM/YYYY'),
      coalesce(new.message, 'Aucun détail fourni.')
    ),
    case when new.status = 'issued' then 'info' else 'warning' end
  )
  on conflict (business_id, alert_key) do update
    set title = excluded.title,
        message = excluded.message,
        severity = excluded.severity,
        active = true,
        archived_at = null,
        read_at = null,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists recurring_invoice_run_notification on public.recurring_invoice_runs;
create trigger recurring_invoice_run_notification
after insert on public.recurring_invoice_runs
for each row execute function public.notify_recurring_invoice_run();

revoke all on function public.notify_recurring_invoice_run() from public, anon, authenticated;

-- ============================================================================
-- Source: supabase/migrations/20261017120000_switch_subscription_payments_to_kkiapay.sql
-- ============================================================================
alter table public.subscription_payments
  alter column provider set default 'kkiapay';

update public.subscription_payments
set status = 'cancelled'
where provider = 'paydunya'
  and status = 'pending';

update public.platform_settings
set value = 'KKiaPay',
    updated_at = now()
where key = 'payment_provider';

update public.platform_integrations
set name = 'KKiaPay',
    status = 'attention'
where name = 'PayDunya'
  and not exists (
    select 1
    from public.platform_integrations
    where name = 'KKiaPay'
  );

drop function if exists public.complete_subscription_payment(uuid);
drop function if exists public.process_subscription_payment_webhook(text, text, text, jsonb);

create or replace function public.complete_kkiapay_subscription_payment(
  p_payment_id uuid,
  p_transaction_id text,
  p_confirmed_amount numeric,
  p_confirmation_data jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row public.subscription_payments%rowtype;
  plan_limit integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Cette confirmation est réservée au serveur de paiement.';
  end if;
  if nullif(trim(p_transaction_id), '') is null then
    raise exception 'La référence KKiaPay est obligatoire.';
  end if;

  select *
  into payment_row
  from public.subscription_payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Paiement introuvable.';
  end if;
  if payment_row.provider <> 'kkiapay' then
    raise exception 'Le paiement ne provient pas de KKiaPay.';
  end if;
  if payment_row.status = 'completed' then
    if payment_row.provider_token = p_transaction_id then
      return false;
    end if;
    raise exception 'Ce paiement a déjà été confirmé avec une autre transaction.';
  end if;
  if payment_row.status <> 'pending' then
    raise exception 'Ce paiement n’est plus en attente.';
  end if;
  if payment_row.provider_token is not null and payment_row.provider_token <> p_transaction_id then
    raise exception 'Une autre transaction est déjà associée à ce paiement.';
  end if;
  if p_confirmed_amount is distinct from payment_row.amount then
    raise exception 'Le montant confirmé ne correspond pas au paiement.';
  end if;

  plan_limit := case payment_row.plan when 'starter' then 100 when 'pro' then 500 else 0 end;
  if plan_limit = 0 then
    raise exception 'Plan de paiement invalide.';
  end if;

  update public.business_subscriptions
  set plan = payment_row.plan,
      status = 'active',
      monthly_invoice_limit = plan_limit,
      expires_at = greatest(coalesce(expires_at, now()), now()) + interval '31 days',
      updated_at = now()
  where business_id = payment_row.business_id;

  if not found then
    raise exception 'Abonnement introuvable.';
  end if;

  update public.subscription_payments
  set status = 'completed',
      provider_token = p_transaction_id,
      webhook_event_id = p_transaction_id,
      provider_confirmed_at = now(),
      confirmation_data = coalesce(p_confirmation_data, '{}'::jsonb),
      completed_at = now()
  where id = payment_row.id;

  return true;
end;
$$;

revoke all on function public.complete_kkiapay_subscription_payment(uuid, text, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.complete_kkiapay_subscription_payment(uuid, text, numeric, jsonb) to service_role;

create or replace function public.update_business_subscription(
  p_business_id uuid,
  p_plan text,
  p_status text default 'active',
  p_expires_at timestamptz default null
)
returns public.business_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_subscription public.business_subscriptions;
begin
  if not public.is_business_owner(p_business_id) then
    raise exception 'Seul le propriétaire peut modifier l’abonnement.';
  end if;
  if p_plan <> 'free' then
    raise exception 'Les plans payants doivent être activés après un paiement KKiaPay.';
  end if;
  if p_status not in ('active', 'cancelled') then
    raise exception 'Statut manuel invalide.';
  end if;

  update public.business_subscriptions
  set plan = 'free',
      status = p_status,
      monthly_invoice_limit = 20,
      expires_at = p_expires_at,
      updated_at = now()
  where business_id = p_business_id
  returning * into updated_subscription;

  if not found then
    raise exception 'Abonnement introuvable.';
  end if;
  return updated_subscription;
end;
$$;

revoke all on function public.update_business_subscription(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.update_business_subscription(uuid, text, text, timestamptz) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20261017130000_enforce_paid_feature_expiry.sql
-- ============================================================================
create or replace function public.has_active_business_subscription(
  p_business_id uuid,
  p_allowed_plans text[]
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_business_member(p_business_id, 'viewer')
    and exists (
      select 1
      from public.business_subscriptions
      where business_id = p_business_id
        and plan = any(p_allowed_plans)
        and status in ('active', 'trialing')
        and (expires_at is null or expires_at > now())
    );
$$;

revoke all on function public.has_active_business_subscription(uuid, text[]) from public, anon;
grant execute on function public.has_active_business_subscription(uuid, text[]) to authenticated;

create or replace function public.apply_stock_movement(
  p_business_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_movement_type text,
  p_note text default null
)
returns table (
  movement_id uuid,
  previous_stock numeric,
  new_stock numeric
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  product_row public.products%rowtype;
  delta numeric;
  v_movement_id uuid;
  v_previous_stock numeric;
  v_new_stock numeric;
begin
  if not public.is_business_member(p_business_id, 'member')
    or lower(coalesce(auth.jwt()->>'email', '')) <> 'azoganlandry3@gmail.com' then
    raise exception 'Les factures récurrentes sont disponibles uniquement pour le compte de démonstration Dossou.';
  end if;
  if not public.has_active_business_subscription(p_business_id, array['starter', 'pro', 'business']) then
    raise exception 'La gestion du stock nécessite un abonnement payant actif.';
  end if;

  if p_product_id is null or p_quantity is null or p_quantity < 0
     or (p_movement_type in ('in', 'out') and p_quantity = 0) then
    raise exception 'La quantité doit être positive, sauf pour un ajustement à zéro.';
  end if;
  if p_movement_type not in ('in', 'out', 'adjustment') then
    raise exception 'Type de mouvement invalide.';
  end if;

  select *
  into product_row
  from public.products
  where id = p_product_id
    and business_id = p_business_id
    and product_type = 'product'
  for update;

  if not found then
    raise exception 'Produit non autorisé ou non stockable.';
  end if;

  delta := case
    when p_movement_type = 'in' then p_quantity
    when p_movement_type = 'out' then -p_quantity
    else p_quantity - product_row.stock_quantity
  end;

  if product_row.stock_quantity + delta < 0 then
    raise exception 'Le stock ne peut pas être négatif.';
  end if;

  update public.products
  set stock_quantity = product_row.stock_quantity + delta,
      updated_at = now()
  where id = product_row.id;

  insert into public.stock_movements (
    business_id, product_id, quantity, movement_type, note,
    previous_stock, new_stock, created_by
  )
  values (
    p_business_id, product_row.id, delta, p_movement_type, nullif(trim(p_note), ''),
    product_row.stock_quantity, product_row.stock_quantity + delta, auth.uid()
  )
  returning stock_movements.id, stock_movements.previous_stock, stock_movements.new_stock
  into v_movement_id, v_previous_stock, v_new_stock;

  movement_id := v_movement_id;
  previous_stock := v_previous_stock;
  new_stock := v_new_stock;
  return next;
end;
$$;

revoke all on function public.apply_stock_movement(uuid, uuid, numeric, text, text) from public, anon;
grant execute on function public.apply_stock_movement(uuid, uuid, numeric, text, text) to authenticated;

create or replace function public.enforce_subscription_member_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_members integer;
  member_limit integer;
begin
  if exists (
    select 1
    from public.business_members
    where business_id = new.business_id
      and user_id = new.user_id
  ) then
    return new;
  end if;

  select case plan
    when 'pro' then 5
    when 'business' then 25
    else 0
  end
  into member_limit
  from public.business_subscriptions
  where business_id = new.business_id
    and status in ('active', 'trialing')
    and (expires_at is null or expires_at > now());

  if coalesce(member_limit, 0) = 0 then
    raise exception 'L’accès à l’équipe nécessite un abonnement Pro ou Business actif.';
  end if;

  select count(*)::integer
  into current_members
  from public.business_members
  where business_id = new.business_id;

  if current_members >= member_limit then
    raise exception 'La limite de % utilisateur(s) de votre abonnement est atteinte.', member_limit;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_subscription_member_limit on public.business_members;
create trigger enforce_subscription_member_limit
before insert on public.business_members
for each row execute function public.enforce_subscription_member_limit();

revoke all on function public.enforce_subscription_member_limit() from public, anon;

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
  created_recurring public.recurring_invoices;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;
  if not public.has_active_business_subscription(p_business_id, array['starter', 'pro', 'business']) then
    raise exception 'Les factures récurrentes nécessitent un abonnement payant actif.';
  end if;

  insert into public.recurring_invoices (
    business_id, client_id, product_id, frequency, next_issue_date, due_days
  )
  values (
    p_business_id, p_client_id, p_product_id, p_frequency, p_next_issue_date, p_due_days
  )
  returning * into created_recurring;

  return created_recurring;
end;
$$;

revoke all on function public.create_recurring_invoice(uuid, uuid, uuid, text, date, integer) from public, anon;
grant execute on function public.create_recurring_invoice(uuid, uuid, uuid, text, date, integer) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20261017184500_enable_recurring_invoices_for_paid_plans.sql
-- ============================================================================
drop policy if exists "demo owner reads recurring invoices" on public.recurring_invoices;
drop policy if exists "demo owner manages recurring invoices" on public.recurring_invoices;
drop policy if exists "team members read recurring invoices" on public.recurring_invoices;
drop policy if exists "team members manage recurring invoices" on public.recurring_invoices;
drop policy if exists "business owners manage recurring invoices" on public.recurring_invoices;
drop policy if exists "recurring_invoices_select_own_business" on public.recurring_invoices;
drop policy if exists "recurring_invoices_update_own_business" on public.recurring_invoices;

drop policy if exists "paid members read recurring invoices" on public.recurring_invoices;

create policy "paid members read recurring invoices" on public.recurring_invoices
  for select
  using (
    public.is_business_member(business_id, 'viewer')
    and public.has_active_business_subscription(business_id, array['starter', 'pro', 'business'])
  );

drop policy if exists "paid members create recurring invoices" on public.recurring_invoices;

create policy "paid members create recurring invoices" on public.recurring_invoices
  for insert
  with check (
    public.is_business_member(business_id, 'member')
    and public.has_active_business_subscription(business_id, array['starter', 'pro', 'business'])
  );

drop policy if exists "paid members update recurring invoices" on public.recurring_invoices;

create policy "paid members update recurring invoices" on public.recurring_invoices
  for update
  using (
    public.is_business_member(business_id, 'member')
    and public.has_active_business_subscription(business_id, array['starter', 'pro', 'business'])
  )
  with check (
    public.is_business_member(business_id, 'member')
    and public.has_active_business_subscription(business_id, array['starter', 'pro', 'business'])
  );

drop policy if exists "paid members delete recurring invoices" on public.recurring_invoices;

create policy "paid members delete recurring invoices" on public.recurring_invoices
  for delete
  using (
    public.is_business_member(business_id, 'member')
    and public.has_active_business_subscription(business_id, array['starter', 'pro', 'business'])
  );

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
  created_recurring public.recurring_invoices;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;
  if not public.has_active_business_subscription(p_business_id, array['starter', 'pro', 'business']) then
    raise exception 'Les factures récurrentes nécessitent un abonnement Starter, Pro ou Business actif.';
  end if;

  insert into public.recurring_invoices (
    business_id, client_id, product_id, frequency, next_issue_date, due_days
  )
  values (
    p_business_id, p_client_id, p_product_id, p_frequency, p_next_issue_date, p_due_days
  )
  returning * into created_recurring;

  return created_recurring;
end;
$$;

revoke all on function public.create_recurring_invoice(uuid, uuid, uuid, text, date, integer) from public, anon;
grant execute on function public.create_recurring_invoice(uuid, uuid, uuid, text, date, integer) to authenticated;

create or replace function public.process_due_recurring_invoices()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  recurring record;
  subscription_row record;
  invoice_id uuid;
  invoice_number text;
  processed integer := 0;
  invoice_count integer;
  next_date date;
begin
  perform pg_advisory_xact_lock(hashtext('facturefacile:recurring-invoices'));

  for recurring in
    select r.*, p.name as product_name, p.price as product_price, p.product_type, p.stock_quantity
    from public.recurring_invoices r
    join public.products p on p.id = r.product_id and p.business_id = r.business_id
    where r.active = true and r.next_issue_date <= current_date
    order by r.next_issue_date, r.created_at
  loop
    next_date := case recurring.frequency
      when 'weekly' then recurring.next_issue_date + 7
      when 'monthly' then (recurring.next_issue_date + interval '1 month')::date
      when 'quarterly' then (recurring.next_issue_date + interval '3 months')::date
      when 'yearly' then (recurring.next_issue_date + interval '1 year')::date
    end;

    select *
    into subscription_row
    from public.business_subscriptions
    where business_id = recurring.business_id
    for update;

    if not found
      or subscription_row.plan not in ('starter', 'pro', 'business')
      or subscription_row.status not in ('active', 'trialing')
      or (subscription_row.expires_at is not null and subscription_row.expires_at <= now()) then
      insert into public.recurring_invoice_runs (
        recurring_invoice_id, business_id, issue_date, status, message
      ) values (
        recurring.id, recurring.business_id, recurring.next_issue_date,
        'skipped_subscription', 'Abonnement gratuit, inactif, expiré ou non configuré.'
      );
      update public.recurring_invoices
      set next_issue_date = next_date
      where id = recurring.id;
      continue;
    end if;

    select count(*)::integer
    into invoice_count
    from public.invoices
    where business_id = recurring.business_id
      and issue_date >= date_trunc('month', recurring.next_issue_date)::date
      and issue_date < (date_trunc('month', recurring.next_issue_date) + interval '1 month')::date
      and status <> 'CANCELLED';

    if invoice_count >= subscription_row.monthly_invoice_limit then
      insert into public.recurring_invoice_runs (
        recurring_invoice_id, business_id, issue_date, status, message
      ) values (
        recurring.id, recurring.business_id, recurring.next_issue_date,
        'skipped_subscription', format('Limite mensuelle de %s factures atteinte.', subscription_row.monthly_invoice_limit)
      );
      update public.recurring_invoices
      set next_issue_date = next_date
      where id = recurring.id;
      continue;
    end if;

    if recurring.product_type = 'product' and recurring.stock_quantity < 1 then
      insert into public.recurring_invoice_runs (
        recurring_invoice_id, business_id, issue_date, status, message
      ) values (
        recurring.id, recurring.business_id, recurring.next_issue_date,
        'skipped_stock', 'Stock insuffisant pour générer la facture.'
      );
      update public.recurring_invoices
      set next_issue_date = next_date
      where id = recurring.id;
      continue;
    end if;

    invoice_number := public.next_invoice_number(recurring.business_id, extract(year from recurring.next_issue_date)::integer);
    insert into public.invoices (
      business_id, client_id, invoice_number, issue_date, due_date,
      status, subtotal, total
    ) values (
      recurring.business_id, recurring.client_id, invoice_number, recurring.next_issue_date,
      recurring.next_issue_date + recurring.due_days, 'SENT',
      recurring.product_price, recurring.product_price
    ) returning id into invoice_id;

    insert into public.invoice_items (
      invoice_id, product_id, description, quantity, unit_price
    ) values (
      invoice_id, recurring.product_id, recurring.product_name, 1, recurring.product_price
    );

    if recurring.product_type = 'product' then
      update public.products
      set stock_quantity = stock_quantity - 1, updated_at = now()
      where id = recurring.product_id and business_id = recurring.business_id and stock_quantity >= 1;

      if not found then
        raise exception 'Stock insuffisant pour la récurrence %', recurring.id;
      end if;

      insert into public.stock_movements (
        business_id, product_id, quantity, movement_type, note
      ) values (
        recurring.business_id, recurring.product_id, -1,
        'out', format('Vente récurrente liée à %s', invoice_number)
      );
    end if;

    update public.recurring_invoices
    set next_issue_date = next_date, last_issued_date = recurring.next_issue_date
    where id = recurring.id;

    insert into public.recurring_invoice_runs (
      recurring_invoice_id, business_id, issue_date, status, invoice_id, message
    ) values (
      recurring.id, recurring.business_id, recurring.next_issue_date,
      'issued', invoice_id, 'Facture générée automatiquement.'
    );

    processed := processed + 1;
  end loop;

  return processed;
end;
$$;

revoke all on function public.process_due_recurring_invoices() from public, anon, authenticated;
grant execute on function public.process_due_recurring_invoices() to service_role;

notify pgrst, 'reload schema';

-- ============================================================================
-- Source: supabase/migrations/20261018002000_stock_inventory_and_supplier_tracking.sql
-- ============================================================================
alter table public.stock_movements
  add column if not exists supplier_name text;

alter table public.stock_movements
  drop constraint if exists stock_movements_quantity_check;

alter table public.stock_movements
  add constraint stock_movements_quantity_check
  check (movement_type = 'adjustment' or quantity <> 0);

drop function if exists public.apply_stock_movement(uuid, uuid, numeric, text, text);
drop function if exists public.apply_stock_movement(uuid, uuid, numeric, text, text, text);

create function public.apply_stock_movement(
  p_business_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_movement_type text,
  p_note text default null,
  p_supplier_name text default null
)
returns table (
  movement_id uuid,
  previous_stock numeric,
  new_stock numeric
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  product_row public.products%rowtype;
  delta numeric;
  v_movement_id uuid;
  v_previous_stock numeric;
  v_new_stock numeric;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;

  if p_product_id is null or p_quantity is null or p_quantity < 0
     or (p_movement_type in ('in', 'out') and p_quantity = 0) then
    raise exception 'La quantité doit être positive, sauf pour un ajustement à zéro.';
  end if;

  if p_movement_type not in ('in', 'out', 'adjustment') then
    raise exception 'Type de mouvement invalide.';
  end if;

  select *
  into product_row
  from public.products
  where id = p_product_id
    and business_id = p_business_id
    and product_type = 'product'
  for update;

  if not found then
    raise exception 'Produit non autorisé ou non stockable.';
  end if;

  delta := case
    when p_movement_type = 'in' then p_quantity
    when p_movement_type = 'out' then -p_quantity
    else p_quantity - product_row.stock_quantity
  end;

  if product_row.stock_quantity + delta < 0 then
    raise exception 'Le stock ne peut pas être négatif.';
  end if;

  update public.products
  set stock_quantity = product_row.stock_quantity + delta,
      updated_at = now()
  where id = product_row.id;

  insert into public.stock_movements (
    business_id, product_id, quantity, movement_type, supplier_name, note,
    previous_stock, new_stock, created_by
  )
  values (
    p_business_id, product_row.id, delta, p_movement_type,
    case when p_movement_type = 'in' then nullif(trim(p_supplier_name), '') else null end,
    nullif(trim(p_note), ''),
    product_row.stock_quantity, product_row.stock_quantity + delta, auth.uid()
  )
  returning stock_movements.id, stock_movements.previous_stock, stock_movements.new_stock
  into v_movement_id, v_previous_stock, v_new_stock;

  movement_id := v_movement_id;
  previous_stock := v_previous_stock;
  new_stock := v_new_stock;
  return next;
end;
$$;

revoke all on function public.apply_stock_movement(uuid, uuid, numeric, text, text, text) from public, anon;
grant execute on function public.apply_stock_movement(uuid, uuid, numeric, text, text, text) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20261018003000_expense_receipts_supplier_payment.sql
-- ============================================================================
alter table public.expenses
  add column if not exists supplier_name text,
  add column if not exists payment_method text not null default 'cash',
  add column if not exists receipt_path text;

alter table public.expenses
  drop constraint if exists expenses_payment_method_check;

alter table public.expenses
  add constraint expenses_payment_method_check
  check (payment_method in ('cash', 'mobile_money', 'bank_transfer', 'card', 'check', 'other'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expense-receipts',
  'expense-receipts',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "business members read expense receipts" on storage.objects;
drop policy if exists "business members read expense receipts" on storage.objects;
create policy "business members read expense receipts" on storage.objects for select
  using (
    bucket_id = 'expense-receipts'
    and public.is_business_member((storage.foldername(name))[1]::uuid, 'viewer')
  );

drop policy if exists "business members upload expense receipts" on storage.objects;
drop policy if exists "business members upload expense receipts" on storage.objects;
create policy "business members upload expense receipts" on storage.objects for insert
  with check (
    bucket_id = 'expense-receipts'
    and public.is_business_member((storage.foldername(name))[1]::uuid, 'member')
  );

drop policy if exists "business members update expense receipts" on storage.objects;
drop policy if exists "business members update expense receipts" on storage.objects;
create policy "business members update expense receipts" on storage.objects for update
  using (
    bucket_id = 'expense-receipts'
    and public.is_business_member((storage.foldername(name))[1]::uuid, 'member')
  )
  with check (
    bucket_id = 'expense-receipts'
    and public.is_business_member((storage.foldername(name))[1]::uuid, 'member')
  );

drop policy if exists "business members delete expense receipts" on storage.objects;
drop policy if exists "business members delete expense receipts" on storage.objects;
create policy "business members delete expense receipts" on storage.objects for delete
  using (
    bucket_id = 'expense-receipts'
    and public.is_business_member((storage.foldername(name))[1]::uuid, 'member')
  );

create or replace function public.set_expense_receipt_path(
  p_business_id uuid,
  p_expense_id uuid,
  p_receipt_path text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_path text;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;

  if p_receipt_path not like p_business_id::text || '/' || p_expense_id::text || '/receipt.%' then
    raise exception 'Chemin de justificatif invalide.';
  end if;

  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'expense-receipts'
      and name = p_receipt_path
  ) then
    raise exception 'Fichier justificatif introuvable.';
  end if;

  select receipt_path
  into previous_path
  from public.expenses
  where id = p_expense_id
    and business_id = p_business_id
  for update;

  if not found then
    raise exception 'Dépense introuvable.';
  end if;

  update public.expenses
  set receipt_path = p_receipt_path
  where id = p_expense_id
    and business_id = p_business_id;

  return previous_path;
end;
$$;

revoke all on function public.set_expense_receipt_path(uuid, uuid, text) from public, anon;
grant execute on function public.set_expense_receipt_path(uuid, uuid, text) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20261018130000_recurring_invoice_failure_policy.sql
-- ============================================================================
alter table public.recurring_invoices
  add column if not exists consecutive_failures integer not null default 0
    check (consecutive_failures between 0 and 3),
  add column if not exists last_error text,
  add column if not exists retry_at timestamptz,
  add column if not exists failure_suspended boolean not null default false,
  add column if not exists last_attempt_at timestamptz;

alter table public.recurring_invoice_runs
  drop constraint if exists recurring_invoice_runs_status_check,
  add column if not exists attempt_number integer not null default 1
    check (attempt_number > 0),
  add constraint recurring_invoice_runs_status_check
    check (status in ('issued', 'skipped_stock', 'skipped_subscription', 'failed'));

create index if not exists recurring_invoices_retry_idx
  on public.recurring_invoices (retry_at, next_issue_date)
  where active = true and failure_suspended = false;

create or replace function public.run_recurring_invoice(p_recurring_invoice_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recurring public.recurring_invoices;
  product_row public.products;
  subscription_row public.business_subscriptions;
  invoice_id uuid;
  invoice_number text;
  invoice_count integer;
  next_date date;
  failure_message text;
  next_failure_count integer;
begin
  select * into recurring
  from public.recurring_invoices
  where id = p_recurring_invoice_id
  for update;
  if not found
    or not recurring.active
    or recurring.next_issue_date > current_date
    or (recurring.retry_at is not null and recurring.retry_at > now()) then
    return false;
  end if;

  next_date := case recurring.frequency
    when 'weekly' then recurring.next_issue_date + 7
    when 'monthly' then (recurring.next_issue_date + interval '1 month')::date
    when 'quarterly' then (recurring.next_issue_date + interval '3 months')::date
    when 'yearly' then (recurring.next_issue_date + interval '1 year')::date
  end;

  begin
    select * into product_row
    from public.products
    where id = recurring.product_id and business_id = recurring.business_id
    for update;
    if not found then
      raise exception 'Le produit ou service associé à cette récurrence est introuvable.';
    end if;

    select * into subscription_row
    from public.business_subscriptions
    where business_id = recurring.business_id
    for update;

    if not found
      or subscription_row.plan not in ('starter', 'pro', 'business')
      or subscription_row.status not in ('active', 'trialing')
      or (subscription_row.expires_at is not null and subscription_row.expires_at <= now()) then
      raise exception 'Abonnement gratuit, inactif, expiré ou non configuré.';
    end if;

    select count(*)::integer into invoice_count
    from public.invoices
    where business_id = recurring.business_id
      and issue_date >= date_trunc('month', recurring.next_issue_date)::date
      and issue_date < (date_trunc('month', recurring.next_issue_date) + interval '1 month')::date
      and status <> 'CANCELLED';

    if invoice_count >= subscription_row.monthly_invoice_limit then
      insert into public.recurring_invoice_runs (
        recurring_invoice_id, business_id, issue_date, status, message, attempt_number
      ) values (
        recurring.id, recurring.business_id, recurring.next_issue_date,
        'skipped_subscription', format('Limite mensuelle de %s factures atteinte.', subscription_row.monthly_invoice_limit), 1
      );
      update public.recurring_invoices
      set next_issue_date = next_date, consecutive_failures = 0,
          last_error = null, retry_at = null, failure_suspended = false,
          last_attempt_at = now()
      where id = recurring.id;
      return false;
    end if;

    if product_row.product_type = 'product' and product_row.stock_quantity < 1 then
      raise exception 'Stock insuffisant pour générer la facture.';
    end if;

    invoice_number := public.next_invoice_number(
      recurring.business_id,
      extract(year from recurring.next_issue_date)::integer
    );
    insert into public.invoices (
      business_id, client_id, invoice_number, issue_date, due_date,
      status, subtotal, total
    ) values (
      recurring.business_id, recurring.client_id, invoice_number,
      recurring.next_issue_date, recurring.next_issue_date + recurring.due_days,
      'SENT', product_row.price, product_row.price
    ) returning id into invoice_id;

    insert into public.invoice_items (
      invoice_id, product_id, description, quantity, unit_price
    ) values (
      invoice_id, recurring.product_id, product_row.name, 1, product_row.price
    );

    if product_row.product_type = 'product' then
      update public.products
      set stock_quantity = stock_quantity - 1, updated_at = now()
      where id = recurring.product_id
        and business_id = recurring.business_id
        and stock_quantity >= 1;

      if not found then
        raise exception 'Stock insuffisant pour la récurrence %', recurring.id;
      end if;

      insert into public.stock_movements (
        business_id, product_id, quantity, movement_type, note
      ) values (
        recurring.business_id, recurring.product_id, -1, 'out',
        format('Vente récurrente liée à %s', invoice_number)
      );
    end if;

    update public.recurring_invoices
    set next_issue_date = next_date,
        last_issued_date = recurring.next_issue_date,
        consecutive_failures = 0,
        last_error = null,
        retry_at = null,
        failure_suspended = false,
        last_attempt_at = now()
    where id = recurring.id;

    insert into public.recurring_invoice_runs (
      recurring_invoice_id, business_id, issue_date, status, invoice_id, message, attempt_number
    ) values (
      recurring.id, recurring.business_id, recurring.next_issue_date,
      'issued', invoice_id, 'Facture générée automatiquement.', recurring.consecutive_failures + 1
    );
    return true;
  exception when others then
    get stacked diagnostics failure_message = message_text;
  end;

  next_failure_count := recurring.consecutive_failures + 1;
  update public.recurring_invoices
  set consecutive_failures = next_failure_count,
      last_error = left(failure_message, 1000),
      retry_at = case when next_failure_count >= 3 then null else now() + interval '1 day' end,
      failure_suspended = next_failure_count >= 3,
      active = case when next_failure_count >= 3 then false else active end,
      last_attempt_at = now()
  where id = recurring.id;

  insert into public.recurring_invoice_runs (
    recurring_invoice_id, business_id, issue_date, status, message, attempt_number
  ) values (
    recurring.id, recurring.business_id, recurring.next_issue_date,
    'failed',
    case when next_failure_count >= 3
      then format('Suspension après %s échecs. %s', next_failure_count, left(failure_message, 900))
      else format('Nouvelle tentative prévue après environ 24 heures (%s/3). %s', next_failure_count, left(failure_message, 850))
    end,
    next_failure_count
  );
  return false;
end;
$$;

revoke all on function public.run_recurring_invoice(uuid) from public, anon, authenticated;

create or replace function public.process_due_recurring_invoices()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  recurring_id uuid;
  issued_count integer := 0;
begin
  perform pg_advisory_xact_lock(hashtext('facturefacile:recurring-invoices'));

  for recurring_id in
    select id
    from public.recurring_invoices
    where active = true
      and failure_suspended = false
      and next_issue_date <= current_date
      and (retry_at is null or retry_at <= now())
    order by next_issue_date, created_at
  loop
    if public.run_recurring_invoice(recurring_id) then
      issued_count := issued_count + 1;
    end if;
  end loop;
  return issued_count;
end;
$$;

revoke all on function public.process_due_recurring_invoices() from public, anon, authenticated;
grant execute on function public.process_due_recurring_invoices() to service_role;

create or replace function public.retry_recurring_invoice(
  p_business_id uuid,
  p_recurring_invoice_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recurring public.recurring_invoices;
  issued boolean;
begin
  if auth.uid() is null or not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;
  if not public.has_active_business_subscription(p_business_id, array['starter', 'pro', 'business']) then
    raise exception 'Un abonnement actif est requis pour relancer une facture récurrente.';
  end if;

  perform pg_advisory_xact_lock(hashtext('facturefacile:recurring-invoices'));
  select * into recurring
  from public.recurring_invoices
  where id = p_recurring_invoice_id and business_id = p_business_id
  for update;
  if not found then
    raise exception 'Récurrence introuvable.';
  end if;
  if recurring.consecutive_failures = 0 or recurring.failure_suspended = false and recurring.last_error is null then
    raise exception 'Aucun échec à relancer pour cette récurrence.';
  end if;
  if recurring.next_issue_date > current_date then
    raise exception 'Cette échéance n’est pas encore arrivée.';
  end if;

  update public.recurring_invoices
  set active = true,
      failure_suspended = false,
      consecutive_failures = 0,
      retry_at = null
  where id = recurring.id;

  issued := public.run_recurring_invoice(recurring.id);
  return issued;
end;
$$;

revoke all on function public.retry_recurring_invoice(uuid, uuid) from public, anon;
grant execute on function public.retry_recurring_invoice(uuid, uuid) to authenticated;

create or replace function public.notify_recurring_invoice_run()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  suspended boolean;
begin
  if new.status = 'failed' then
    select failure_suspended into suspended
    from public.recurring_invoices
    where id = new.recurring_invoice_id;
  end if;

  insert into public.business_notifications (
    business_id, type, alert_key, title, message, severity
  )
  values (
    new.business_id,
    'recurring_invoice',
    'recurring-run:' || new.id::text,
    case
      when new.status = 'issued' then 'Facture récurrente générée'
      when new.status = 'failed' and coalesce(suspended, false) then 'Récurrence suspendue après plusieurs échecs'
      when new.status = 'failed' then 'Échec de facture récurrente : nouvelle tentative prévue'
      when new.status = 'skipped_stock' then 'Facture récurrente ignorée : stock insuffisant'
      else 'Facture récurrente ignorée : abonnement ou limite'
    end,
    format(
      'Échéance du %s · tentative %s. %s',
      to_char(new.issue_date, 'DD/MM/YYYY'),
      new.attempt_number,
      coalesce(new.message, 'Aucun détail fourni.')
    ),
    case
      when new.status = 'issued' then 'info'
      when new.status = 'failed' and coalesce(suspended, false) then 'critical'
      when new.status = 'failed' then 'warning'
      else 'warning'
    end
  )
  on conflict (business_id, alert_key) do update
    set title = excluded.title,
        message = excluded.message,
        severity = excluded.severity,
        active = true,
        archived_at = null,
        read_at = null,
        updated_at = now();

  return new;
end;
$$;

revoke all on function public.notify_recurring_invoice_run() from public, anon, authenticated;

-- ============================================================================
-- Source: supabase/migrations/20261019001000_invoice_communication_audit.sql
-- ============================================================================
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
drop policy if exists "business members read invoice communications" on public.invoice_communications;
create policy "business members read invoice communications" on public.invoice_communications for select
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

-- ============================================================================
-- Source: supabase/migrations/20261019002000_payment_reconciliation_and_refunds.sql
-- ============================================================================
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
drop policy if exists "business members read payment events" on public.payment_events;
create policy "business members read payment events" on public.payment_events for select
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

-- ============================================================================
-- Source: supabase/migrations/20261019003000_audit_immutability_actor_search.sql
-- ============================================================================
drop policy if exists "audit_logs_delete_own_business" on public.audit_logs;
revoke delete, update on public.audit_logs from public, anon, authenticated;

create or replace function public.list_business_audit_logs(
  p_business_id uuid,
  p_query text default null,
  p_action text default null,
  p_table_name text default null,
  p_from date default null,
  p_to date default null
)
returns table (
  id uuid,
  table_name text,
  action text,
  record_id uuid,
  changed_fields text[],
  actor_label text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not (
    exists (
      select 1 from public.businesses b
      where b.id = p_business_id and b.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.business_members bm
      where bm.business_id = p_business_id
        and bm.user_id = auth.uid()
        and bm.role in ('owner', 'admin')
    )
  ) then
    raise exception 'Accès non autorisé au journal de cette entreprise.';
  end if;

  return query
  select
    al.id,
    al.table_name,
    al.action,
    al.record_id,
    al.changed_fields,
    coalesce(
      nullif(u.raw_user_meta_data ->> 'full_name', ''),
      nullif(u.raw_user_meta_data ->> 'name', ''),
      u.email,
      'Acteur non renseigné'
    )::text,
    al.created_at
  from public.audit_logs al
  left join auth.users u on u.id = al.actor_id
  where al.business_id = p_business_id
    and (p_action is null or al.action = p_action)
    and (p_table_name is null or al.table_name = p_table_name)
    and (p_from is null or al.created_at::date >= p_from)
    and (p_to is null or al.created_at::date <= p_to)
    and (
      nullif(trim(p_query), '') is null
      or position(lower(trim(p_query)) in lower(concat_ws(' ', al.table_name, al.action, al.record_id::text, u.email, u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'))) > 0
    )
  order by al.created_at desc
  limit 500;
end;
$$;

revoke all on function public.list_business_audit_logs(uuid, text, text, text, date, date) from public, anon;
grant execute on function public.list_business_audit_logs(uuid, text, text, text, date, date) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20261019004000_confirmed_audit_log_deletion.sql
-- ============================================================================
create table if not exists public.audit_log_maintenance (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  actor_id uuid references auth.users(id) on delete set null,
  removed_audit_log_id uuid not null,
  removed_table_name text not null,
  removed_action text not null,
  removed_record_id uuid,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.audit_log_maintenance enable row level security;
revoke all on public.audit_log_maintenance from public, anon, authenticated;

create or replace function public.list_business_audit_logs(
  p_business_id uuid,
  p_query text default null,
  p_action text default null,
  p_table_name text default null,
  p_from date default null,
  p_to date default null
)
returns table (
  id uuid,
  table_name text,
  action text,
  record_id uuid,
  changed_fields text[],
  actor_label text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not (
    exists (
      select 1 from public.businesses b
      where b.id = p_business_id and b.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.business_members bm
      where bm.business_id = p_business_id
        and bm.user_id = auth.uid()
        and bm.role in ('owner', 'admin')
    )
  ) then
    raise exception 'Accès non autorisé au journal de cette entreprise.';
  end if;

  return query
  select
    al.id,
    al.table_name,
    al.action,
    al.record_id,
    al.changed_fields,
    coalesce(
      nullif(u.raw_user_meta_data ->> 'full_name', ''),
      nullif(u.raw_user_meta_data ->> 'name', ''),
      u.email,
      'Acteur non renseigné'
    )::text,
    al.created_at
  from public.audit_logs al
  left join auth.users u on u.id = al.actor_id
  where al.business_id = p_business_id
    and (p_action is null or al.action = p_action)
    and (p_table_name is null or al.table_name = p_table_name)
    and (p_from is null or al.created_at::date >= p_from)
    and (p_to is null or al.created_at::date <= p_to)
    and (
      nullif(trim(p_query), '') is null
      or position(lower(trim(p_query)) in lower(concat_ws(' ', al.table_name, al.action, al.record_id::text, u.email, u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'))) > 0
    )
  order by al.created_at desc
  limit 500;
end;
$$;

revoke all on function public.list_business_audit_logs(uuid, text, text, text, date, date) from public, anon;
grant execute on function public.list_business_audit_logs(uuid, text, text, text, date, date) to authenticated;

create or replace function public.delete_business_audit_log(
  p_business_id uuid,
  p_audit_log_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  audit_entry public.audit_logs;
begin
  if auth.uid() is null or not (
    exists (
      select 1 from public.businesses b
      where b.id = p_business_id and b.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.business_members bm
      where bm.business_id = p_business_id
        and bm.user_id = auth.uid()
        and bm.role in ('owner', 'admin')
    )
  ) then
    raise exception 'Seuls le propriétaire ou un administrateur peuvent supprimer une entrée du journal.';
  end if;

  select * into audit_entry
  from public.audit_logs
  where id = p_audit_log_id and business_id = p_business_id
  for update;
  if not found then
    raise exception 'Entrée du journal introuvable dans cette entreprise.';
  end if;

  insert into public.audit_log_maintenance (
    business_id, actor_id, removed_audit_log_id, removed_table_name,
    removed_action, removed_record_id, reason
  ) values (
    p_business_id, auth.uid(), audit_entry.id, audit_entry.table_name,
    audit_entry.action, audit_entry.record_id, 'Suppression confirmée par un administrateur'
  );

  delete from public.audit_logs
  where id = audit_entry.id and business_id = p_business_id;
end;
$$;

revoke all on function public.delete_business_audit_log(uuid, uuid) from public, anon;
grant execute on function public.delete_business_audit_log(uuid, uuid) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20261019005000_ai_assistant_usage_limits.sql
-- ============================================================================
create table if not exists public.ai_assistant_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0 check (request_count > 0),
  primary key (user_id, usage_date)
);

alter table public.ai_assistant_daily_usage enable row level security;
revoke all on public.ai_assistant_daily_usage from public, anon, authenticated;
grant select, insert, update, delete on public.ai_assistant_daily_usage to service_role;

create or replace function public.consume_ai_assistant_quota(
  p_user_id uuid,
  p_daily_limit integer
)
returns table (allowed boolean, used integer, daily_limit integer, usage_date date)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  quota_date date := (now() at time zone 'UTC')::date;
  current_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Cette opération est réservée au service IA.';
  end if;
  if p_user_id is null or p_daily_limit is null or p_daily_limit < 1 or p_daily_limit > 100 then
    raise exception 'Paramètres de quota invalides.';
  end if;

  delete from public.ai_assistant_daily_usage
  where ai_assistant_daily_usage.usage_date < quota_date - 90;

  insert into public.ai_assistant_daily_usage as daily_usage (user_id, usage_date, request_count)
  values (p_user_id, quota_date, 1)
  on conflict (user_id, usage_date) do update
    set request_count = daily_usage.request_count + 1
    where daily_usage.request_count < p_daily_limit
  returning request_count into current_count;

  if not found then
    select request_count
      into current_count
      from public.ai_assistant_daily_usage
     where ai_assistant_daily_usage.user_id = p_user_id
       and ai_assistant_daily_usage.usage_date = quota_date;
    return query select false, current_count, p_daily_limit, quota_date;
  else
    return query select true, current_count, p_daily_limit, quota_date;
  end if;
end;
$$;

revoke all on function public.consume_ai_assistant_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_assistant_quota(uuid, integer) to service_role;

-- ============================================================================
-- Source: supabase/migrations/20261019006000_business_invoice_payment_details.sql
-- ============================================================================
alter table public.businesses
  add column if not exists payment_instructions text,
  add column if not exists invoice_legal_notice text;

-- ============================================================================
-- Source: supabase/migrations/20261019007000_business_invoice_preferences.sql
-- ============================================================================
alter table public.businesses
  add column if not exists timezone text not null default 'Africa/Porto-Novo',
  add column if not exists invoice_number_prefix text not null default 'FAC',
  add column if not exists invoice_number_include_year boolean not null default true,
  add column if not exists invoice_number_sequence_width integer not null default 5;

alter table public.businesses
  drop constraint if exists businesses_timezone_check,
  drop constraint if exists businesses_invoice_number_prefix_check,
  drop constraint if exists businesses_invoice_number_sequence_width_check,
  add constraint businesses_timezone_check
    check (timezone in ('Africa/Porto-Novo', 'Africa/Abidjan', 'Africa/Lagos', 'UTC')),
  add constraint businesses_invoice_number_prefix_check
    check (invoice_number_prefix ~ '^[A-Z0-9][A-Z0-9-]{0,11}$'),
  add constraint businesses_invoice_number_sequence_width_check
    check (invoice_number_sequence_width between 3 and 8);

alter table public.invoice_counters
  drop constraint if exists invoice_counters_invoice_year_check,
  add constraint invoice_counters_invoice_year_check
    check (invoice_year between 0 and 9999);

create or replace function public.next_invoice_number(p_business_id uuid, p_invoice_year integer)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_number integer;
  counter_year integer;
  number_prefix text;
  include_year boolean;
  sequence_width integer;
  candidate text;
begin
  select invoice_number_prefix, invoice_number_include_year, invoice_number_sequence_width
    into number_prefix, include_year, sequence_width
    from public.businesses
   where id = p_business_id;

  if not found then
    raise exception 'Entreprise introuvable pour la numérotation.';
  end if;
  if p_invoice_year is null or p_invoice_year < 2000 or p_invoice_year > 9999 then
    raise exception 'Année de numérotation invalide.';
  end if;

  counter_year := case when include_year then p_invoice_year else 0 end;
  loop
    insert into public.invoice_counters (business_id, invoice_year, last_number)
    values (p_business_id, counter_year, 1)
    on conflict (business_id, invoice_year)
    do update set last_number = public.invoice_counters.last_number + 1
    returning last_number into next_number;

    candidate := number_prefix || '-' ||
      case when include_year then p_invoice_year::text || '-' else '' end ||
      lpad(next_number::text, sequence_width, '0');

    exit when not exists (
      select 1
        from public.invoices
       where business_id = p_business_id
         and invoice_number = candidate
    );
  end loop;

  return candidate;
end;
$$;

alter table public.invoices
  add column if not exists currency text not null default 'XOF';

alter table public.invoices
  drop constraint if exists invoices_currency_check,
  add constraint invoices_currency_check
    check (currency in ('XOF', 'EUR', 'USD'));

update public.invoices i
   set currency = coalesce(b.currency, 'XOF')
  from public.businesses b
 where i.business_id = b.id;

create or replace function public.set_invoice_currency_from_business()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select coalesce(currency, 'XOF')
    into new.currency
    from public.businesses
   where id = new.business_id;

  if not found then
    raise exception 'Entreprise introuvable pour la devise de la facture.';
  end if;
  return new;
end;
$$;

drop trigger if exists set_invoice_currency_from_business on public.invoices;
create trigger set_invoice_currency_from_business
before insert on public.invoices
for each row execute function public.set_invoice_currency_from_business();

-- ============================================================================
-- Source: supabase/migrations/20261019008000_mfa_enforcement.sql
-- ============================================================================
create or replace function public.mfa_requirement_satisfied()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select not exists (
    select 1
    from auth.mfa_factors factor
    where factor.user_id = auth.uid()
      and factor.status = 'verified'
  )
  or auth.jwt() ->> 'aal' = 'aal2';
$$;

revoke all on function public.mfa_requirement_satisfied() from public, anon;
grant execute on function public.mfa_requirement_satisfied() to authenticated;

do $$
declare
  table_name text;
begin
  for table_name in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity
  loop
    execute format('drop policy if exists "require aal2 when mfa enrolled" on public.%I', table_name);
    execute format(
      'create policy "require aal2 when mfa enrolled" on public.%I as restrictive for all to authenticated using (public.mfa_requirement_satisfied()) with check (public.mfa_requirement_satisfied())',
      table_name
    );
  end loop;
end;
$$;

-- ============================================================================
-- Source: supabase/migrations/20261019009000_account_support_replies.sql
-- ============================================================================
create or replace function public.reply_my_support_ticket(p_ticket_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Connexion requise pour répondre à une demande.';
  end if;
  if nullif(trim(p_body), '') is null or length(trim(p_body)) > 5000 then
    raise exception 'Le message est obligatoire et limité à 5000 caractères.';
  end if;
  if not exists (
    select 1
    from public.support_tickets
    where id = p_ticket_id and user_id = auth.uid()
  ) then
    raise exception 'Demande introuvable ou accès non autorisé.';
  end if;

  insert into public.support_ticket_messages (ticket_id, author_id, body, internal)
  values (p_ticket_id, auth.uid(), trim(p_body), false);

  update public.support_tickets
     set updated_at = now(),
         status = case when status in ('resolved', 'closed') then 'open' else status end
   where id = p_ticket_id and user_id = auth.uid();
end;
$$;

revoke all on function public.reply_my_support_ticket(uuid, text) from public, anon;
grant execute on function public.reply_my_support_ticket(uuid, text) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20261019010000_repair_business_invoice_payment_details.sql
-- ============================================================================
alter table public.businesses
  add column if not exists payment_instructions text,
  add column if not exists invoice_legal_notice text;

-- ============================================================================
-- Source: supabase/migrations/20261019011000_user_profile_photos.sql
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-profile-photos', 'user-profile-photos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile photos are publicly readable" on storage.objects;
drop policy if exists "profile photos are publicly readable" on storage.objects;
create policy "profile photos are publicly readable" on storage.objects for select
  using (bucket_id = 'user-profile-photos');

drop policy if exists "users upload own profile photos" on storage.objects;
drop policy if exists "users upload own profile photos" on storage.objects;
create policy "users upload own profile photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'user-profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users update own profile photos" on storage.objects;
drop policy if exists "users update own profile photos" on storage.objects;
create policy "users update own profile photos" on storage.objects for update to authenticated
  using (bucket_id = 'user-profile-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'user-profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users delete own profile photos" on storage.objects;
drop policy if exists "users delete own profile photos" on storage.objects;
create policy "users delete own profile photos" on storage.objects for delete to authenticated
  using (bucket_id = 'user-profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- Source: supabase/migrations/20261029001000_retry_missed_recurring_invoices.sql
-- ============================================================================
create or replace function public.retry_recurring_invoice(
  p_business_id uuid,
  p_recurring_invoice_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recurring public.recurring_invoices;
  issued boolean;
begin
  if auth.uid() is null or not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;
  if not public.has_active_business_subscription(p_business_id, array['starter', 'pro', 'business']) then
    raise exception 'Un abonnement actif est requis pour relancer une facture récurrente.';
  end if;

  perform pg_advisory_xact_lock(hashtext('facturefacile:recurring-invoices'));
  select * into recurring
  from public.recurring_invoices
  where id = p_recurring_invoice_id and business_id = p_business_id
  for update;
  if not found then
    raise exception 'Récurrence introuvable.';
  end if;
  if recurring.next_issue_date > current_date then
    raise exception 'Cette échéance n’est pas encore arrivée.';
  end if;
  if exists (
    select 1
    from public.recurring_invoice_runs
    where recurring_invoice_id = recurring.id
      and issue_date = recurring.next_issue_date
      and status <> 'failed'
  ) then
    raise exception 'Une exécution non échouée existe déjà pour cette échéance.';
  end if;

  update public.recurring_invoices
  set active = true,
      failure_suspended = false,
      consecutive_failures = 0,
      retry_at = null
  where id = recurring.id;

  issued := public.run_recurring_invoice(recurring.id);
  return issued;
end;
$$;

revoke all on function public.retry_recurring_invoice(uuid, uuid) from public, anon;
grant execute on function public.retry_recurring_invoice(uuid, uuid) to authenticated;

-- ============================================================================
-- Source: supabase/migrations/20261108100000_benin_accounting_metadata.sql
-- ============================================================================
alter table public.businesses
  add column if not exists fiscal_regime text;

alter table public.businesses
  drop constraint if exists businesses_fiscal_regime_check,
  add constraint businesses_fiscal_regime_check
    check (fiscal_regime is null or fiscal_regime in ('TPS', 'REEL'));

alter table public.invoices
  add column if not exists reg_fiscal_emetteur text,
  add column if not exists benin_document_type text,
  add column if not exists dgi_nim varchar(50),
  add column if not exists dgi_signature varchar(100),
  add column if not exists dgi_counters varchar(50),
  add column if not exists is_dgi_mock boolean not null default false,
  add column if not exists normalized_at timestamptz;

alter table public.invoices
  drop constraint if exists invoices_reg_fiscal_emetteur_check,
  add constraint invoices_reg_fiscal_emetteur_check
    check (reg_fiscal_emetteur is null or reg_fiscal_emetteur in ('TPS', 'REEL')),
  drop constraint if exists invoices_benin_document_type_check,
  add constraint invoices_benin_document_type_check
    check (benin_document_type is null or benin_document_type in ('proforma', 'recu_vente', 'bon_livraison', 'facture_interne'));

create or replace function public.snapshot_invoice_fiscal_regime()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select b.fiscal_regime
    into new.reg_fiscal_emetteur
    from public.businesses b
   where b.id = new.business_id;
  return new;
end;
$$;

drop trigger if exists invoices_snapshot_fiscal_regime on public.invoices;
create trigger invoices_snapshot_fiscal_regime
before insert on public.invoices
for each row execute function public.snapshot_invoice_fiscal_regime();

create unique index if not exists invoices_id_business_id_uidx
  on public.invoices (id, business_id);

create unique index if not exists payments_id_business_invoice_uidx
  on public.payments (id, business_id, invoice_id);

create table if not exists public.momo_reconciliations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_id uuid not null,
  payment_id uuid not null,
  provider text not null check (provider in ('mtn', 'moov', 'wave')),
  transaction_id varchar(100),
  amount numeric(12, 2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'reconciled', 'failed', 'cancelled')),
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint momo_reconciliations_invoice_business_fk
    foreign key (invoice_id, business_id)
    references public.invoices(id, business_id) on delete cascade,
  constraint momo_reconciliations_payment_invoice_fk
    foreign key (payment_id, business_id, invoice_id)
    references public.payments(id, business_id, invoice_id) on delete cascade,
  constraint momo_reconciliations_payment_id_key unique (payment_id)
);

create unique index if not exists momo_reconciliations_transaction_id_uidx
  on public.momo_reconciliations (business_id, provider, transaction_id)
  where transaction_id is not null;

create index if not exists momo_reconciliations_business_created_idx
  on public.momo_reconciliations (business_id, created_at desc);

alter table public.momo_reconciliations enable row level security;
revoke all on public.momo_reconciliations from public, anon, authenticated;
grant select on public.momo_reconciliations to authenticated;

drop policy if exists "business members read mobile money reconciliations" on public.momo_reconciliations;
drop policy if exists "business members read mobile money reconciliations" on public.momo_reconciliations;
create policy "business members read mobile money reconciliations" on public.momo_reconciliations for select
  using (public.is_business_member(business_id, 'viewer'));

create table if not exists public.dgi_mock_ifu_registry (
  ifu char(13) primary key check (ifu ~ '^[0-9]{13}$'),
  raison_sociale varchar(255) not null,
  regime_fiscal varchar(50) not null,
  adresse varchar(255),
  telephone varchar(50),
  created_at timestamptz not null default now()
);

comment on table public.dgi_mock_ifu_registry is
  'Registre réservé aux données IFU synthétiques de démonstration; ne pas y importer de données DGI réelles.';

alter table public.dgi_mock_ifu_registry enable row level security;
revoke all on public.dgi_mock_ifu_registry from public, anon, authenticated;
grant select on public.dgi_mock_ifu_registry to authenticated;

drop policy if exists "authenticated users read mock IFU registry" on public.dgi_mock_ifu_registry;
drop policy if exists "business owners read mock IFU registry" on public.dgi_mock_ifu_registry;
create policy "business owners read mock IFU registry" on public.dgi_mock_ifu_registry
  for select
  to authenticated
  using (exists (
    select 1
    from public.businesses b
    where b.owner_id = auth.uid()
  ));

revoke all on function public.snapshot_invoice_fiscal_regime() from public, anon, authenticated;

commit;
