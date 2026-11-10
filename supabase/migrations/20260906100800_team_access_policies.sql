create or replace function public.is_business_member(
  p_business_id uuid,
  p_min_role text
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = p_business_id and b.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.business_members m
    where m.business_id = p_business_id
      and m.user_id = auth.uid()
      and case p_min_role
        when 'viewer' then m.role in ('viewer', 'member', 'admin')
        when 'member' then m.role in ('member', 'admin')
        when 'admin' then m.role = 'admin'
        else false
      end
  );
$$;

revoke all on function public.is_business_member(uuid, text) from public, anon;
grant execute on function public.is_business_member(uuid, text) to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['clients', 'products', 'invoices', 'payments', 'expenses', 'recurring_invoices', 'stock_movements']
  loop
    execute format('drop policy if exists "team members read %s" on public.%I', table_name, table_name);
    execute format('create policy "team members read %s" on public.%I for select using (public.is_business_member(business_id, ''viewer''))', table_name, table_name);
    execute format('drop policy if exists "team members write %s" on public.%I', table_name, table_name);
    execute format('create policy "team members write %s" on public.%I for all using (public.is_business_member(business_id, ''member'')) with check (public.is_business_member(business_id, ''member''))', table_name, table_name);
  end loop;
end
$$;

drop policy if exists "team members read invoice items" on public.invoice_items;
create policy "team members read invoice items" on public.invoice_items
  for select using (exists (
    select 1 from public.invoices i
    where i.id = invoice_id and public.is_business_member(i.business_id, 'viewer')
  ));

drop policy if exists "team members write invoice items" on public.invoice_items;
create policy "team members write invoice items" on public.invoice_items
  for all using (exists (
    select 1 from public.invoices i
    where i.id = invoice_id and public.is_business_member(i.business_id, 'member')
  )) with check (exists (
    select 1 from public.invoices i
    where i.id = invoice_id and public.is_business_member(i.business_id, 'member')
  ));

drop policy if exists "team members read audit logs" on public.audit_logs;
create policy "team members read audit logs" on public.audit_logs
  for select using (public.is_business_member(business_id, 'viewer'));
