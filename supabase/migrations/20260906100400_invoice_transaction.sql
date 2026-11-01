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
  subtotal numeric := 0;
  discount_amount numeric;
  tax_amount numeric;
  total_amount numeric;
  quantity numeric;
begin
  if not exists (
    select 1 from public.businesses
    where id = p_business_id and owner_id = auth.uid()
  ) then
    raise exception 'Entreprise non autorisée.';
  end if;

  if not exists (
    select 1 from public.clients
    where id = p_client_id and business_id = p_business_id
  ) then
    raise exception 'Client non autorisé.';
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
