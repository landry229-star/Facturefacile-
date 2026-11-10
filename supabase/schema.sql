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
  'Registre temporaire de pré-lancement réservé aux données IFU synthétiques; vider avant ouverture au public et ne jamais y importer de données DGI réelles.';

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

create policy "owners manage their businesses" on public.businesses
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "business owners manage clients" on public.clients
  for all using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

create policy "business owners manage products" on public.products
  for all using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

create policy "business owners manage invoices" on public.invoices
  for all using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

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

create policy "business owners manage payments" on public.payments
  for all using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

revoke all on public.momo_reconciliations from public, anon, authenticated;
grant select on public.momo_reconciliations to authenticated;
drop policy if exists "business members read mobile money reconciliations" on public.momo_reconciliations;
create policy "business members read mobile money reconciliations"
  on public.momo_reconciliations for select
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ));

revoke all on public.dgi_mock_ifu_registry from public, anon, authenticated;
grant select on public.dgi_mock_ifu_registry to authenticated;
drop policy if exists "authenticated users read mock IFU registry" on public.dgi_mock_ifu_registry;
create policy "authenticated users read mock IFU registry"
  on public.dgi_mock_ifu_registry for select
  to authenticated
  using (exists (
    select 1
    from public.businesses b
    where b.owner_id = auth.uid()
  ));

revoke all on function public.snapshot_invoice_fiscal_regime() from public, anon, authenticated;

create policy "business owners manage expenses" on public.expenses
  for all using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

create policy "business owners manage stock movements" on public.stock_movements
  for all using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));
