alter table public.stock_movements
  add column if not exists previous_stock numeric(12, 2),
  add column if not exists new_stock numeric(12, 2),
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists stock_movements_business_created_at_idx
  on public.stock_movements (business_id, created_at desc);
