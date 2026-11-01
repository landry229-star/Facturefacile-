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
