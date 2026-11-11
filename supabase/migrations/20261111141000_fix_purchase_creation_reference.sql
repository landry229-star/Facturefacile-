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
  created_purchase_id uuid;
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
  ) returning id into created_purchase_id;

  for line in select value from jsonb_array_elements(p_lines)
  loop
    quantity := (line->>'quantity')::numeric;
    unit_cost := (line->>'unit_cost')::numeric;
    received_quantity := coalesce(nullif(line->>'received_quantity', '')::numeric, quantity);
    insert into public.purchase_items (
      purchase_id, product_id, description, quantity, received_quantity, unit_cost
    ) values (
      created_purchase_id,
      nullif(line->>'product_id', '')::uuid,
      trim(line->>'description'),
      quantity,
      0,
      unit_cost
    );
    if received_quantity > 0 then
      select pi.id into purchase_item_id
        from public.purchase_items pi
       where pi.purchase_id = created_purchase_id
         and pi.line_number = (
           select max(pi2.line_number)
             from public.purchase_items pi2
            where pi2.purchase_id = created_purchase_id
         );
      receipt_lines := receipt_lines || jsonb_build_array(jsonb_build_object(
        'purchase_item_id', purchase_item_id,
        'quantity', received_quantity
      ));
    end if;
  end loop;

  if jsonb_array_length(receipt_lines) > 0 then
    perform public.apply_purchase_receipt(
      p_business_id,
      created_purchase_id,
      p_purchase_date,
      receipt_lines,
      p_request_id
    );
  end if;
  return created_purchase_id;
end;
$$;

revoke all on function public.create_purchase_with_lines(uuid, uuid, text, date, date, numeric, text, jsonb, uuid) from public, anon;
grant execute on function public.create_purchase_with_lines(uuid, uuid, text, date, date, numeric, text, jsonb, uuid) to authenticated;

notify pgrst, 'reload schema';
