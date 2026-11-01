-- Avoid recursive evaluation between businesses and business_members policies.
drop policy if exists "business_members_select_own_business" on public.business_members;
create policy "business_members_select_own_business"
on public.business_members
for select
using (
  public.is_business_member(business_members.business_id, 'viewer')
  or public.is_platform_super_admin()
);

drop policy if exists "business_members_insert_own_business" on public.business_members;
create policy "business_members_insert_own_business"
on public.business_members
for insert
with check (
  public.is_business_admin(business_members.business_id)
  or public.is_platform_super_admin()
);

drop policy if exists "business_members_update_own_business" on public.business_members;
create policy "business_members_update_own_business"
on public.business_members
for update
using (
  public.is_business_admin(business_members.business_id)
  or public.is_platform_super_admin()
)
with check (
  public.is_business_admin(business_members.business_id)
  or public.is_platform_super_admin()
);

drop policy if exists "business_members_delete_own_business" on public.business_members;
create policy "business_members_delete_own_business"
on public.business_members
for delete
using (
  public.is_business_admin(business_members.business_id)
  or public.is_platform_super_admin()
);
