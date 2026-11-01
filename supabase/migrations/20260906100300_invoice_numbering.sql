create table if not exists public.invoice_counters (
  business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_year integer not null check (invoice_year between 2000 and 9999),
  last_number integer not null default 0 check (last_number >= 0),
  primary key (business_id, invoice_year)
);

alter table public.invoice_counters enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'invoice_counters'
      and policyname = 'business owners manage invoice counters'
  ) then
    create policy "business owners manage invoice counters" on public.invoice_counters
      for all using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
      with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));
  end if;
end
$$;

create or replace function public.next_invoice_number(p_business_id uuid, p_invoice_year integer)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_number integer;
begin
  insert into public.invoice_counters (business_id, invoice_year, last_number)
  values (p_business_id, p_invoice_year, 1)
  on conflict (business_id, invoice_year)
  do update set last_number = public.invoice_counters.last_number + 1
  returning last_number into next_number;

  return format('FAC-%s-%s', p_invoice_year, lpad(next_number::text, 5, '0'));
end;
$$;
