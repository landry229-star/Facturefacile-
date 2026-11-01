insert into public.business_subscriptions (business_id, plan, status, monthly_invoice_limit)
select b.id, 'free', 'active', 20
from public.businesses b
where not exists (
  select 1
  from public.business_subscriptions s
  where s.business_id = b.id
);

create or replace function public.initialize_business_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.business_subscriptions (business_id, plan, status, monthly_invoice_limit)
  values (new.id, 'free', 'active', 20)
  on conflict (business_id) do nothing;
  return new;
end;
$$;
