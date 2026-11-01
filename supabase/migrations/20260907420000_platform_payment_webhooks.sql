alter table public.subscription_payments add column if not exists provider_confirmed_at timestamptz;
alter table public.subscription_payments add column if not exists webhook_event_id text;
create unique index if not exists subscription_payments_webhook_event_idx on public.subscription_payments (webhook_event_id) where webhook_event_id is not null;

alter table public.subscription_payments drop constraint if exists subscription_payments_status_check;
alter table public.subscription_payments add constraint subscription_payments_status_check check (status in ('pending', 'completed', 'failed', 'refunded', 'cancelled'));

drop function if exists public.list_platform_subscription_payments(integer, integer);
create or replace function public.list_platform_subscription_payments(p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, business_id uuid, business_name text, plan text, amount numeric, currency text, status text, provider text, provider_token text, internal_reference text, confirmation_data jsonb, provider_confirmed_at timestamptz, created_at timestamptz, completed_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('subscription_payments') then raise exception 'Accès administrateur requis.'; end if;
  return query select p.id, p.business_id, b.name, p.plan, p.amount, p.currency, p.status, p.provider, p.provider_token, p.internal_reference, p.confirmation_data, p.provider_confirmed_at, p.created_at, p.completed_at
    from public.subscription_payments p join public.businesses b on b.id = p.business_id
    where not exists (select 1 from public.platform_admins pa where pa.user_id = b.owner_id)
    order by p.created_at desc limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.process_subscription_payment_webhook(
  p_webhook_event_id text,
  p_provider_token text,
  p_status text,
  p_confirmation_data jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare payment_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'Cette confirmation est réservée au webhook du prestataire.'; end if;
  if nullif(trim(p_webhook_event_id), '') is null or nullif(trim(p_provider_token), '') is null then raise exception 'Références webhook obligatoires.'; end if;
  if p_status not in ('completed', 'failed', 'refunded', 'cancelled') then raise exception 'Statut prestataire invalide.'; end if;
  if exists (select 1 from public.subscription_payments where webhook_event_id = p_webhook_event_id) then
    select id into payment_id from public.subscription_payments where webhook_event_id = p_webhook_event_id;
    return payment_id;
  end if;
  update public.subscription_payments
  set status = p_status, provider_token = p_provider_token, provider_confirmed_at = now(),
      confirmation_data = coalesce(p_confirmation_data, '{}'::jsonb),
      completed_at = case when p_status = 'completed' then now() else completed_at end,
      webhook_event_id = p_webhook_event_id
  where provider_token = p_provider_token
  returning id into payment_id;
  if payment_id is null then raise exception 'Paiement introuvable pour cette référence prestataire.'; end if;
  return payment_id;
end;
$$;

revoke all on function public.process_subscription_payment_webhook(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.process_subscription_payment_webhook(text, text, text, jsonb) to service_role;
notify pgrst, 'reload schema';
