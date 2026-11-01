create or replace function public.list_public_subscription_plans()
returns table (
  id uuid,
  code text,
  name text,
  description text,
  price numeric,
  currency text,
  billing_period text,
  features jsonb,
  limits jsonb,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.code, p.name, p.description, p.price, p.currency,
    p.billing_period, p.features, p.limits, p.status
  from public.subscription_plans p
  where p.status = 'active'
  order by p.price, p.name
$$;

revoke all on function public.list_public_subscription_plans() from public;
grant execute on function public.list_public_subscription_plans() to anon, authenticated;
notify pgrst, 'reload schema';
