alter table public.purchase_items
  add column if not exists received_quantity numeric(12, 2) not null default 0
    check (received_quantity >= 0 and received_quantity <= quantity);

update public.purchase_items
   set received_quantity = quantity
 where received_quantity = 0;

create table if not exists public.purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  purchase_id uuid not null references public.purchases(id) on delete restrict,
  received_on date not null,
  request_id uuid not null,
  request_fingerprint text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (business_id, request_id)
);

create table if not exists public.purchase_receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.purchase_receipts(id) on delete restrict,
  purchase_item_id uuid not null references public.purchase_items(id) on delete restrict,
  line_number integer not null,
  quantity numeric(12, 2) not null check (quantity > 0),
  stock_before numeric(12, 2),
  stock_after numeric(12, 2),
  purchase_price_before numeric(12, 2),
  purchase_price_after numeric(12, 2),
  stock_movement_id uuid references public.stock_movements(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (receipt_id, purchase_item_id)
);

create index if not exists purchase_receipts_business_purchase_idx
  on public.purchase_receipts (business_id, purchase_id, received_on desc);
create index if not exists purchase_receipt_items_purchase_item_idx
  on public.purchase_receipt_items (purchase_item_id, created_at);

insert into public.purchase_receipts (
  business_id, purchase_id, received_on, request_id, request_fingerprint, created_by, created_at
)
select
  p.business_id,
  p.id,
  p.purchase_date,
  gen_random_uuid(),
  md5('legacy purchase receipt:' || p.id::text),
  p.created_by,
  p.created_at
from public.purchases p
where exists (select 1 from public.purchase_items pi where pi.purchase_id = p.id)
  and not exists (select 1 from public.purchase_receipts pr where pr.purchase_id = p.id);

insert into public.purchase_receipt_items (
  receipt_id, purchase_item_id, line_number, quantity,
  stock_before, stock_after, purchase_price_before, purchase_price_after,
  created_at
)
select
  pr.id,
  pi.id,
  coalesce(pi.line_number, row_number() over (partition by pi.purchase_id order by pi.id)::integer),
  pi.quantity,
  pi.stock_before,
  pi.stock_after,
  pi.purchase_price_before,
  pi.purchase_price_after,
  p.created_at + (coalesce(pi.line_number, 1) * interval '1 microsecond')
from public.purchase_items pi
join public.purchases p on p.id = pi.purchase_id
join public.purchase_receipts pr on pr.purchase_id = p.id
where pi.product_id is not null
  and not exists (
    select 1 from public.purchase_receipt_items pri
     where pri.purchase_item_id = pi.id
  );

with purchase_item_order as (
  select
    p.id as purchase_id,
    pi.id as purchase_item_id,
    pi.product_id,
    p.business_id,
    p.purchase_number,
    row_number() over (
      partition by p.id, pi.product_id
      order by pi.line_number nulls last, pi.id
    ) as item_number
  from public.purchase_items pi
  join public.purchases p on p.id = pi.purchase_id
  where pi.product_id is not null
),
movement_order as (
  select
    p.id as purchase_id,
    sm.product_id,
    sm.id as stock_movement_id,
    row_number() over (
      partition by p.id, sm.product_id
      order by sm.created_at, sm.id
    ) as movement_number
  from public.purchases p
  join public.stock_movements sm
    on sm.business_id = p.business_id
   and sm.note like 'Achat ' || p.purchase_number || '%'
  where exists (
    select 1 from public.purchase_items pi
     where pi.purchase_id = p.id and pi.product_id = sm.product_id
  )
)
update public.purchase_receipt_items pri
   set stock_movement_id = mo.stock_movement_id
  from purchase_item_order pio
  join movement_order mo
    on mo.purchase_id = pio.purchase_id
   and mo.product_id = pio.product_id
   and mo.movement_number = pio.item_number
 where pri.purchase_item_id = pio.purchase_item_id
   and pri.stock_movement_id is null;

alter table public.purchase_receipts enable row level security;
alter table public.purchase_receipt_items enable row level security;

drop policy if exists "purchase members read purchase receipts" on public.purchase_receipts;
create policy "purchase members read purchase receipts" on public.purchase_receipts
  for select to authenticated using (public.is_business_member(business_id, 'viewer'));
drop policy if exists "purchase members read purchase receipt items" on public.purchase_receipt_items;
create policy "purchase members read purchase receipt items" on public.purchase_receipt_items
  for select to authenticated using (exists (
    select 1
      from public.purchase_receipts pr
     where pr.id = purchase_receipt_items.receipt_id
       and public.is_business_member(pr.business_id, 'viewer')
  ));
revoke all on public.purchase_receipts, public.purchase_receipt_items from anon, authenticated;
grant select on public.purchase_receipts, public.purchase_receipt_items to authenticated;

drop trigger if exists capture_purchase_item_stock_snapshot on public.purchase_items;
create or replace function public.capture_purchase_item_stock_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  purchase_business_id uuid;
begin
  select p.business_id into purchase_business_id
    from public.purchases p
   where p.id = new.purchase_id;
  if not found then raise exception 'Facture d’achat introuvable.'; end if;

  select coalesce(max(pi.line_number), 0) + 1
    into new.line_number
    from public.purchase_items pi
   where pi.purchase_id = new.purchase_id;

  if new.product_id is not null and not exists (
    select 1 from public.products p
     where p.id = new.product_id
       and p.business_id = purchase_business_id
       and p.product_type = 'product'
  ) then
    raise exception 'Un produit de la facture fournisseur est invalide.';
  end if;
  return new;
end;
$$;
create trigger capture_purchase_item_stock_snapshot
  before insert on public.purchase_items
  for each row execute function public.capture_purchase_item_stock_snapshot();

revoke all on function public.capture_purchase_item_stock_snapshot() from public, anon, authenticated;

create or replace function public.apply_purchase_receipt(
  p_business_id uuid,
  p_purchase_id uuid,
  p_received_on date,
  p_lines jsonb,
  p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  purchase_row public.purchases%rowtype;
  receipt_id uuid;
  existing_fingerprint text;
  request_fingerprint text;
  line jsonb;
  item_row public.purchase_items%rowtype;
  product_row public.products%rowtype;
  movement_id uuid;
  quantity numeric;
  processed_products uuid[] := '{}';
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;
  if p_request_id is null or p_received_on is null then
    raise exception 'La date et la clé de réception sont obligatoires.';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Ajoutez au moins une quantité reçue.';
  end if;
  if jsonb_array_length(p_lines) <> (
    select count(distinct value->>'purchase_item_id')
      from jsonb_array_elements(p_lines)
  ) then
    raise exception 'Une ligne de facture ne peut apparaître qu’une fois par réception.';
  end if;
  request_fingerprint := md5(jsonb_build_object(
    'purchase_id', p_purchase_id,
    'received_on', p_received_on,
    'lines', p_lines
  )::text);
  perform pg_advisory_xact_lock(
    hashtextextended(p_business_id::text || ':purchase-receipt:' || p_request_id::text, 0)
  );
  select pr.id, pr.request_fingerprint
    into receipt_id, existing_fingerprint
    from public.purchase_receipts pr
   where pr.business_id = p_business_id
     and pr.request_id = p_request_id;
  if found then
    if existing_fingerprint <> request_fingerprint then
      raise exception 'Cette clé de réception est déjà associée à une autre réception.';
    end if;
    return receipt_id;
  end if;

  select * into purchase_row
    from public.purchases p
   where p.id = p_purchase_id
     and p.business_id = p_business_id
   for update;
  if not found then raise exception 'Facture d’achat introuvable.'; end if;
  if purchase_row.voided_at is not null then
    raise exception 'Une facture d’achat annulée ne peut pas recevoir de marchandise.';
  end if;

  for line in
    select value from jsonb_array_elements(p_lines)
     order by (value->>'purchase_item_id')
  loop
    if nullif(line->>'purchase_item_id', '') is null
       or nullif(line->>'quantity', '') is null then
      raise exception 'Une ligne de réception est invalide.';
    end if;
    quantity := (line->>'quantity')::numeric;
    if quantity <= 0 then raise exception 'La quantité reçue doit être supérieure à zéro.'; end if;
    select * into item_row
      from public.purchase_items pi
     where pi.id = (line->>'purchase_item_id')::uuid
       and pi.purchase_id = p_purchase_id
     for update;
    if not found then raise exception 'Une ligne n’appartient pas à cette facture d’achat.'; end if;
    if quantity > item_row.quantity - item_row.received_quantity then
      raise exception 'La quantité reçue dépasse le reliquat de la ligne %.', item_row.description;
    end if;
  end loop;

  perform 1
    from public.products p
   where p.business_id = p_business_id
     and p.id in (
       select pi.product_id
         from public.purchase_items pi
         join jsonb_array_elements(p_lines) line
           on pi.id = (line.value->>'purchase_item_id')::uuid
        where pi.purchase_id = p_purchase_id
          and pi.product_id is not null
     )
   order by p.id
   for update;

  insert into public.purchase_receipts (
    business_id, purchase_id, received_on, request_id, request_fingerprint, created_by
  ) values (
    p_business_id, p_purchase_id, p_received_on, p_request_id, request_fingerprint, auth.uid()
  ) returning id into receipt_id;

  for line in select value from jsonb_array_elements(p_lines)
  loop
    quantity := (line->>'quantity')::numeric;
    select * into item_row
      from public.purchase_items pi
     where pi.id = (line->>'purchase_item_id')::uuid
       and pi.purchase_id = p_purchase_id;

    movement_id := null;
    if item_row.product_id is not null then
      select * into product_row
        from public.products p
       where p.id = item_row.product_id
         and p.business_id = p_business_id
       for update;
      if not found then raise exception 'Le produit lié à la réception est introuvable.'; end if;

      update public.products
         set stock_quantity = product_row.stock_quantity + quantity,
             purchase_price = case
               when product_row.stock_quantity + quantity = 0 then item_row.unit_cost
               else round(
                 (product_row.stock_quantity * product_row.purchase_price + quantity * item_row.unit_cost)
                 / (product_row.stock_quantity + quantity),
                 2
               )
             end,
             updated_at = now()
       where id = product_row.id
         and business_id = p_business_id;

      insert into public.stock_movements (
        business_id, product_id, quantity, movement_type, supplier_name, note,
        previous_stock, new_stock, created_by
      ) values (
        p_business_id,
        product_row.id,
        quantity,
        'in',
        (select s.name from public.suppliers s where s.id = purchase_row.supplier_id),
        format('Réception achat %s', purchase_row.purchase_number),
        product_row.stock_quantity,
        product_row.stock_quantity + quantity,
        auth.uid()
      ) returning id into movement_id;

      if not product_row.id = any(processed_products) then
        update public.purchase_items pi
           set stock_before = product_row.stock_quantity,
               purchase_price_before = product_row.purchase_price
         where pi.purchase_id = p_purchase_id
           and pi.product_id = product_row.id
           and pi.stock_before is null;
        processed_products := array_append(processed_products, product_row.id);
      end if;
      update public.purchase_items pi
         set stock_after = product_row.stock_quantity + quantity,
             purchase_price_after = case
               when product_row.stock_quantity + quantity = 0 then item_row.unit_cost
               else round(
                 (product_row.stock_quantity * product_row.purchase_price + quantity * item_row.unit_cost)
                 / (product_row.stock_quantity + quantity),
                 2
               )
             end
       where pi.purchase_id = p_purchase_id
         and pi.product_id = product_row.id;
    end if;

    insert into public.purchase_receipt_items (
      receipt_id, purchase_item_id, line_number, quantity, stock_before, stock_after,
      purchase_price_before, purchase_price_after, stock_movement_id
    ) values (
      receipt_id,
      item_row.id,
      item_row.line_number,
      quantity,
      case when item_row.product_id is null then null else product_row.stock_quantity end,
      case when item_row.product_id is null then null else product_row.stock_quantity + quantity end,
      case when item_row.product_id is null then null else product_row.purchase_price end,
      case
        when item_row.product_id is null then null
        when product_row.stock_quantity + quantity = 0 then item_row.unit_cost
        else round(
          (product_row.stock_quantity * product_row.purchase_price + quantity * item_row.unit_cost)
          / (product_row.stock_quantity + quantity),
          2
        )
      end,
      movement_id
    );
    update public.purchase_items
       set received_quantity = received_quantity + quantity
     where id = item_row.id
       and purchase_id = p_purchase_id;
  end loop;

  return receipt_id;
end;
$$;

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
  purchase_id uuid;
  purchase_number_value text;
  sequence_number integer;
  quantity numeric;
  received_quantity numeric;
  unit_cost numeric;
  subtotal_amount numeric := 0;
  tax_amount numeric;
  total_amount numeric;
  purchase_item_id uuid;
  request_hash text;
  receipt_lines jsonb := '[]'::jsonb;
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
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'L’achat doit contenir au moins une ligne.';
  end if;
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
    received_quantity := coalesce(nullif(line->>'received_quantity', '')::numeric, quantity);
    if quantity <= 0 or unit_cost < 0 or received_quantity < 0 or received_quantity > quantity then
      raise exception 'La quantité facturée, reçue ou le coût unitaire est invalide.';
    end if;
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

  perform 1 from public.businesses where id = p_business_id for update;
  select coalesce(max(right(p.purchase_number, 5)::integer), 0) + 1
    into sequence_number
    from public.purchases p
   where p.business_id = p_business_id
     and p.purchase_number like 'ACH-' || extract(year from p_purchase_date)::integer::text || '-%';
  purchase_number_value := 'ACH-' || extract(year from p_purchase_date)::integer::text || '-' || lpad(sequence_number::text, 5, '0');
  tax_amount := round(subtotal_amount * p_tax_rate / 100, 2);
  total_amount := subtotal_amount + tax_amount;
  if total_amount <= 0 then raise exception 'Le montant total de l’achat doit être supérieur à zéro.'; end if;

  insert into public.purchases (
    business_id, supplier_id, purchase_number, supplier_invoice_number,
    purchase_date, due_date, subtotal, tax, total, notes, request_id,
    request_fingerprint, created_by
  ) values (
    p_business_id, p_supplier_id, purchase_number_value, normalized_supplier_invoice,
    p_purchase_date, p_due_date, subtotal_amount, tax_amount, total_amount,
    nullif(trim(p_notes), ''), p_request_id, request_hash, auth.uid()
  ) returning id into purchase_id;

  for line in select value from jsonb_array_elements(p_lines)
  loop
    quantity := (line->>'quantity')::numeric;
    unit_cost := (line->>'unit_cost')::numeric;
    received_quantity := coalesce(nullif(line->>'received_quantity', '')::numeric, quantity);
    insert into public.purchase_items (
      purchase_id, product_id, description, quantity, received_quantity, unit_cost
    ) values (
      purchase_id,
      nullif(line->>'product_id', '')::uuid,
      trim(line->>'description'),
      quantity,
      0,
      unit_cost
    );
    if received_quantity > 0 then
      select pi.id into purchase_item_id
        from public.purchase_items pi
       where pi.purchase_id = purchase_id
         and pi.line_number = (select max(pi2.line_number) from public.purchase_items pi2 where pi2.purchase_id = purchase_id);
      receipt_lines := receipt_lines || jsonb_build_array(jsonb_build_object(
        'purchase_item_id', purchase_item_id,
        'quantity', received_quantity
      ));
    end if;
  end loop;

  if jsonb_array_length(receipt_lines) > 0 then
    perform public.apply_purchase_receipt(
      p_business_id,
      purchase_id,
      p_purchase_date,
      receipt_lines,
      p_request_id
    );
  end if;
  return purchase_id;
end;
$$;

create or replace function public.receive_purchase_items(
  p_business_id uuid,
  p_purchase_id uuid,
  p_received_on date,
  p_lines jsonb,
  p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public.apply_purchase_receipt(
    p_business_id, p_purchase_id, p_received_on, p_lines, p_request_id
  );
end;
$$;

create or replace function public.cancel_purchase(
  p_business_id uuid,
  p_purchase_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  purchase_row public.purchases%rowtype;
  product_row public.products%rowtype;
  first_receipt_item public.purchase_receipt_items%rowtype;
  last_receipt_item public.purchase_receipt_items%rowtype;
  last_movement_at timestamptz;
  normalized_reason text := nullif(trim(p_reason), '');
  stock_delta numeric;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;
  if normalized_reason is null then raise exception 'Le motif d’annulation est obligatoire.'; end if;

  select * into purchase_row
    from public.purchases p
   where p.id = p_purchase_id
     and p.business_id = p_business_id
   for update;
  if not found then raise exception 'Facture d’achat introuvable.'; end if;
  if purchase_row.voided_at is not null then raise exception 'Cette facture d’achat est déjà annulée.'; end if;
  if purchase_row.paid_amount <> 0 or exists (
    select 1 from public.purchase_payments pp
     where pp.purchase_id = p_purchase_id
       and pp.business_id = p_business_id
       and pp.reversed_at is null
  ) then
    raise exception 'Inversez d’abord chaque règlement fournisseur avant d’annuler l’achat.';
  end if;

  for product_row in
    select p.* from public.products p
     where p.business_id = p_business_id
       and exists (
         select 1
           from public.purchase_items pi
           join public.purchase_receipts pr on pr.purchase_id = pi.purchase_id
           join public.purchase_receipt_items pri on pri.receipt_id = pr.id and pri.purchase_item_id = pi.id
          where pi.purchase_id = p_purchase_id
            and pi.product_id = p.id
       )
     order by p.id
     for update
  loop
    select pri.* into first_receipt_item
      from public.purchase_items pi
      join public.purchase_receipts pr on pr.purchase_id = pi.purchase_id
      join public.purchase_receipt_items pri on pri.receipt_id = pr.id and pri.purchase_item_id = pi.id
     where pi.purchase_id = p_purchase_id
       and pi.product_id = product_row.id
     order by pr.created_at, pri.line_number, pri.created_at
     limit 1;
    select pri.* into last_receipt_item
      from public.purchase_items pi
      join public.purchase_receipts pr on pr.purchase_id = pi.purchase_id
      join public.purchase_receipt_items pri on pri.receipt_id = pr.id and pri.purchase_item_id = pi.id
     where pi.purchase_id = p_purchase_id
       and pi.product_id = product_row.id
     order by pr.created_at desc, pri.line_number desc, pri.created_at desc
     limit 1;
    if first_receipt_item.stock_before is null
       or first_receipt_item.purchase_price_before is null
       or last_receipt_item.stock_after is null
       or last_receipt_item.purchase_price_after is null
       or last_receipt_item.stock_movement_id is null then
      raise exception 'La réception de % ne possède pas un historique de stock complet pour être annulée.', product_row.name;
    end if;

    select sm.created_at into last_movement_at
      from public.stock_movements sm
     where sm.id = last_receipt_item.stock_movement_id
       and sm.business_id = p_business_id
       and sm.product_id = product_row.id;
    if last_movement_at is null then
      raise exception 'Le mouvement de stock de la dernière réception de % est introuvable.', product_row.name;
    end if;
    if exists (
      select 1 from public.stock_movements sm
       where sm.business_id = p_business_id
         and sm.product_id = product_row.id
         and sm.created_at > last_movement_at
    ) then
      raise exception 'Le stock de % a changé depuis sa dernière réception. Rapprochez d’abord les mouvements ultérieurs.', product_row.name;
    end if;
    if product_row.stock_quantity is distinct from last_receipt_item.stock_after
       or product_row.purchase_price is distinct from last_receipt_item.purchase_price_after then
      raise exception 'Le stock ou le coût moyen de % ne correspond plus à cette réception.', product_row.name;
    end if;

    stock_delta := first_receipt_item.stock_before - product_row.stock_quantity;
    update public.products
       set stock_quantity = first_receipt_item.stock_before,
           purchase_price = first_receipt_item.purchase_price_before,
           updated_at = now()
     where id = product_row.id
       and business_id = p_business_id;
    if stock_delta <> 0 then
      insert into public.stock_movements (
        business_id, product_id, quantity, movement_type, supplier_name, note,
        previous_stock, new_stock, created_by
      ) values (
        p_business_id,
        product_row.id,
        stock_delta,
        'adjustment',
        (select s.name from public.suppliers s where s.id = purchase_row.supplier_id),
        format('Annulation achat %s · %s', purchase_row.purchase_number, normalized_reason),
        product_row.stock_quantity,
        first_receipt_item.stock_before,
        auth.uid()
      );
    end if;
  end loop;

  update public.purchases
     set voided_at = now(),
         voided_by = auth.uid(),
         void_reason = normalized_reason,
         paid_amount = 0,
         status = 'UNPAID',
         updated_at = now()
   where id = p_purchase_id
     and business_id = p_business_id;
end;
$$;

create or replace function public.get_purchase_summary(p_business_id uuid)
returns table (purchase_count bigint, open_balance numeric, overdue_balance numeric)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    count(*) filter (where p.voided_at is null),
    coalesce(sum(greatest(p.total - p.paid_amount, 0)) filter (where p.voided_at is null), 0),
    coalesce(sum(greatest(p.total - p.paid_amount, 0)) filter (
      where p.voided_at is null
        and p.due_date < (now() at time zone coalesce(b.timezone, 'Africa/Porto-Novo'))::date
        and p.status <> 'PAID'
    ), 0)
  from public.purchases p
  join public.businesses b on b.id = p.business_id
  where p.business_id = p_business_id
    and public.is_business_member(p_business_id, 'viewer');
$$;

create or replace function public.get_purchase_page_ids(
  p_business_id uuid,
  p_page integer,
  p_page_size integer,
  p_query text default null,
  p_supplier_id uuid default null,
  p_status text default 'ALL',
  p_from_date date default null,
  p_to_date date default null
)
returns table (purchase_id uuid, total_count bigint)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  with filtered as (
    select p.id, p.purchase_date, p.created_at
      from public.purchases p
      join public.suppliers s on s.id = p.supplier_id and s.business_id = p.business_id
     where p.business_id = p_business_id
       and public.is_business_member(p_business_id, 'viewer')
       and (p_supplier_id is null or p.supplier_id = p_supplier_id)
       and (p_from_date is null or p.purchase_date >= p_from_date)
       and (p_to_date is null or p.purchase_date <= p_to_date)
       and (
         p_status = 'ALL'
         or (p_status = 'VOIDED' and p.voided_at is not null)
         or (p_status in ('UNPAID', 'PARTIALLY_PAID', 'PAID') and p.voided_at is null and p.status = p_status)
       )
       and (
         nullif(trim(p_query), '') is null
         or position(lower(trim(p_query)) in lower(p.purchase_number)) > 0
         or position(lower(trim(p_query)) in lower(coalesce(p.supplier_invoice_number, ''))) > 0
         or position(lower(trim(p_query)) in lower(s.name)) > 0
       )
  )
  select filtered.id, count(*) over ()
    from filtered
   order by filtered.purchase_date desc, filtered.created_at desc
   limit greatest(1, least(coalesce(p_page_size, 25), 100))
   offset greatest(0, coalesce(p_page, 1) - 1) * greatest(1, least(coalesce(p_page_size, 25), 100));
$$;

revoke all on function public.apply_purchase_receipt(uuid, uuid, date, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.create_purchase_with_lines(uuid, uuid, text, date, date, numeric, text, jsonb, uuid) from public, anon;
grant execute on function public.create_purchase_with_lines(uuid, uuid, text, date, date, numeric, text, jsonb, uuid) to authenticated;
revoke all on function public.receive_purchase_items(uuid, uuid, date, jsonb, uuid) from public, anon;
grant execute on function public.receive_purchase_items(uuid, uuid, date, jsonb, uuid) to authenticated;
revoke all on function public.cancel_purchase(uuid, uuid, text) from public, anon;
grant execute on function public.cancel_purchase(uuid, uuid, text) to authenticated;
revoke all on function public.get_purchase_summary(uuid) from public, anon;
grant execute on function public.get_purchase_summary(uuid) to authenticated;
revoke all on function public.get_purchase_page_ids(uuid, integer, integer, text, uuid, text, date, date) from public, anon;
grant execute on function public.get_purchase_page_ids(uuid, integer, integer, text, uuid, text, date, date) to authenticated;

notify pgrst, 'reload schema';
