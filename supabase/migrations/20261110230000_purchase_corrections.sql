alter table public.purchases
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id) on delete set null,
  add column if not exists void_reason text;

alter table public.purchase_payments
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_by uuid references auth.users(id) on delete set null,
  add column if not exists reversal_date date,
  add column if not exists reversal_reason text;

alter table public.purchase_items
  add column if not exists line_number integer,
  add column if not exists stock_before numeric(12, 2),
  add column if not exists stock_after numeric(12, 2),
  add column if not exists purchase_price_before numeric(12, 2),
  add column if not exists purchase_price_after numeric(12, 2);

alter table public.purchase_payments
  drop constraint if exists purchase_payments_reversal_fields_check;

alter table public.purchase_payments
  add constraint purchase_payments_reversal_fields_check
  check (
    (reversed_at is null and reversed_by is null and reversal_date is null and reversal_reason is null)
    or (
      reversed_at is not null
      and reversed_by is not null
      and reversal_date is not null
      and length(trim(coalesce(reversal_reason, ''))) > 0
    )
  );

drop index if exists public.purchases_supplier_invoice_uidx;
create unique index purchases_supplier_invoice_uidx
  on public.purchases (business_id, supplier_id, lower(trim(supplier_invoice_number)))
  where voided_at is null
    and supplier_invoice_number is not null
    and length(trim(supplier_invoice_number)) > 0;

create or replace function public.capture_purchase_item_stock_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  purchase_business_id uuid;
  product_row public.products%rowtype;
begin
  select p.business_id into purchase_business_id
  from public.purchases p
  where p.id = new.purchase_id;
  if not found then raise exception 'Facture d’achat introuvable.'; end if;

  select coalesce(max(pi.line_number), 0) + 1
    into new.line_number
    from public.purchase_items pi
   where pi.purchase_id = new.purchase_id;

  if new.product_id is null then return new; end if;

  select * into product_row
    from public.products p
   where p.id = new.product_id
     and p.business_id = purchase_business_id
     and p.product_type = 'product'
   for update;
  if not found then raise exception 'Un produit de la facture fournisseur est invalide.'; end if;

  new.stock_before := product_row.stock_quantity;
  new.stock_after := product_row.stock_quantity + new.quantity;
  new.purchase_price_before := product_row.purchase_price;
  new.purchase_price_after := case
    when product_row.stock_quantity + new.quantity = 0 then new.unit_cost
    else round(
      (product_row.stock_quantity * product_row.purchase_price + new.quantity * new.unit_cost)
      / (product_row.stock_quantity + new.quantity),
      2
    )
  end;
  return new;
end;
$$;

drop trigger if exists capture_purchase_item_stock_snapshot on public.purchase_items;
create trigger capture_purchase_item_stock_snapshot
  before insert on public.purchase_items
  for each row execute function public.capture_purchase_item_stock_snapshot();

revoke all on function public.capture_purchase_item_stock_snapshot() from public, anon, authenticated;

create or replace function public.reverse_purchase_payment(
  p_business_id uuid,
  p_payment_id uuid,
  p_reversal_date date,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  purchase_id_value uuid;
  purchase_row public.purchases%rowtype;
  payment_row public.purchase_payments%rowtype;
  normalized_reason text := nullif(trim(p_reason), '');
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;
  if p_reversal_date is null or normalized_reason is null then
    raise exception 'La date et le motif de l’inversion sont obligatoires.';
  end if;

  select pp.purchase_id into purchase_id_value
    from public.purchase_payments pp
   where pp.id = p_payment_id
     and pp.business_id = p_business_id;
  if not found then raise exception 'Règlement fournisseur introuvable.'; end if;

  select * into purchase_row
    from public.purchases p
   where p.id = purchase_id_value
     and p.business_id = p_business_id
   for update;
  if not found then raise exception 'Facture d’achat introuvable.'; end if;
  if purchase_row.voided_at is not null then
    raise exception 'Un règlement ne peut pas être inversé après l’annulation de l’achat.';
  end if;

  select * into payment_row
    from public.purchase_payments pp
   where pp.id = p_payment_id
     and pp.business_id = p_business_id
   for update;
  if not found then raise exception 'Règlement fournisseur introuvable.'; end if;
  if payment_row.reversed_at is not null then raise exception 'Ce règlement a déjà été inversé.'; end if;
  if purchase_row.paid_amount < payment_row.amount then
    raise exception 'Le solde de l’achat ne correspond plus à ce règlement.';
  end if;

  update public.purchase_payments
     set reversed_at = now(),
         reversed_by = auth.uid(),
         reversal_date = p_reversal_date,
         reversal_reason = normalized_reason
   where id = p_payment_id
     and business_id = p_business_id;

  update public.purchases
     set paid_amount = paid_amount - payment_row.amount,
         status = case
           when paid_amount - payment_row.amount = 0 then 'UNPAID'
           when paid_amount - payment_row.amount = total then 'PAID'
           else 'PARTIALLY_PAID'
         end,
         updated_at = now()
   where id = purchase_id_value
     and business_id = p_business_id;
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
  first_item public.purchase_items%rowtype;
  last_item public.purchase_items%rowtype;
  stock_delta numeric;
  normalized_reason text := nullif(trim(p_reason), '');
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
       and p.id in (
         select pi.product_id from public.purchase_items pi
          where pi.purchase_id = p_purchase_id
            and pi.product_id is not null
       )
     order by p.id
     for update
  loop
    select * into first_item
      from public.purchase_items pi
     where pi.purchase_id = p_purchase_id
       and pi.product_id = product_row.id
     order by pi.line_number asc nulls last
     limit 1;
    select * into last_item
      from public.purchase_items pi
     where pi.purchase_id = p_purchase_id
       and pi.product_id = product_row.id
     order by pi.line_number desc nulls first
     limit 1;

    if first_item.stock_before is null
       or first_item.purchase_price_before is null
       or last_item.stock_after is null
       or last_item.purchase_price_after is null then
      raise exception 'L’achat contient un ancien mouvement sans instantané de stock. Une correction manuelle contrôlée est nécessaire.';
    end if;
    if exists (
      select 1 from public.stock_movements sm
       where sm.business_id = p_business_id
         and sm.product_id = product_row.id
         and sm.created_at > purchase_row.created_at
    ) then
      raise exception 'Le stock de % a changé depuis cet achat. Annulez ou rapprochez d’abord les mouvements ultérieurs.', product_row.name;
    end if;
    if product_row.stock_quantity is distinct from last_item.stock_after
       or product_row.purchase_price is distinct from last_item.purchase_price_after then
      raise exception 'Le stock ou le coût moyen de % ne correspond plus à cet achat. Une correction manuelle contrôlée est nécessaire.', product_row.name;
    end if;

    stock_delta := first_item.stock_before - product_row.stock_quantity;
    update public.products
       set stock_quantity = first_item.stock_before,
           purchase_price = first_item.purchase_price_before,
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
        first_item.stock_before,
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

revoke all on function public.reverse_purchase_payment(uuid, uuid, date, text) from public, anon;
grant execute on function public.reverse_purchase_payment(uuid, uuid, date, text) to authenticated;
revoke all on function public.cancel_purchase(uuid, uuid, text) from public, anon;
grant execute on function public.cancel_purchase(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';
