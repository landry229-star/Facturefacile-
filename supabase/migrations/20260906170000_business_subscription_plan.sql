do $$
begin
  alter table public.business_subscriptions drop constraint if exists business_subscriptions_plan_check;
  alter table public.business_subscriptions add constraint business_subscriptions_plan_check check (plan in ('free', 'starter', 'pro', 'business'));
exception when undefined_table then null;
end $$;
