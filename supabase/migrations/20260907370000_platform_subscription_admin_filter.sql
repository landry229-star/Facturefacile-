create or replace function public.list_platform_admin_subscriptions(p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, business_id uuid, business_name text, plan text, status text, monthly_invoice_limit integer, expires_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('subscriptions') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select s.id, s.business_id, b.name, s.plan, s.status, s.monthly_invoice_limit, s.expires_at, s.created_at
    from public.business_subscriptions s
    join public.businesses b on b.id = s.business_id
    where not exists (select 1 from public.platform_admins pa where pa.user_id = b.owner_id)
    order by s.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.list_platform_subscription_payments(p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, business_id uuid, business_name text, plan text, amount numeric, currency text, status text, provider text, created_at timestamptz, completed_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('subscription_payments') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select p.id, p.business_id, b.name, p.plan, p.amount, p.currency, p.status, p.provider, p.created_at, p.completed_at
    from public.subscription_payments p
    join public.businesses b on b.id = p.business_id
    where not exists (select 1 from public.platform_admins pa where pa.user_id = b.owner_id)
    order by p.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.get_platform_subscription_detail(p_subscription_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare result jsonb;
begin
  if not public.has_platform_admin_permission('subscriptions') then raise exception 'Accès administrateur requis.'; end if;
  select jsonb_build_object(
    'id', s.id, 'business_id', s.business_id, 'business_name', b.name, 'plan', s.plan, 'status', s.status,
    'monthly_invoice_limit', s.monthly_invoice_limit, 'expires_at', s.expires_at, 'renewal_at', s.expires_at, 'created_at', s.created_at,
    'history', coalesce((select jsonb_agg(h order by h.created_at desc) from public.subscription_plan_history h where h.subscription_id = s.id), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'business_id', p.business_id, 'business_name', b.name, 'plan', p.plan, 'amount', p.amount, 'currency', p.currency, 'status', p.status, 'provider', p.provider, 'created_at', p.created_at, 'completed_at', p.completed_at) order by p.created_at desc) from public.subscription_payments p where p.business_id = s.business_id), '[]'::jsonb)
  ) into result
  from public.business_subscriptions s
  join public.businesses b on b.id = s.business_id
  where s.id = p_subscription_id
    and not exists (select 1 from public.platform_admins pa where pa.user_id = b.owner_id);
  if result is null then raise exception 'Abonnement introuvable.'; end if;
  return result;
end;
$$;

notify pgrst, 'reload schema';
