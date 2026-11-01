alter table public.subscription_payments
  alter column provider set default 'kkiapay';

update public.subscription_payments
set status = 'cancelled'
where provider = 'paydunya'
  and status = 'pending';

update public.platform_settings
set value = 'KKiaPay',
    updated_at = now()
where key = 'payment_provider';

update public.platform_integrations
set name = 'KKiaPay',
    status = 'attention'
where name = 'PayDunya'
  and not exists (
    select 1
    from public.platform_integrations
    where name = 'KKiaPay'
  );

drop function if exists public.complete_subscription_payment(uuid);
drop function if exists public.process_subscription_payment_webhook(text, text, text, jsonb);

create or replace function public.complete_kkiapay_subscription_payment(
  p_payment_id uuid,
  p_transaction_id text,
  p_confirmed_amount numeric,
  p_confirmation_data jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row public.subscription_payments%rowtype;
  plan_limit integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Cette confirmation est réservée au serveur de paiement.';
  end if;
  if nullif(trim(p_transaction_id), '') is null then
    raise exception 'La référence KKiaPay est obligatoire.';
  end if;

  select *
  into payment_row
  from public.subscription_payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Paiement introuvable.';
  end if;
  if payment_row.provider <> 'kkiapay' then
    raise exception 'Le paiement ne provient pas de KKiaPay.';
  end if;
  if payment_row.status = 'completed' then
    if payment_row.provider_token = p_transaction_id then
      return false;
    end if;
    raise exception 'Ce paiement a déjà été confirmé avec une autre transaction.';
  end if;
  if payment_row.status <> 'pending' then
    raise exception 'Ce paiement n’est plus en attente.';
  end if;
  if payment_row.provider_token is not null and payment_row.provider_token <> p_transaction_id then
    raise exception 'Une autre transaction est déjà associée à ce paiement.';
  end if;
  if p_confirmed_amount is distinct from payment_row.amount then
    raise exception 'Le montant confirmé ne correspond pas au paiement.';
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
  set status = 'completed',
      provider_token = p_transaction_id,
      webhook_event_id = p_transaction_id,
      provider_confirmed_at = now(),
      confirmation_data = coalesce(p_confirmation_data, '{}'::jsonb),
      completed_at = now()
  where id = payment_row.id;

  return true;
end;
$$;

revoke all on function public.complete_kkiapay_subscription_payment(uuid, text, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.complete_kkiapay_subscription_payment(uuid, text, numeric, jsonb) to service_role;

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
    raise exception 'Les plans payants doivent être activés après un paiement KKiaPay.';
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

notify pgrst, 'reload schema';
