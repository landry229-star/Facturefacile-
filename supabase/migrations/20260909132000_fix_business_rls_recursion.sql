-- Keep membership checks behind SECURITY DEFINER helpers so table policies
-- never evaluate businesses and business_members recursively.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'business_members'
  loop
    execute format('drop policy if exists %I on public.business_members', policy_record.policyname);
  end loop;
end $$;

drop policy if exists "businesses_select_own_business" on public.businesses;
create policy "businesses_select_own_business"
on public.businesses
for select
using (
  owner_id = auth.uid()
  or public.is_business_member(businesses.id, 'viewer')
  or public.is_platform_super_admin()
);

create policy "business_members_select_own_business"
on public.business_members
for select
using (
  public.is_business_member(business_members.business_id, 'viewer')
  or public.is_platform_super_admin()
);

create policy "business_members_insert_own_business"
on public.business_members
for insert
with check (
  public.is_business_member(business_members.business_id, 'admin')
  or public.is_platform_super_admin()
);

create policy "business_members_update_own_business"
on public.business_members
for update
using (
  public.is_business_member(business_members.business_id, 'admin')
  or public.is_platform_super_admin()
)
with check (
  public.is_business_member(business_members.business_id, 'admin')
  or public.is_platform_super_admin()
);

create policy "business_members_delete_own_business"
on public.business_members
for delete
using (
  public.is_business_member(business_members.business_id, 'admin')
  or public.is_platform_super_admin()
);
