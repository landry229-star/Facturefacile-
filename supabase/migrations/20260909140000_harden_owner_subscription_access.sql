-- Only the business owner or a trusted platform administrator may mutate a subscription.
drop policy if exists "business_subscriptions_update_own_business" on public.business_subscriptions;
create policy "business_subscriptions_update_owner_only"
on public.business_subscriptions
for update
using (
  public.is_business_owner(business_subscriptions.business_id)
  or public.is_platform_super_admin()
)
with check (
  public.is_business_owner(business_subscriptions.business_id)
  or public.is_platform_super_admin()
);
