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
    create policy "business owners read recurring invoice runs" on public.recurring_invoice_runs
      for select using (exists (
        select 1 from public.businesses b
        where b.id = business_id and b.owner_id = auth.uid()
      ));
  end if;
end
$$;
