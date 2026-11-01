alter table public.expenses
  add column if not exists supplier_name text,
  add column if not exists payment_method text not null default 'cash',
  add column if not exists receipt_path text;

alter table public.expenses
  drop constraint if exists expenses_payment_method_check;

alter table public.expenses
  add constraint expenses_payment_method_check
  check (payment_method in ('cash', 'mobile_money', 'bank_transfer', 'card', 'check', 'other'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expense-receipts',
  'expense-receipts',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "business members read expense receipts" on storage.objects;
create policy "business members read expense receipts"
  on storage.objects for select
  using (
    bucket_id = 'expense-receipts'
    and public.is_business_member((storage.foldername(name))[1]::uuid, 'viewer')
  );

drop policy if exists "business members upload expense receipts" on storage.objects;
create policy "business members upload expense receipts"
  on storage.objects for insert
  with check (
    bucket_id = 'expense-receipts'
    and public.is_business_member((storage.foldername(name))[1]::uuid, 'member')
  );

drop policy if exists "business members update expense receipts" on storage.objects;
create policy "business members update expense receipts"
  on storage.objects for update
  using (
    bucket_id = 'expense-receipts'
    and public.is_business_member((storage.foldername(name))[1]::uuid, 'member')
  )
  with check (
    bucket_id = 'expense-receipts'
    and public.is_business_member((storage.foldername(name))[1]::uuid, 'member')
  );

drop policy if exists "business members delete expense receipts" on storage.objects;
create policy "business members delete expense receipts"
  on storage.objects for delete
  using (
    bucket_id = 'expense-receipts'
    and public.is_business_member((storage.foldername(name))[1]::uuid, 'member')
  );

create or replace function public.set_expense_receipt_path(
  p_business_id uuid,
  p_expense_id uuid,
  p_receipt_path text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_path text;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;

  if p_receipt_path not like p_business_id::text || '/' || p_expense_id::text || '/receipt.%' then
    raise exception 'Chemin de justificatif invalide.';
  end if;

  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'expense-receipts'
      and name = p_receipt_path
  ) then
    raise exception 'Fichier justificatif introuvable.';
  end if;

  select receipt_path
  into previous_path
  from public.expenses
  where id = p_expense_id
    and business_id = p_business_id
  for update;

  if not found then
    raise exception 'Dépense introuvable.';
  end if;

  update public.expenses
  set receipt_path = p_receipt_path
  where id = p_expense_id
    and business_id = p_business_id;

  return previous_path;
end;
$$;

revoke all on function public.set_expense_receipt_path(uuid, uuid, text) from public, anon;
grant execute on function public.set_expense_receipt_path(uuid, uuid, text) to authenticated;
