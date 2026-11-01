insert into public.business_subscriptions (business_id)
select b.id
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
  insert into public.business_subscriptions (business_id)
  values (new.id)
  on conflict (business_id) do nothing;
  return new;
end;
$$;

drop trigger if exists initialize_business_subscription on public.businesses;
create trigger initialize_business_subscription
after insert on public.businesses
for each row execute function public.initialize_business_subscription();

drop policy if exists "business members read subscriptions" on public.business_subscriptions;
create policy "business members read subscriptions" on public.business_subscriptions
  for select using (public.is_business_member(business_id, 'viewer'));

drop trigger if exists audit_business_subscriptions on public.business_subscriptions;
create trigger audit_business_subscriptions
after insert or update or delete on public.business_subscriptions
for each row execute function public.write_audit_log();

drop policy if exists "business members read businesses" on public.businesses;
create policy "business members read businesses" on public.businesses
  for select using (public.is_business_member(id, 'viewer'));

create or replace function public.is_business_owner(p_business_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.businesses
    where id = p_business_id and owner_id = auth.uid()
  );
$$;

revoke all on function public.is_business_owner(uuid) from public, anon;
grant execute on function public.is_business_owner(uuid) to authenticated;

create or replace function public.get_business_role(p_business_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select case
    when exists (
      select 1 from public.businesses
      where id = p_business_id and owner_id = auth.uid()
    ) then 'owner'
    else coalesce((
      select role
      from public.business_members
      where business_id = p_business_id and user_id = auth.uid()
    ), 'none')
  end;
$$;

revoke all on function public.get_business_role(uuid) from public, anon;
grant execute on function public.get_business_role(uuid) to authenticated;

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
  plan_limit integer;
  updated_subscription public.business_subscriptions;
begin
  if not public.is_business_owner(p_business_id) then
    raise exception 'Seul le propriétaire peut modifier l’abonnement.';
  end if;

  plan_limit := case p_plan
    when 'free' then 20
    when 'starter' then 100
    when 'pro' then 500
    else 0
  end;
  if plan_limit = 0 then
    raise exception 'Plan d’abonnement invalide.';
  end if;
  if p_status not in ('active', 'trialing', 'past_due', 'cancelled') then
    raise exception 'Statut d’abonnement invalide.';
  end if;

  insert into public.business_subscriptions (business_id, plan, status, monthly_invoice_limit, expires_at)
  values (p_business_id, p_plan, p_status, plan_limit, p_expires_at)
  on conflict (business_id) do update set
    plan = excluded.plan,
    status = excluded.status,
    monthly_invoice_limit = excluded.monthly_invoice_limit,
    expires_at = excluded.expires_at,
    updated_at = now()
  returning * into updated_subscription;

  return updated_subscription;
end;
$$;

revoke all on function public.update_business_subscription(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.update_business_subscription(uuid, text, text, timestamptz) to authenticated;

create or replace function public.create_invoice_with_lines(
  p_business_id uuid,
  p_client_id uuid,
  p_issue_date date,
  p_due_date date,
  p_discount numeric,
  p_tax_rate numeric,
  p_lines jsonb
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  line jsonb;
  product_row record;
  invoice_id uuid;
  invoice_number text;
  subscription_row record;
  invoice_count integer;
  month_start date := date_trunc('month', p_issue_date)::date;
  next_month date := (date_trunc('month', p_issue_date) + interval '1 month')::date;
  subtotal numeric := 0;
  discount_amount numeric;
  tax_amount numeric;
  total_amount numeric;
  quantity numeric;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;

  if not exists (
    select 1 from public.clients
    where id = p_client_id and business_id = p_business_id
  ) then
    raise exception 'Client non autorisé.';
  end if;

  select *
  into subscription_row
  from public.business_subscriptions
  where business_id = p_business_id
  for update;

  if not found then
    raise exception 'Abonnement non configuré pour cette entreprise.';
  end if;
  if subscription_row.status not in ('active', 'trialing') then
    raise exception 'Votre abonnement ne permet pas de créer des factures.';
  end if;
  if subscription_row.expires_at is not null and subscription_row.expires_at < now() then
    raise exception 'Votre abonnement a expiré.';
  end if;

  select count(*)::integer
  into invoice_count
  from public.invoices
  where business_id = p_business_id
    and issue_date >= month_start
    and issue_date < next_month
    and status <> 'CANCELLED';

  if invoice_count >= subscription_row.monthly_invoice_limit then
    raise exception 'La limite mensuelle de % factures est atteinte.', subscription_row.monthly_invoice_limit;
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'La facture doit contenir au moins une ligne.';
  end if;

  for line in select value from jsonb_array_elements(p_lines)
  loop
    quantity := (line->>'quantity')::numeric;
    if quantity <= 0 then
      raise exception 'La quantité doit être positive.';
    end if;

    select id, name, price, product_type, stock_quantity
    into product_row
    from public.products
    where id = (line->>'product_id')::uuid
      and business_id = p_business_id
    for update;

    if not found then
      raise exception 'Produit non autorisé.';
    end if;
    if product_row.product_type = 'product' and product_row.stock_quantity < quantity then
      raise exception 'Stock insuffisant pour %.', product_row.name;
    end if;
    subtotal := subtotal + product_row.price * quantity;
  end loop;

  discount_amount := least(greatest(coalesce(p_discount, 0), 0), subtotal);
  tax_amount := (subtotal - discount_amount) * greatest(coalesce(p_tax_rate, 0), 0) / 100;
  total_amount := subtotal - discount_amount + tax_amount;
  invoice_number := public.next_invoice_number(p_business_id, extract(year from p_issue_date)::integer);

  insert into public.invoices (
    business_id, client_id, invoice_number, issue_date, due_date,
    subtotal, discount, tax, total, status
  ) values (
    p_business_id, p_client_id, invoice_number, p_issue_date, p_due_date,
    subtotal, discount_amount, tax_amount, total_amount, 'DRAFT'
  ) returning id into invoice_id;

  for line in select value from jsonb_array_elements(p_lines)
  loop
    quantity := (line->>'quantity')::numeric;
    select id, name, price, product_type
    into product_row
    from public.products
    where id = (line->>'product_id')::uuid and business_id = p_business_id;

    insert into public.invoice_items (invoice_id, product_id, description, quantity, unit_price)
    values (invoice_id, product_row.id, product_row.name, quantity, product_row.price);

    if product_row.product_type = 'product' then
      update public.products
      set stock_quantity = stock_quantity - quantity, updated_at = now()
      where id = product_row.id and business_id = p_business_id;
      insert into public.stock_movements (business_id, product_id, quantity, movement_type, note)
      values (p_business_id, product_row.id, -quantity, 'out', format('Vente liée à %s', invoice_number));
    end if;
  end loop;

  return invoice_number;
end;
$$;

revoke all on function public.create_invoice_with_lines(uuid, uuid, date, date, numeric, numeric, jsonb) from public, anon;
grant execute on function public.create_invoice_with_lines(uuid, uuid, date, date, numeric, numeric, jsonb) to authenticated;
