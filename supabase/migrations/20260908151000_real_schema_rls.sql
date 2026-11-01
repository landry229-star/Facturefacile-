-- ============================================================
-- FactureFacile - RLS exact sur le schéma réel du projet
-- ============================================================
-- Ce fichier cible les tables réellement présentes dans le repo
-- et sécurise l'accès par entreprise + rôle plateforme.
-- ============================================================

create or replace function public.is_business_member(p_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and b.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.business_members bm
    where bm.business_id = p_business_id
      and bm.user_id = auth.uid()
  );
$$;

create or replace function public.is_business_admin(p_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and b.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.business_members bm
    where bm.business_id = p_business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  );
$$;

create or replace function public.is_business_owner(p_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and b.owner_id = auth.uid()
  );
$$;

create or replace function public.is_platform_super_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = auth.uid()
      and pa.role = 'super_admin'
  );
$$;

-- ============================================================
-- Activation RLS sur les tables réelles du projet
-- ============================================================
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'businesses',
    'clients',
    'products',
    'stock_movements',
    'invoices',
    'invoice_items',
    'payments',
    'expenses',
    'business_members',
    'business_invitations',
    'business_subscriptions',
    'subscription_payments',
    'audit_logs',
    'recurring_invoices',
    'recurring_invoice_runs',
    'invoice_counters',
    'invoice_reminders',
    'platform_admins',
    'platform_notifications',
    'platform_notification_preferences',
    'platform_notification_deliveries',
    'support_tickets',
    'support_ticket_messages',
    'platform_audit_logs',
    'platform_incidents',
    'platform_integrations',
    'platform_content',
    'platform_settings',
    'subscription_plans',
    'subscription_plan_history'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);
    end if;
  end loop;
end $$;

-- ============================================================
-- Table: businesses
-- ============================================================
drop policy if exists "businesses_select_own_business" on public.businesses;
create policy "businesses_select_own_business"
on public.businesses
for select
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.business_members bm where bm.business_id = businesses.id and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "businesses_update_own_business" on public.businesses;
create policy "businesses_update_own_business"
on public.businesses
for update
using (
  owner_id = auth.uid()
  or public.is_platform_super_admin()
)
with check (
  owner_id = auth.uid()
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: business_members
-- ============================================================
drop policy if exists "business_members_select_own_business" on public.business_members;
create policy "business_members_select_own_business"
on public.business_members
for select
using (
  public.is_business_member(business_members.business_id)
  or public.is_platform_super_admin()
);

drop policy if exists "business_members_insert_own_business" on public.business_members;
create policy "business_members_insert_own_business"
on public.business_members
for insert
with check (
  public.is_business_admin(business_members.business_id)
  or public.is_platform_super_admin()
);

drop policy if exists "business_members_update_own_business" on public.business_members;
create policy "business_members_update_own_business"
on public.business_members
for update
using (
  public.is_business_admin(business_members.business_id)
  or public.is_platform_super_admin()
)
with check (
  public.is_business_admin(business_members.business_id)
  or public.is_platform_super_admin()
);

drop policy if exists "business_members_delete_own_business" on public.business_members;
create policy "business_members_delete_own_business"
on public.business_members
for delete
using (
  public.is_business_admin(business_members.business_id)
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: business_invitations
-- ============================================================
drop policy if exists "business_invitations_select_own_business" on public.business_invitations;
create policy "business_invitations_select_own_business"
on public.business_invitations
for select
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = business_invitations.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "business_invitations_insert_own_business" on public.business_invitations;
create policy "business_invitations_insert_own_business"
on public.business_invitations
for insert
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = business_invitations.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "business_invitations_update_own_business" on public.business_invitations;
create policy "business_invitations_update_own_business"
on public.business_invitations
for update
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = business_invitations.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = business_invitations.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: clients
-- ============================================================
drop policy if exists "clients_select_own_business" on public.clients;
create policy "clients_select_own_business"
on public.clients
for select
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = clients.business_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "clients_insert_own_business" on public.clients;
create policy "clients_insert_own_business"
on public.clients
for insert
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = clients.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin', 'member')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "clients_update_own_business" on public.clients;
create policy "clients_update_own_business"
on public.clients
for update
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = clients.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = clients.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "clients_delete_own_business" on public.clients;
create policy "clients_delete_own_business"
on public.clients
for delete
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = clients.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: products
-- ============================================================
drop policy if exists "products_select_own_business" on public.products;
create policy "products_select_own_business"
on public.products
for select
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = products.business_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "products_insert_own_business" on public.products;
create policy "products_insert_own_business"
on public.products
for insert
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = products.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin', 'member')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "products_update_own_business" on public.products;
create policy "products_update_own_business"
on public.products
for update
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = products.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = products.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "products_delete_own_business" on public.products;
create policy "products_delete_own_business"
on public.products
for delete
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = products.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: stock_movements
-- ============================================================
drop policy if exists "stock_movements_select_own_business" on public.stock_movements;
create policy "stock_movements_select_own_business"
on public.stock_movements
for select
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = stock_movements.business_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "stock_movements_insert_own_business" on public.stock_movements;
create policy "stock_movements_insert_own_business"
on public.stock_movements
for insert
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = stock_movements.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin', 'member')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "stock_movements_update_own_business" on public.stock_movements;
create policy "stock_movements_update_own_business"
on public.stock_movements
for update
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = stock_movements.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = stock_movements.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: invoices
-- ============================================================
drop policy if exists "invoices_select_own_business" on public.invoices;
create policy "invoices_select_own_business"
on public.invoices
for select
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = invoices.business_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "invoices_insert_own_business" on public.invoices;
create policy "invoices_insert_own_business"
on public.invoices
for insert
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = invoices.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin', 'member')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "invoices_update_own_business" on public.invoices;
create policy "invoices_update_own_business"
on public.invoices
for update
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = invoices.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = invoices.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "invoices_delete_own_business" on public.invoices;
create policy "invoices_delete_own_business"
on public.invoices
for delete
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = invoices.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: invoice_items
-- ============================================================
drop policy if exists "invoice_items_select_own_business" on public.invoice_items;
create policy "invoice_items_select_own_business"
on public.invoice_items
for select
using (
  exists (
    select 1
    from public.invoices inv
    join public.business_members bm on bm.business_id = inv.business_id
    where inv.id = invoice_items.invoice_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "invoice_items_insert_own_business" on public.invoice_items;
create policy "invoice_items_insert_own_business"
on public.invoice_items
for insert
with check (
  exists (
    select 1
    from public.invoices inv
    join public.business_members bm on bm.business_id = inv.business_id
    where inv.id = invoice_items.invoice_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin', 'member')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "invoice_items_update_own_business" on public.invoice_items;
create policy "invoice_items_update_own_business"
on public.invoice_items
for update
using (
  exists (
    select 1
    from public.invoices inv
    join public.business_members bm on bm.business_id = inv.business_id
    where inv.id = invoice_items.invoice_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
)
with check (
  exists (
    select 1
    from public.invoices inv
    join public.business_members bm on bm.business_id = inv.business_id
    where inv.id = invoice_items.invoice_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: payments
-- ============================================================
drop policy if exists "payments_select_own_business" on public.payments;
create policy "payments_select_own_business"
on public.payments
for select
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = payments.business_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "payments_insert_own_business" on public.payments;
create policy "payments_insert_own_business"
on public.payments
for insert
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = payments.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin', 'member')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "payments_update_own_business" on public.payments;
create policy "payments_update_own_business"
on public.payments
for update
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = payments.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = payments.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: expenses
-- ============================================================
drop policy if exists "expenses_select_own_business" on public.expenses;
create policy "expenses_select_own_business"
on public.expenses
for select
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = expenses.business_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "expenses_insert_own_business" on public.expenses;
create policy "expenses_insert_own_business"
on public.expenses
for insert
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = expenses.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin', 'member')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "expenses_update_own_business" on public.expenses;
create policy "expenses_update_own_business"
on public.expenses
for update
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = expenses.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = expenses.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "expenses_delete_own_business" on public.expenses;
create policy "expenses_delete_own_business"
on public.expenses
for delete
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = expenses.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: business_subscriptions
-- ============================================================
drop policy if exists "business_subscriptions_select_own_business" on public.business_subscriptions;
create policy "business_subscriptions_select_own_business"
on public.business_subscriptions
for select
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = business_subscriptions.business_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "business_subscriptions_update_own_business" on public.business_subscriptions;
create policy "business_subscriptions_update_own_business"
on public.business_subscriptions
for update
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = business_subscriptions.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = business_subscriptions.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: subscription_payments
-- ============================================================
drop policy if exists "subscription_payments_select_own_business" on public.subscription_payments;
create policy "subscription_payments_select_own_business"
on public.subscription_payments
for select
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = subscription_payments.business_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "subscription_payments_update_own_business" on public.subscription_payments;
create policy "subscription_payments_update_own_business"
on public.subscription_payments
for update
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = subscription_payments.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = subscription_payments.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: audit_logs
-- ============================================================
drop policy if exists "audit_logs_select_own_business" on public.audit_logs;
create policy "audit_logs_select_own_business"
on public.audit_logs
for select
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = audit_logs.business_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "audit_logs_insert_own_business" on public.audit_logs;
create policy "audit_logs_insert_own_business"
on public.audit_logs
for insert
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = audit_logs.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: recurring_invoices
-- ============================================================
drop policy if exists "recurring_invoices_select_own_business" on public.recurring_invoices;
create policy "recurring_invoices_select_own_business"
on public.recurring_invoices
for select
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = recurring_invoices.business_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "recurring_invoices_update_own_business" on public.recurring_invoices;
create policy "recurring_invoices_update_own_business"
on public.recurring_invoices
for update
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = recurring_invoices.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = recurring_invoices.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: recurring_invoice_runs
-- ============================================================
drop policy if exists "recurring_invoice_runs_select_own_business" on public.recurring_invoice_runs;
create policy "recurring_invoice_runs_select_own_business"
on public.recurring_invoice_runs
for select
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = recurring_invoice_runs.business_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: invoice_counters
-- ============================================================
drop policy if exists "invoice_counters_select_own_business" on public.invoice_counters;
create policy "invoice_counters_select_own_business"
on public.invoice_counters
for select
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = invoice_counters.business_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "invoice_counters_update_own_business" on public.invoice_counters;
create policy "invoice_counters_update_own_business"
on public.invoice_counters
for update
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = invoice_counters.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = invoice_counters.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Table: invoice_reminders
-- ============================================================
drop policy if exists "invoice_reminders_select_own_business" on public.invoice_reminders;
create policy "invoice_reminders_select_own_business"
on public.invoice_reminders
for select
using (
  exists (
    select 1
    from public.invoices inv
    join public.business_members bm on bm.business_id = inv.business_id
    where inv.id = invoice_reminders.invoice_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "invoice_reminders_update_own_business" on public.invoice_reminders;
create policy "invoice_reminders_update_own_business"
on public.invoice_reminders
for update
using (
  exists (
    select 1
    from public.invoices inv
    join public.business_members bm on bm.business_id = inv.business_id
    where inv.id = invoice_reminders.invoice_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
)
with check (
  exists (
    select 1
    from public.invoices inv
    join public.business_members bm on bm.business_id = inv.business_id
    where inv.id = invoice_reminders.invoice_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

-- ============================================================
-- Platform / admin tables
-- ============================================================
drop policy if exists "platform_admins_only_super_admin" on public.platform_admins;
create policy "platform_admins_only_super_admin"
on public.platform_admins
for all
using (public.is_platform_super_admin())
with check (public.is_platform_super_admin());

drop policy if exists "support_tickets_select_own_business" on public.support_tickets;
create policy "support_tickets_select_own_business"
on public.support_tickets
for select
using (
  business_id is null and auth.uid() is not null
  or exists (
    select 1 from public.business_members bm
    where bm.business_id = support_tickets.business_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "support_tickets_insert_own_business" on public.support_tickets;
create policy "support_tickets_insert_own_business"
on public.support_tickets
for insert
with check (
  (business_id is not null and exists (
    select 1 from public.business_members bm
    where bm.business_id = support_tickets.business_id
      and bm.user_id = auth.uid()
  ))
  or public.is_platform_super_admin()
);

drop policy if exists "support_tickets_update_own_business" on public.support_tickets;
create policy "support_tickets_update_own_business"
on public.support_tickets
for update
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = support_tickets.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = support_tickets.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "support_ticket_messages_select_own_business" on public.support_ticket_messages;
create policy "support_ticket_messages_select_own_business"
on public.support_ticket_messages
for select
using (
  exists (
    select 1
    from public.support_tickets t
    join public.business_members bm on bm.business_id = t.business_id
    where t.id = support_ticket_messages.ticket_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "support_ticket_messages_insert_own_business" on public.support_ticket_messages;
create policy "support_ticket_messages_insert_own_business"
on public.support_ticket_messages
for insert
with check (
  exists (
    select 1
    from public.support_tickets t
    join public.business_members bm on bm.business_id = t.business_id
    where t.id = support_ticket_messages.ticket_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'admin', 'member')
  )
  or public.is_platform_super_admin()
);

drop policy if exists "platform_notifications_select_own_user" on public.platform_notifications;
create policy "platform_notifications_select_own_user"
on public.platform_notifications
for select
using (
  recipient_user_id = auth.uid()
  or recipient_role is null
  or public.is_platform_super_admin()
);

drop policy if exists "platform_notifications_update_own_user" on public.platform_notifications;
create policy "platform_notifications_update_own_user"
on public.platform_notifications
for update
using (
  recipient_user_id = auth.uid()
  or public.is_platform_super_admin()
)
with check (
  recipient_user_id = auth.uid()
  or public.is_platform_super_admin()
);

drop policy if exists "platform_notification_preferences_select_own_user" on public.platform_notification_preferences;
create policy "platform_notification_preferences_select_own_user"
on public.platform_notification_preferences
for select
using (user_id = auth.uid() or public.is_platform_super_admin());

drop policy if exists "platform_notification_preferences_update_own_user" on public.platform_notification_preferences;
create policy "platform_notification_preferences_update_own_user"
on public.platform_notification_preferences
for update
using (user_id = auth.uid() or public.is_platform_super_admin())
with check (user_id = auth.uid() or public.is_platform_super_admin());

drop policy if exists "platform_notification_deliveries_select_own_user" on public.platform_notification_deliveries;
create policy "platform_notification_deliveries_select_own_user"
on public.platform_notification_deliveries
for select
using (user_id = auth.uid() or public.is_platform_super_admin());

drop policy if exists "platform_notification_deliveries_update_own_user" on public.platform_notification_deliveries;
create policy "platform_notification_deliveries_update_own_user"
on public.platform_notification_deliveries
for update
using (user_id = auth.uid() or public.is_platform_super_admin())
with check (user_id = auth.uid() or public.is_platform_super_admin());

drop policy if exists "platform_audit_logs_super_admin_only" on public.platform_audit_logs;
create policy "platform_audit_logs_super_admin_only"
on public.platform_audit_logs
for all
using (public.is_platform_super_admin())
with check (public.is_platform_super_admin());

drop policy if exists "platform_incidents_super_admin_only" on public.platform_incidents;
create policy "platform_incidents_super_admin_only"
on public.platform_incidents
for all
using (public.is_platform_super_admin())
with check (public.is_platform_super_admin());

drop policy if exists "platform_integrations_super_admin_only" on public.platform_integrations;
create policy "platform_integrations_super_admin_only"
on public.platform_integrations
for all
using (public.is_platform_super_admin())
with check (public.is_platform_super_admin());

drop policy if exists "platform_content_super_admin_only" on public.platform_content;
create policy "platform_content_super_admin_only"
on public.platform_content
for all
using (public.is_platform_super_admin())
with check (public.is_platform_super_admin());

drop policy if exists "platform_settings_super_admin_only" on public.platform_settings;
create policy "platform_settings_super_admin_only"
on public.platform_settings
for all
using (public.is_platform_super_admin())
with check (public.is_platform_super_admin());

drop policy if exists "subscription_plans_super_admin_only" on public.subscription_plans;
create policy "subscription_plans_super_admin_only"
on public.subscription_plans
for all
using (public.is_platform_super_admin())
with check (public.is_platform_super_admin());

drop policy if exists "subscription_plan_history_super_admin_only" on public.subscription_plan_history;
create policy "subscription_plan_history_super_admin_only"
on public.subscription_plan_history
for all
using (public.is_platform_super_admin())
with check (public.is_platform_super_admin());

-- ============================================================
-- Fin : vérification rapide
-- ============================================================
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'businesses', 'clients', 'products', 'stock_movements', 'invoices', 'invoice_items', 'payments', 'expenses',
    'business_members', 'business_invitations', 'business_subscriptions', 'subscription_payments', 'audit_logs',
    'recurring_invoices', 'recurring_invoice_runs', 'invoice_counters', 'invoice_reminders',
    'platform_admins', 'platform_notifications', 'platform_notification_preferences', 'platform_notification_deliveries',
    'support_tickets', 'support_ticket_messages', 'platform_audit_logs', 'platform_incidents', 'platform_integrations',
    'platform_content', 'platform_settings', 'subscription_plans', 'subscription_plan_history'
  )
order by tablename;
