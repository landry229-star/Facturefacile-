drop policy if exists "audit_logs_delete_own_business" on public.audit_logs;
create policy "audit_logs_delete_own_business"
on public.audit_logs
for delete
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = audit_logs.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);
