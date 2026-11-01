alter table public.business_subscriptions
  drop constraint if exists business_subscriptions_plan_check,
  drop constraint if exists business_subscriptions_status_check;

alter table public.business_subscriptions
  add constraint business_subscriptions_plan_check check (plan in ('free', 'basic', 'starter', 'pro', 'business')),
  add constraint business_subscriptions_status_check check (status in ('active', 'pending', 'trialing', 'past_due', 'expired', 'cancelled', 'suspended'));

alter table public.subscription_payments
  drop constraint if exists subscription_payments_plan_check,
  drop constraint if exists subscription_payments_status_check;

alter table public.subscription_payments
  add constraint subscription_payments_plan_check check (plan in ('basic', 'starter', 'pro', 'business')),
  add constraint subscription_payments_status_check check (status in ('pending', 'completed', 'failed', 'cancelled'));

create or replace function public.ensure_subscription_expiration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.plan = 'free' then
    new.expires_at := null;
  elsif new.expires_at is null then
    new.expires_at := coalesce(new.created_at, now()) + interval '31 days';
  end if;
  return new;
end;
$$;

update public.business_subscriptions
set status = 'expired', updated_at = now()
where expires_at is not null and expires_at <= now()
  and status in ('active', 'trialing', 'past_due');

notify pgrst, 'reload schema';
