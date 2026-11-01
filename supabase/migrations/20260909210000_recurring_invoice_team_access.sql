drop policy if exists "business owners manage recurring invoices" on public.recurring_invoices;

create policy "team members read recurring invoices"
  on public.recurring_invoices
  for select
  using (public.is_business_member(business_id, 'viewer'));

create policy "team members manage recurring invoices"
  on public.recurring_invoices
  for all
  using (public.is_business_member(business_id, 'member'))
  with check (public.is_business_member(business_id, 'member'));
