alter table public.purchase_items
  add column if not exists returned_quantity numeric(12, 2) not null default 0
    check (returned_quantity >= 0 and returned_quantity <= received_quantity);

create table if not exists public.purchase_returns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  purchase_id uuid not null references public.purchases(id) on delete restrict,
  returned_on date not null,
  reason text not null check (length(trim(reason)) > 0),
  request_id uuid not null,
  request_fingerprint text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (business_id, request_id)
);

create table if not exists public.purchase_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.purchase_returns(id) on delete restrict,
  purchase_item_id uuid not null references public.purchase_items(id) on delete restrict,
  quantity numeric(12, 2) not null check (quantity > 0),
  stock_before numeric(12, 2) not null,
  stock_after numeric(12, 2) not null,
  stock_movement_id uuid references public.stock_movements(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (return_id, purchase_item_id)
);

create index if not exists purchase_returns_business_purchase_idx
  on public.purchase_returns (business_id, purchase_id, returned_on desc);
create index if not exists purchase_return_items_purchase_item_idx
  on public.purchase_return_items (purchase_item_id, created_at);

alter table public.purchase_returns enable row level security;
alter table public.purchase_return_items enable row level security;

drop policy if exists "purchase members read purchase returns" on public.purchase_returns;
create policy "purchase members read purchase returns" on public.purchase_returns
  for select to authenticated using (public.is_business_member(business_id, 'viewer'));
drop policy if exists "purchase members read purchase return items" on public.purchase_return_items;
create policy "purchase members read purchase return items" on public.purchase_return_items
  for select to authenticated using (exists (
    select 1 from public.purchase_returns pr
     where pr.id = purchase_return_items.return_id
       and public.is_business_member(pr.business_id, 'viewer')
  ));

revoke all on public.purchase_returns, public.purchase_return_items from anon, authenticated;
grant select on public.purchase_returns, public.purchase_return_items to authenticated;

create or replace function public.return_purchase_items(
  p_business_id uuid,
  p_purchase_id uuid,
  p_returned_on date,
  p_reason text,
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
  return_id uuid;
  existing_fingerprint text;
  request_fingerprint text;
  normalized_reason text := nullif(trim(p_reason), '');
  line jsonb;
  item_row public.purchase_items%rowtype;
  product_row public.products%rowtype;
  movement_id uuid;
  quantity numeric;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;
  if p_request_id is null or p_returned_on is null or normalized_reason is null then
    raise exception 'La date, le motif et la clé du retour sont obligatoires.';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Ajoutez au moins une quantité retournée.';
  end if;
  if jsonb_array_length(p_lines) <> (
    select count(distinct value->>'purchase_item_id')
      from jsonb_array_elements(p_lines)
  ) then
    raise exception 'Une ligne de facture ne peut apparaître qu’une fois par retour.';
  end if;

  request_fingerprint := md5(jsonb_build_object(
    'purchase_id', p_purchase_id,
    'returned_on', p_returned_on,
    'reason', normalized_reason,
    'lines', p_lines
  )::text);
  perform pg_advisory_xact_lock(
    hashtextextended(p_business_id::text || ':purchase-return:' || p_request_id::text, 0)
  );
  select pr.id, pr.request_fingerprint
    into return_id, existing_fingerprint
    from public.purchase_returns pr
   where pr.business_id = p_business_id
     and pr.request_id = p_request_id;
  if found then
    if existing_fingerprint <> request_fingerprint then
      raise exception 'Cette clé de retour est déjà associée à un autre retour.';
    end if;
    return return_id;
  end if;

  select * into purchase_row
    from public.purchases p
   where p.id = p_purchase_id
     and p.business_id = p_business_id
   for update;
  if not found then raise exception 'Facture d’achat introuvable.'; end if;
  if purchase_row.voided_at is not null then
    raise exception 'Une facture d’achat annulée ne peut pas faire l’objet d’un retour.';
  end if;

  for line in
    select value from jsonb_array_elements(p_lines)
     order by value->>'purchase_item_id'
  loop
    if nullif(line->>'purchase_item_id', '') is null
       or nullif(line->>'quantity', '') is null then
      raise exception 'Une ligne de retour est invalide.';
    end if;
    quantity := (line->>'quantity')::numeric;
    if quantity <= 0 then raise exception 'La quantité retournée doit être supérieure à zéro.'; end if;
    select * into item_row
      from public.purchase_items pi
     where pi.id = (line->>'purchase_item_id')::uuid
       and pi.purchase_id = p_purchase_id
     for update;
    if not found then raise exception 'Une ligne n’appartient pas à cette facture d’achat.'; end if;
    if item_row.product_id is null then
      raise exception 'Seules les lignes liées à un produit en stock peuvent être retournées.';
    end if;
    if quantity > item_row.received_quantity - item_row.returned_quantity then
      raise exception 'La quantité retournée dépasse la quantité reçue encore disponible pour %.', item_row.description;
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
     )
   order by p.id
   for update;

  insert into public.purchase_returns (
    business_id, purchase_id, returned_on, reason, request_id, request_fingerprint, created_by
  ) values (
    p_business_id, p_purchase_id, p_returned_on, normalized_reason,
    p_request_id, request_fingerprint, auth.uid()
  ) returning id into return_id;

  for line in
    select value from jsonb_array_elements(p_lines)
     order by value->>'purchase_item_id'
  loop
    quantity := (line->>'quantity')::numeric;
    select * into item_row
      from public.purchase_items pi
     where pi.id = (line->>'purchase_item_id')::uuid
       and pi.purchase_id = p_purchase_id;
    select * into product_row
      from public.products p
     where p.id = item_row.product_id
       and p.business_id = p_business_id
       and p.product_type = 'product'
     for update;
    if not found then
      raise exception 'Le produit lié à la ligne % est introuvable ou non stockable.', item_row.description;
    end if;
    if product_row.stock_quantity < quantity then
      raise exception 'Stock insuffisant pour retourner % : stock actuel %, quantité demandée %.',
        product_row.name, product_row.stock_quantity, quantity;
    end if;

    update public.products
       set stock_quantity = product_row.stock_quantity - quantity,
           updated_at = now()
     where id = product_row.id
       and business_id = p_business_id;

    insert into public.stock_movements (
      business_id, product_id, quantity, movement_type, supplier_name, note,
      previous_stock, new_stock, created_by
    ) values (
      p_business_id,
      product_row.id,
      -quantity,
      'out',
      (select s.name from public.suppliers s where s.id = purchase_row.supplier_id),
      format('Retour achat %s · %s', purchase_row.purchase_number, normalized_reason),
      product_row.stock_quantity,
      product_row.stock_quantity - quantity,
      auth.uid()
    ) returning id into movement_id;

    insert into public.purchase_return_items (
      return_id, purchase_item_id, quantity, stock_before, stock_after, stock_movement_id
    ) values (
      return_id, item_row.id, quantity, product_row.stock_quantity,
      product_row.stock_quantity - quantity, movement_id
    );
    update public.purchase_items
       set returned_quantity = returned_quantity + quantity
     where id = item_row.id
       and purchase_id = p_purchase_id;
  end loop;

  return return_id;
end;
$$;

revoke all on function public.return_purchase_items(uuid, uuid, date, text, jsonb, uuid)
  from public, anon;
grant execute on function public.return_purchase_items(uuid, uuid, date, text, jsonb, uuid)
  to authenticated;

notify pgrst, 'reload schema';
