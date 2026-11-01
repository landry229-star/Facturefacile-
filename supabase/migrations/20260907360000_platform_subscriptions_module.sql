create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  price numeric(12,2) not null default 0 check (price >= 0),
  currency text not null default 'XOF',
  billing_period text not null default 'monthly',
  features jsonb not null default '[]'::jsonb,
  limits jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.subscription_plans (code, name, description, price, features, limits)
values
  ('free', 'FREE', 'Pour démarrer la facturation simplement.', 0, '["Factures standard"]', '{"users":1,"invoices":20,"clients":50,"products":50,"storage_mb":100}'),
  ('basic', 'BASIC', 'Les essentiels pour une petite entreprise.', 5000, '["Factures avancées","Exports","Rapports"]', '{"users":2,"invoices":100,"clients":250,"products":250,"storage_mb":1000}'),
  ('pro', 'PRO', 'Les outils avancés pour une équipe en croissance.', 15000, '["Équipe","Audit","Factures récurrentes","Tableau de bord avancé"]', '{"users":5,"invoices":500,"clients":1000,"products":1000,"storage_mb":5000}'),
  ('business', 'BUSINESS', 'Une offre complète pour les organisations structurées.', 35000, '["Toutes les fonctionnalités Pro","Support prioritaire"]', '{"users":25,"invoices":2000,"clients":10000,"products":10000,"storage_mb":20000}')
on conflict (code) do nothing;

create table if not exists public.subscription_plan_history (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.business_subscriptions(id) on delete cascade,
  from_plan text,
  to_plan text not null,
  from_status text,
  to_status text not null,
  reason text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists subscription_plan_history_subscription_idx
  on public.subscription_plan_history (subscription_id, created_at desc);

create or replace function public.record_subscription_plan_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' or old.plan is distinct from new.plan or old.status is distinct from new.status then
    insert into public.subscription_plan_history(subscription_id, from_plan, to_plan, from_status, to_status, changed_by, reason)
    values (new.id, case when tg_op = 'INSERT' then null else old.plan end, new.plan,
      case when tg_op = 'INSERT' then null else old.status end, new.status, auth.uid(),
      case when tg_op = 'INSERT' then 'Création de l’abonnement' else 'Mise à jour administrative' end);
  end if;
  return new;
end;
$$;

drop trigger if exists subscription_plan_history_trigger on public.business_subscriptions;
create trigger subscription_plan_history_trigger
after insert or update of plan, status on public.business_subscriptions
for each row execute function public.record_subscription_plan_change();

alter table public.subscription_plans enable row level security;
alter table public.subscription_plan_history enable row level security;

create or replace function public.list_platform_subscription_plans()
returns table (id uuid, code text, name text, description text, price numeric, currency text, billing_period text, features jsonb, limits jsonb, status text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('subscriptions') then raise exception 'Accès administrateur requis.'; end if;
  return query select p.id, p.code, p.name, p.description, p.price, p.currency, p.billing_period, p.features, p.limits, p.status
  from public.subscription_plans p order by p.price, p.name;
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
  from public.business_subscriptions s join public.businesses b on b.id = s.business_id where s.id = p_subscription_id;
  if result is null then raise exception 'Abonnement introuvable.'; end if;
  return result;
end;
$$;

revoke all on function public.list_platform_subscription_plans() from public, anon;
grant execute on function public.list_platform_subscription_plans() to authenticated;
revoke all on function public.get_platform_subscription_detail(uuid) from public, anon;
grant execute on function public.get_platform_subscription_detail(uuid) to authenticated;
notify pgrst, 'reload schema';
