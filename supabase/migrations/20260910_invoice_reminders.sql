create table if not exists public.invoice_reminders (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  reminder_date date not null default current_date,
  reminder_type text not null default 'overdue',
  created_at timestamptz not null default now()
);

alter table public.invoice_reminders
  add column if not exists invoice_id uuid,
  add column if not exists reminder_date date default current_date,
  add column if not exists reminder_type text default 'overdue',
  add column if not exists created_at timestamptz default now();

create unique index if not exists invoice_reminders_invoice_date_type_idx
  on public.invoice_reminders (invoice_id, reminder_date, reminder_type);

alter table public.invoice_reminders enable row level security;

drop policy if exists "owners and members can read invoice reminders" on public.invoice_reminders;
create policy "owners and members can read invoice reminders"
  on public.invoice_reminders for select
  using (exists (
    select 1 from public.invoices i
    left join public.business_members m
      on m.business_id = i.business_id
     and m.user_id = auth.uid()
    left join public.businesses b
      on b.id = i.business_id
    where i.id = invoice_id
      and (m.user_id is not null or b.owner_id = auth.uid())
  ));
