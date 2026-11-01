create table if not exists public.business_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'starter', 'pro')),
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'cancelled')),
  monthly_invoice_limit integer not null default 20 check (monthly_invoice_limit > 0),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.business_subscriptions enable row level security;

drop policy if exists "business owners read subscriptions" on public.business_subscriptions;
create policy "business owners read subscriptions" on public.business_subscriptions
  for select using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ));
