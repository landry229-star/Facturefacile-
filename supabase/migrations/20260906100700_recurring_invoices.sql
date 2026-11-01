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
    create policy "business owners manage recurring invoices" on public.recurring_invoices
      for all using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
      with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));
  end if;
end
$$;
