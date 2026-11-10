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
create policy "business members read mobile money reconciliations"
  on public.momo_reconciliations for select
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
create policy "authenticated users read mock IFU registry"
  on public.dgi_mock_ifu_registry for select
  to authenticated
  using (true);

revoke all on function public.snapshot_invoice_fiscal_regime() from public, anon, authenticated;
