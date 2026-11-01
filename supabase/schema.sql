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

create policy "business owners manage expenses" on public.expenses
  for all using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

create policy "business owners manage stock movements" on public.stock_movements
  for all using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));
