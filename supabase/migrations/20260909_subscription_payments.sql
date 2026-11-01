create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  plan text not null check (plan in ('starter', 'pro')),
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'XOF',
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'cancelled')),
  provider text not null default 'paydunya',
  provider_token text unique,
  provider_url text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.subscription_payments enable row level security;

drop policy if exists "business members read subscription payments" on public.subscription_payments;
create policy "business members read subscription payments" on public.subscription_payments
  for select using (public.is_business_member(business_id, 'viewer'));

drop trigger if exists audit_subscription_payments on public.subscription_payments;
create trigger audit_subscription_payments
after insert or update or delete on public.subscription_payments
for each row execute function public.write_audit_log();

create index if not exists subscription_payments_business_created_idx
  on public.subscription_payments (business_id, created_at desc);

delete from public.subscription_payments older
where older.status = 'pending'
  and exists (
    select 1
    from public.subscription_payments newer
    where newer.business_id = older.business_id
      and newer.plan = older.plan
      and newer.status = 'pending'
      and newer.created_at > older.created_at
  );

create unique index if not exists subscription_payments_pending_plan_idx
  on public.subscription_payments (business_id, plan)
  where status = 'pending';

create or replace function public.complete_subscription_payment(p_payment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row record;
  plan_limit integer;
begin
  select *
  into payment_row
  from public.subscription_payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Paiement introuvable.';
  end if;
  if payment_row.status = 'completed' then
    return false;
  end if;

  plan_limit := case payment_row.plan when 'starter' then 100 when 'pro' then 500 else 0 end;
  if plan_limit = 0 then
    raise exception 'Plan de paiement invalide.';
  end if;

  update public.business_subscriptions
  set plan = payment_row.plan,
      status = 'active',
      monthly_invoice_limit = plan_limit,
      expires_at = greatest(coalesce(expires_at, now()), now()) + interval '31 days',
      updated_at = now()
  where business_id = payment_row.business_id;

  if not found then
    raise exception 'Abonnement introuvable.';
  end if;

  update public.subscription_payments
  set status = 'completed', completed_at = now()
  where id = payment_row.id;
  return true;
end;
$$;

revoke all on function public.complete_subscription_payment(uuid) from public, anon, authenticated;
grant execute on function public.complete_subscription_payment(uuid) to service_role;

create or replace function public.update_business_subscription(
  p_business_id uuid,
  p_plan text,
  p_status text default 'active',
  p_expires_at timestamptz default null
)
returns public.business_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_subscription public.business_subscriptions;
begin
  if not public.is_business_owner(p_business_id) then
    raise exception 'Seul le propriétaire peut modifier l’abonnement.';
  end if;
  if p_plan <> 'free' then
    raise exception 'Les plans payants doivent être activés après un paiement PayDunya.';
  end if;
  if p_status not in ('active', 'cancelled') then
    raise exception 'Statut manuel invalide.';
  end if;

  update public.business_subscriptions
  set plan = 'free',
      status = p_status,
      monthly_invoice_limit = 20,
      expires_at = p_expires_at,
      updated_at = now()
  where business_id = p_business_id
  returning * into updated_subscription;

  if not found then
    raise exception 'Abonnement introuvable.';
  end if;
  return updated_subscription;
end;
$$;

revoke all on function public.update_business_subscription(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.update_business_subscription(uuid, text, text, timestamptz) to authenticated;
