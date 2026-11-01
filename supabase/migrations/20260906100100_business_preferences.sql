alter table public.businesses
  add column if not exists default_due_days integer not null default 30 check (default_due_days between 0 and 365);

alter table public.businesses
  add column if not exists default_tax_rate numeric(5, 2) not null default 0 check (default_tax_rate between 0 and 100);

alter table public.businesses
  add column if not exists currency text not null default 'XOF' check (currency in ('XOF', 'EUR', 'USD'));
