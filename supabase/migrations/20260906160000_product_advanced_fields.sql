alter table public.products
  add column if not exists unit text not null default 'unité',
  add column if not exists purchase_price numeric(12, 2) not null default 0 check (purchase_price >= 0);
