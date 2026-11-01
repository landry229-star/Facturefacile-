alter table public.stock_movements
  add column if not exists supplier_name text;

alter table public.stock_movements
  drop constraint if exists stock_movements_quantity_check;

alter table public.stock_movements
  add constraint stock_movements_quantity_check
  check (movement_type = 'adjustment' or quantity <> 0);

drop function if exists public.apply_stock_movement(uuid, uuid, numeric, text, text);

create function public.apply_stock_movement(
  p_business_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_movement_type text,
  p_note text default null,
  p_supplier_name text default null
)
returns table (
  movement_id uuid,
  previous_stock numeric,
  new_stock numeric
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  product_row public.products%rowtype;
  delta numeric;
  v_movement_id uuid;
  v_previous_stock numeric;
  v_new_stock numeric;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;

  if p_product_id is null or p_quantity is null or p_quantity < 0
     or (p_movement_type in ('in', 'out') and p_quantity = 0) then
    raise exception 'La quantité doit être positive, sauf pour un ajustement à zéro.';
  end if;

  if p_movement_type not in ('in', 'out', 'adjustment') then
    raise exception 'Type de mouvement invalide.';
  end if;

  select *
  into product_row
  from public.products
  where id = p_product_id
    and business_id = p_business_id
    and product_type = 'product'
  for update;

  if not found then
    raise exception 'Produit non autorisé ou non stockable.';
  end if;

  delta := case
    when p_movement_type = 'in' then p_quantity
    when p_movement_type = 'out' then -p_quantity
    else p_quantity - product_row.stock_quantity
  end;

  if product_row.stock_quantity + delta < 0 then
    raise exception 'Le stock ne peut pas être négatif.';
  end if;

  update public.products
  set stock_quantity = product_row.stock_quantity + delta,
      updated_at = now()
  where id = product_row.id;

  insert into public.stock_movements (
    business_id, product_id, quantity, movement_type, supplier_name, note,
    previous_stock, new_stock, created_by
  )
  values (
    p_business_id, product_row.id, delta, p_movement_type,
    case when p_movement_type = 'in' then nullif(trim(p_supplier_name), '') else null end,
    nullif(trim(p_note), ''),
    product_row.stock_quantity, product_row.stock_quantity + delta, auth.uid()
  )
  returning stock_movements.id, stock_movements.previous_stock, stock_movements.new_stock
  into v_movement_id, v_previous_stock, v_new_stock;

  movement_id := v_movement_id;
  previous_stock := v_previous_stock;
  new_stock := v_new_stock;
  return next;
end;
$$;

revoke all on function public.apply_stock_movement(uuid, uuid, numeric, text, text, text) from public, anon;
grant execute on function public.apply_stock_movement(uuid, uuid, numeric, text, text, text) to authenticated;
