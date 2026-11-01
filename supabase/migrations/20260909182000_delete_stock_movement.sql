create or replace function public.delete_stock_movement(
  p_business_id uuid,
  p_movement_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  movement_row public.stock_movements%rowtype;
  product_row public.products%rowtype;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;

  select *
  into movement_row
  from public.stock_movements
  where id = p_movement_id
    and business_id = p_business_id
  for update;

  if not found then
    raise exception 'Mouvement introuvable.';
  end if;

  select *
  into product_row
  from public.products
  where id = movement_row.product_id
    and business_id = p_business_id
  for update;

  if not found then
    raise exception 'Produit associé introuvable.';
  end if;

  if exists (
    select 1
    from public.stock_movements newer
    where newer.product_id = movement_row.product_id
      and newer.business_id = p_business_id
      and (newer.created_at, newer.id) > (movement_row.created_at, movement_row.id)
  ) then
    raise exception 'Seul le dernier mouvement de ce produit peut être supprimé.';
  end if;

  if product_row.stock_quantity - movement_row.quantity < 0 then
    raise exception 'La suppression rendrait le stock négatif.';
  end if;

  update public.products
  set stock_quantity = product_row.stock_quantity - movement_row.quantity,
      updated_at = now()
  where id = product_row.id;

  delete from public.stock_movements
  where id = movement_row.id;
end;
$$;

revoke all on function public.delete_stock_movement(uuid, uuid) from public, anon;
grant execute on function public.delete_stock_movement(uuid, uuid) to authenticated;
