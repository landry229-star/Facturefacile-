create or replace function public.update_quote_with_lines(
  p_business_id uuid,
  p_quote_id uuid,
  p_client_id uuid,
  p_valid_until date,
  p_discount numeric,
  p_tax_rate numeric,
  p_lines jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  quote_row public.quotes%rowtype;
  line jsonb;
  line_description text;
  line_quantity numeric;
  line_unit_price numeric;
  line_product_id uuid;
  subtotal_amount numeric := 0;
  discount_amount numeric;
  tax_amount numeric;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;
  if p_client_id is null or not exists (
    select 1 from public.clients c
    where c.id = p_client_id and c.business_id = p_business_id
  ) then
    raise exception 'Client non autorisé.';
  end if;
  if p_valid_until is null or p_valid_until < current_date then
    raise exception 'La date de validité doit être aujourd’hui ou ultérieure.';
  end if;
  if p_discount is null or p_discount < 0 or p_discount::text in ('NaN', 'Infinity', '-Infinity')
    or p_tax_rate is null or p_tax_rate < 0 or p_tax_rate > 100 then
    raise exception 'La réduction ou le taux de taxe est invalide.';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) is distinct from 'array' then
    raise exception 'Le devis doit contenir au moins une ligne.';
  end if;
  if jsonb_array_length(p_lines) = 0 then
    raise exception 'Le devis doit contenir au moins une ligne.';
  end if;

  select * into quote_row
  from public.quotes q
  where q.id = p_quote_id and q.business_id = p_business_id
  for update;
  if not found or quote_row.status not in ('DRAFT', 'SENT') or quote_row.converted_invoice_id is not null then
    raise exception 'Seul un devis brouillon ou envoyé non converti peut être modifié.';
  end if;

  for line in select value from jsonb_array_elements(p_lines)
  loop
    line_description := trim(coalesce(line->>'description', ''));
    line_quantity := nullif(line->>'quantity', '')::numeric;
    line_unit_price := nullif(line->>'unit_price', '')::numeric;
    line_product_id := nullif(line->>'product_id', '')::uuid;
    if length(line_description) = 0 or line_quantity is null or line_quantity <= 0
      or line_quantity::text in ('NaN', 'Infinity', '-Infinity')
      or line_unit_price is null or line_unit_price < 0
      or line_unit_price::text in ('NaN', 'Infinity', '-Infinity') then
      raise exception 'Chaque ligne doit avoir une désignation, une quantité positive et un prix valide.';
    end if;
    if line_product_id is not null and not exists (
      select 1 from public.products p
      where p.id = line_product_id and p.business_id = p_business_id
    ) then
      raise exception 'Un produit de ce devis n’appartient pas à cette entreprise.';
    end if;
    subtotal_amount := subtotal_amount + round(line_quantity * line_unit_price, 2);
  end loop;

  discount_amount := least(p_discount, subtotal_amount);
  tax_amount := round((subtotal_amount - discount_amount) * p_tax_rate / 100, 2);
  update public.quotes q
  set client_id = p_client_id,
      valid_until = p_valid_until,
      subtotal = subtotal_amount,
      discount = discount_amount,
      tax = tax_amount,
      total = subtotal_amount - discount_amount + tax_amount,
      status = 'DRAFT',
      responded_at = null,
      acceptance_method = null,
      accepted_by_name = null,
      accepted_by_email = null,
      signature_data = null
  where q.id = p_quote_id and q.business_id = p_business_id;

  delete from public.quote_share_links l where l.quote_id = p_quote_id;
  delete from public.quote_items i where i.quote_id = p_quote_id;
  for line in select value from jsonb_array_elements(p_lines)
  loop
    insert into public.quote_items (quote_id, product_id, description, quantity, unit_price)
    values (
      p_quote_id,
      nullif(line->>'product_id', '')::uuid,
      trim(line->>'description'),
      (line->>'quantity')::numeric,
      (line->>'unit_price')::numeric
    );
  end loop;
end;
$$;

create or replace function public.delete_quote(p_business_id uuid, p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;
  delete from public.quotes q
  where q.id = p_quote_id
    and q.business_id = p_business_id
    and q.status <> 'CONVERTED'
    and q.converted_invoice_id is null;
  if not found then
    raise exception 'Ce devis est introuvable ou a déjà été converti en facture.';
  end if;
end;
$$;

revoke all on function public.update_quote_with_lines(uuid, uuid, uuid, date, numeric, numeric, jsonb) from public, anon;
grant execute on function public.update_quote_with_lines(uuid, uuid, uuid, date, numeric, numeric, jsonb) to authenticated;
revoke all on function public.delete_quote(uuid, uuid) from public, anon;
grant execute on function public.delete_quote(uuid, uuid) to authenticated;
