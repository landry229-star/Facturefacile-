create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  email text,
  phone text,
  address text,
  tax_id text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists suppliers_business_name_uidx
  on public.suppliers (business_id, lower(trim(name)));

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  purchase_number text not null,
  supplier_invoice_number text,
  purchase_date date not null,
  due_date date,
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  tax numeric(12, 2) not null default 0 check (tax >= 0),
  total numeric(12, 2) not null check (total >= 0),
  paid_amount numeric(12, 2) not null default 0 check (paid_amount >= 0 and paid_amount <= total),
  status text not null default 'UNPAID'
    check (status in ('UNPAID', 'PARTIALLY_PAID', 'PAID')),
  notes text,
  request_id uuid not null,
  request_fingerprint text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, purchase_number),
  unique (business_id, request_id),
  check (due_date is null or due_date >= purchase_date),
  check (
    (paid_amount = 0 and status = 'UNPAID')
    or (paid_amount > 0 and paid_amount < total and status = 'PARTIALLY_PAID')
    or (paid_amount = total and status = 'PAID')
  )
);

create unique index if not exists purchases_supplier_invoice_uidx
  on public.purchases (business_id, supplier_id, lower(trim(supplier_invoice_number)))
  where supplier_invoice_number is not null and length(trim(supplier_invoice_number)) > 0;
create index if not exists purchases_business_due_date_idx
  on public.purchases (business_id, due_date)
  where status <> 'PAID';

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  description text not null check (length(trim(description)) > 0),
  quantity numeric(12, 2) not null check (quantity > 0),
  unit_cost numeric(12, 2) not null check (unit_cost >= 0),
  line_total numeric(12, 2) generated always as (round(quantity * unit_cost, 2)) stored
);

create table if not exists public.purchase_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  purchase_id uuid not null references public.purchases(id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  paid_at date not null default current_date,
  payment_method text not null
    check (payment_method in ('cash', 'mobile_money', 'bank_transfer', 'card', 'check', 'other')),
  reference text,
  request_id uuid not null,
  request_fingerprint text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (business_id, request_id)
);

alter table public.suppliers enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.purchase_payments enable row level security;

drop policy if exists "supplier members read suppliers" on public.suppliers;
create policy "supplier members read suppliers" on public.suppliers
  for select to authenticated using (public.is_business_member(business_id, 'viewer'));
drop policy if exists "supplier members create suppliers" on public.suppliers;
create policy "supplier members create suppliers" on public.suppliers
  for insert to authenticated with check (public.is_business_member(business_id, 'member'));
drop policy if exists "supplier members update suppliers" on public.suppliers;
create policy "supplier members update suppliers" on public.suppliers
  for update to authenticated
  using (public.is_business_member(business_id, 'member'))
  with check (public.is_business_member(business_id, 'member'));

drop policy if exists "purchase members read purchases" on public.purchases;
create policy "purchase members read purchases" on public.purchases
  for select to authenticated using (public.is_business_member(business_id, 'viewer'));
drop policy if exists "purchase members read purchase items" on public.purchase_items;
create policy "purchase members read purchase items" on public.purchase_items
  for select to authenticated using (exists (
    select 1 from public.purchases p
    where p.id = purchase_items.purchase_id
      and public.is_business_member(p.business_id, 'viewer')
  ));
drop policy if exists "purchase members read purchase payments" on public.purchase_payments;
create policy "purchase members read purchase payments" on public.purchase_payments
  for select to authenticated using (public.is_business_member(business_id, 'viewer'));

revoke all on public.suppliers, public.purchases, public.purchase_items, public.purchase_payments
  from anon, authenticated;
grant select, insert, update on public.suppliers to authenticated;
revoke update on public.suppliers from authenticated;
grant update (name, email, phone, address, tax_id, notes, active, updated_at)
  on public.suppliers to authenticated;
grant select on public.purchases, public.purchase_items, public.purchase_payments to authenticated;

create or replace function public.create_purchase_with_lines(
  p_business_id uuid,
  p_supplier_id uuid,
  p_supplier_invoice_number text,
  p_purchase_date date,
  p_due_date date,
  p_tax_rate numeric,
  p_notes text,
  p_lines jsonb,
  p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  line jsonb;
  purchase_row public.purchases%rowtype;
  product_row public.products%rowtype;
  purchase_id uuid;
  purchase_number text;
  sequence_number integer;
  quantity numeric;
  unit_cost numeric;
  subtotal_amount numeric := 0;
  tax_amount numeric;
  total_amount numeric;
  request_hash text;
  normalized_supplier_invoice text := nullif(trim(p_supplier_invoice_number), '');
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;
  if p_request_id is null then raise exception 'La clé de création est obligatoire.'; end if;
  if p_purchase_date is null or (p_due_date is not null and p_due_date < p_purchase_date) then
    raise exception 'La date d’achat ou l’échéance est invalide.';
  end if;
  if p_tax_rate is null or p_tax_rate < 0 or p_tax_rate > 100 then
    raise exception 'Le taux de taxe doit être compris entre 0 et 100 %%.';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Les lignes de l’achat sont invalides.';
  end if;
  if jsonb_array_length(p_lines) = 0 then raise exception 'L’achat doit contenir au moins une ligne.'; end if;
  if not exists (
    select 1 from public.suppliers
    where id = p_supplier_id and business_id = p_business_id and active
  ) then raise exception 'Fournisseur inactif ou non autorisé.'; end if;

  request_hash := md5(jsonb_build_object(
    'supplier_id', p_supplier_id,
    'supplier_invoice_number', normalized_supplier_invoice,
    'purchase_date', p_purchase_date,
    'due_date', p_due_date,
    'tax_rate', p_tax_rate,
    'notes', nullif(trim(p_notes), ''),
    'lines', p_lines
  )::text);
  perform pg_advisory_xact_lock(
    hashtextextended(p_business_id::text || ':purchase:' || p_request_id::text, 0)
  );
  select * into purchase_row from public.purchases
  where business_id = p_business_id and request_id = p_request_id;
  if found then
    if purchase_row.request_fingerprint <> request_hash then
      raise exception 'Cette clé de création a déjà été utilisée pour un autre achat.';
    end if;
    return purchase_row.id;
  end if;

  for line in select value from jsonb_array_elements(p_lines)
  loop
    if nullif(line->>'quantity', '') is null or nullif(line->>'unit_cost', '') is null then
      raise exception 'Chaque ligne doit avoir une quantité et un coût unitaire.';
    end if;
    quantity := (line->>'quantity')::numeric;
    unit_cost := (line->>'unit_cost')::numeric;
    if quantity <= 0 or unit_cost < 0 then raise exception 'La quantité ou le coût unitaire est invalide.'; end if;
    if length(trim(coalesce(line->>'description', ''))) = 0 then
      raise exception 'La désignation de chaque ligne est obligatoire.';
    end if;
    subtotal_amount := subtotal_amount + round(quantity * unit_cost, 2);
    if nullif(line->>'product_id', '') is not null and not exists (
      select 1 from public.products
      where id = (line->>'product_id')::uuid
        and business_id = p_business_id
        and product_type = 'product'
    ) then raise exception 'Un produit de la facture fournisseur est invalide.'; end if;
  end loop;

  for product_row in
    select p.* from public.products p
    where p.business_id = p_business_id
      and p.id in (
        select (value->>'product_id')::uuid
        from jsonb_array_elements(p_lines)
        where nullif(value->>'product_id', '') is not null
      )
    order by p.id
    for update
  loop
    null;
  end loop;

  perform 1 from public.businesses where id = p_business_id for update;
  select coalesce(max(right(purchase_number, 5)::integer), 0) + 1
    into sequence_number
    from public.purchases
    where business_id = p_business_id
      and purchase_number like 'ACH-' || extract(year from p_purchase_date)::integer::text || '-%';
  purchase_number := 'ACH-' || extract(year from p_purchase_date)::integer::text || '-' || lpad(sequence_number::text, 5, '0');
  tax_amount := round(subtotal_amount * p_tax_rate / 100, 2);
  total_amount := subtotal_amount + tax_amount;
  if total_amount <= 0 then raise exception 'Le montant total de l’achat doit être supérieur à zéro.'; end if;

  insert into public.purchases (
    business_id, supplier_id, purchase_number, supplier_invoice_number,
    purchase_date, due_date, subtotal, tax, total, notes, request_id,
    request_fingerprint, created_by
  ) values (
    p_business_id, p_supplier_id, purchase_number, normalized_supplier_invoice,
    p_purchase_date, p_due_date, subtotal_amount, tax_amount, total_amount,
    nullif(trim(p_notes), ''), p_request_id, request_hash, auth.uid()
  ) returning id into purchase_id;

  for line in select value from jsonb_array_elements(p_lines)
  loop
    quantity := (line->>'quantity')::numeric;
    unit_cost := (line->>'unit_cost')::numeric;
    insert into public.purchase_items (purchase_id, product_id, description, quantity, unit_cost)
    values (
      purchase_id,
      nullif(line->>'product_id', '')::uuid,
      trim(line->>'description'),
      quantity,
      unit_cost
    );

    if nullif(line->>'product_id', '') is not null then
      select * into product_row
        from public.products
        where id = (line->>'product_id')::uuid and business_id = p_business_id;
      update public.products
        set stock_quantity = product_row.stock_quantity + quantity,
            purchase_price = case
              when product_row.stock_quantity + quantity = 0 then unit_cost
              else round(
                (product_row.stock_quantity * product_row.purchase_price + quantity * unit_cost)
                / (product_row.stock_quantity + quantity),
                2
              )
            end,
            updated_at = now()
        where id = product_row.id;
      insert into public.stock_movements (
        business_id, product_id, quantity, movement_type, supplier_name, note,
        previous_stock, new_stock, created_by
      ) values (
        p_business_id, product_row.id, quantity, 'in',
        (select name from public.suppliers where id = p_supplier_id),
        format('Achat %s%s', purchase_number,
          case when normalized_supplier_invoice is null then '' else ' · facture fournisseur ' || normalized_supplier_invoice end),
        product_row.stock_quantity, product_row.stock_quantity + quantity, auth.uid()
      );
    end if;
  end loop;
  return purchase_id;
end;
$$;

create or replace function public.register_purchase_payment(
  p_business_id uuid,
  p_purchase_id uuid,
  p_amount numeric,
  p_paid_at date,
  p_payment_method text,
  p_reference text,
  p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  purchase_row public.purchases%rowtype;
  payment_id uuid;
  request_hash text;
  existing_fingerprint text;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;
  if p_request_id is null then raise exception 'La clé de paiement est obligatoire.'; end if;
  if p_amount is null or p_amount <= 0 or p_paid_at is null then
    raise exception 'Le montant et la date du paiement sont obligatoires.';
  end if;
  if p_payment_method not in ('cash', 'mobile_money', 'bank_transfer', 'card', 'check', 'other') then
    raise exception 'Le mode de paiement est invalide.';
  end if;
  request_hash := md5(jsonb_build_object(
    'purchase_id', p_purchase_id,
    'amount', p_amount,
    'paid_at', p_paid_at,
    'payment_method', p_payment_method,
    'reference', nullif(trim(p_reference), '')
  )::text);
  perform pg_advisory_xact_lock(
    hashtextextended(p_business_id::text || ':purchase-payment:' || p_request_id::text, 0)
  );
  select id, request_fingerprint into payment_id, existing_fingerprint
    from public.purchase_payments
    where business_id = p_business_id and request_id = p_request_id;
  if found then
    if existing_fingerprint <> request_hash then
      raise exception 'Cette clé de paiement a déjà été utilisée pour un autre règlement.';
    end if;
    return payment_id;
  end if;

  select * into purchase_row from public.purchases
    where id = p_purchase_id and business_id = p_business_id
    for update;
  if not found then raise exception 'Facture d’achat introuvable.'; end if;
  if p_amount > purchase_row.total - purchase_row.paid_amount then
    raise exception 'Le paiement dépasse le solde restant de la facture.';
  end if;
  insert into public.purchase_payments (
    business_id, purchase_id, amount, paid_at, payment_method, reference,
    request_id, request_fingerprint, created_by
  ) values (
    p_business_id, p_purchase_id, p_amount, p_paid_at, p_payment_method,
    nullif(trim(p_reference), ''), p_request_id, request_hash, auth.uid()
  ) returning id into payment_id;
  update public.purchases
    set paid_amount = paid_amount + p_amount,
        status = case
          when paid_amount + p_amount = total then 'PAID'
          else 'PARTIALLY_PAID'
        end,
        updated_at = now()
    where id = p_purchase_id and business_id = p_business_id;
  return payment_id;
end;
$$;

revoke all on function public.create_purchase_with_lines(uuid, uuid, text, date, date, numeric, text, jsonb, uuid)
  from public, anon;
grant execute on function public.create_purchase_with_lines(uuid, uuid, text, date, date, numeric, text, jsonb, uuid)
  to authenticated;
revoke all on function public.register_purchase_payment(uuid, uuid, numeric, date, text, text, uuid)
  from public, anon;
grant execute on function public.register_purchase_payment(uuid, uuid, numeric, date, text, text, uuid)
  to authenticated;
