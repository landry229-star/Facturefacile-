create index if not exists expenses_business_date_idx
  on public.expenses (business_id, expense_date desc, created_at desc);

create index if not exists expenses_business_category_idx
  on public.expenses (business_id, category);
