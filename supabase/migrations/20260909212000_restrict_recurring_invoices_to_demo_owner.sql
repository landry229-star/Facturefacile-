drop policy if exists "team members read recurring invoices" on public.recurring_invoices;
drop policy if exists "team members manage recurring invoices" on public.recurring_invoices;
drop policy if exists "recurring_invoices_select_own_business" on public.recurring_invoices;
drop policy if exists "recurring_invoices_update_own_business" on public.recurring_invoices;

create policy "demo owner reads recurring invoices"
  on public.recurring_invoices
  for select
  using (
    public.is_business_member(business_id, 'viewer')
    and lower(coalesce((select email from auth.users where id = auth.uid()), '')) = 'azoganlandry3@gmail.com'
  );

create policy "demo owner manages recurring invoices"
  on public.recurring_invoices
  for all
  using (
    public.is_business_member(business_id, 'member')
    and lower(coalesce((select email from auth.users where id = auth.uid()), '')) = 'azoganlandry3@gmail.com'
  )
  with check (
    public.is_business_member(business_id, 'member')
    and lower(coalesce((select email from auth.users where id = auth.uid()), '')) = 'azoganlandry3@gmail.com'
  );

create or replace function public.create_recurring_invoice(
  p_business_id uuid,
  p_client_id uuid,
  p_product_id uuid,
  p_frequency text,
  p_next_issue_date date,
  p_due_days integer
)
returns public.recurring_invoices
language plpgsql
security invoker
set search_path = public
as $$
declare
  created_recurring public.recurring_invoices;
begin
  if not public.is_business_member(p_business_id, 'member')
    or lower(coalesce((select email from auth.users where id = auth.uid()), '')) <> 'azoganlandry3@gmail.com' then
    raise exception 'Les factures récurrentes sont disponibles uniquement pour le compte de démonstration Dossou.';
  end if;

  insert into public.recurring_invoices (
    business_id, client_id, product_id, frequency, next_issue_date, due_days
  )
  values (
    p_business_id, p_client_id, p_product_id, p_frequency, p_next_issue_date, p_due_days
  )
  returning * into created_recurring;

  return created_recurring;
end;
$$;

revoke all on function public.create_recurring_invoice(uuid, uuid, uuid, text, date, integer) from public, anon;
grant execute on function public.create_recurring_invoice(uuid, uuid, uuid, text, date, integer) to authenticated;
