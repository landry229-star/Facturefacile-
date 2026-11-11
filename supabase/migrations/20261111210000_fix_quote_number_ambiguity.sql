create or replace function public.create_quote_with_lines(
  p_business_id uuid,
  p_client_id uuid,
  p_valid_until date,
  p_discount numeric,
  p_tax_rate numeric,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  business_row public.businesses;
  line jsonb;
  product_row record;
  quote_id uuid;
  quote_number_value text;
  sequence_number integer;
  subtotal_amount numeric := 0;
  discount_amount numeric;
  tax_amount numeric;
  total_amount numeric;
  quantity numeric;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;
  select * into business_row from public.businesses where id = p_business_id for update;
  if not found then raise exception 'Entreprise introuvable.'; end if;
  if not exists (select 1 from public.clients where id = p_client_id and business_id = p_business_id) then
    raise exception 'Client non autorisé.';
  end if;
  if p_valid_until < current_date then raise exception 'La date de validité ne peut pas être passée.'; end if;
  if p_discount is null or p_discount < 0 or p_tax_rate is null or p_tax_rate < 0 or p_tax_rate > 100 then
    raise exception 'La réduction ou le taux de taxe est invalide.';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Le devis doit contenir au moins une ligne.';
  end if;

  for line in select value from jsonb_array_elements(p_lines)
  loop
    quantity := (line->>'quantity')::numeric;
    if quantity <= 0 then raise exception 'La quantité doit être positive.'; end if;
    select id, name, price into product_row
      from public.products
      where id = (line->>'product_id')::uuid and business_id = p_business_id;
    if not found then raise exception 'Produit ou service non autorisé.'; end if;
    subtotal_amount := subtotal_amount + product_row.price * quantity;
  end loop;

  discount_amount := least(p_discount, subtotal_amount);
  tax_amount := (subtotal_amount - discount_amount) * p_tax_rate / 100;
  total_amount := subtotal_amount - discount_amount + tax_amount;
  select coalesce(max(right(q.quote_number, 5)::integer), 0) + 1 into sequence_number
    from public.quotes q
    where q.business_id = p_business_id
      and q.quote_number like 'DEV-' || extract(year from current_date)::integer::text || '-%';
  quote_number_value := 'DEV-' || extract(year from current_date)::integer::text || '-' || lpad(sequence_number::text, 5, '0');

  insert into public.quotes (
    business_id, client_id, quote_number, issue_date, valid_until, currency,
    subtotal, discount, tax, total, created_by
  ) values (
    p_business_id, p_client_id, quote_number_value, current_date, p_valid_until, business_row.currency,
    subtotal_amount, discount_amount, tax_amount, total_amount, auth.uid()
  ) returning id into quote_id;

  for line in select value from jsonb_array_elements(p_lines)
  loop
    quantity := (line->>'quantity')::numeric;
    select id, name, price into product_row
      from public.products
      where id = (line->>'product_id')::uuid and business_id = p_business_id;
    insert into public.quote_items (quote_id, product_id, description, quantity, unit_price)
    values (quote_id, product_row.id, product_row.name, quantity, product_row.price);
  end loop;
  return quote_id;
end;
$$;
