create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  table_name text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  record_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_business_created_idx
  on public.audit_logs (business_id, created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists "business owners read audit logs" on public.audit_logs;
create policy "business owners read audit logs" on public.audit_logs
  for select using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ));

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  business uuid;
  record_uuid uuid;
begin
  business := coalesce(new.business_id, old.business_id);
  record_uuid := coalesce(new.id, old.id);
  insert into public.audit_logs (business_id, actor_id, table_name, action, record_id)
  values (business, auth.uid(), tg_table_name, tg_op, record_uuid);
  return coalesce(new, old);
end;
$$;

revoke all on function public.write_audit_log() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['clients', 'products', 'invoices', 'payments', 'expenses', 'recurring_invoices', 'stock_movements']
  loop
    execute format('drop trigger if exists audit_%s on public.%I', table_name, table_name);
    execute format('create trigger audit_%s after insert or update or delete on public.%I for each row execute function public.write_audit_log()', table_name, table_name);
  end loop;
end
$$;
