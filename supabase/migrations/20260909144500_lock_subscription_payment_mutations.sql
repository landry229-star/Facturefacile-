-- Subscription payment records are immutable from the client.
-- Payment creation and status transitions are handled by trusted server-side
-- flows using service_role, while authenticated users retain read-only access.
drop policy if exists "subscription_payments_update_own_business" on public.subscription_payments;
drop policy if exists "subscription_payments_update_owner_only" on public.subscription_payments;
drop policy if exists "subscription_payments_insert_own_business" on public.subscription_payments;
drop policy if exists "subscription_payments_delete_own_business" on public.subscription_payments;
