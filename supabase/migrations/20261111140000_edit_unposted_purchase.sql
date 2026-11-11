create or replace function public.update_unposted_purchase(
  p_business_id uuid,
  p_purchase_id uuid,
  p_supplier_id uuid,
  p_supplier_invoice_number text,
  p_purchase_date date,
  p_due_date date,
  p_tax_rate numeric,
  p_notes text,
  p_lines jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  purchase_row public.purchases%rowtype;
  line jsonb;
  subtotal_amount numeric := 0;
  tax_amount numeric;
  total_amount numeric;
  quantity numeric;
  unit_cost numeric;
  normalized_supplier_invoice text := nullif(trim(p_supplier_invoice_number), '');
  actor_label text := coalesce(
    nullif(auth.jwt()->'user_metadata'->>'full_name', ''),
    nullif(auth.jwt()->>'email', ''),
    auth.uid()::text,
    'Système'
  );
begin
  if not public.can_manage_purchase(p_business_id, 'create_purchase') then
    raise exception 'Votre rôle ne permet pas de modifier une facture d’achat.';
  end if;
  if p_purchase_date is null or (p_due_date is not null and p_due_date < p_purchase_date) then
    raise exception 'La date d’achat ou l’échéance est invalide.';
  end if;
  if p_tax_rate is null or p_tax_rate < 0 or p_tax_rate > 100 then
    raise exception 'Le taux de taxe doit être compris entre 0 et 100 %%.';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'L’achat doit contenir au moins une ligne.';
  end if;

  select * into purchase_row
    from public.purchases p
   where p.id = p_purchase_id
     and p.business_id = p_business_id
   for update;
  if not found then raise exception 'Facture d’achat introuvable.'; end if;
  if purchase_row.voided_at is not null then
    raise exception 'Une facture annulée ne peut pas être modifiée.';
  end if;
  if exists (
    select 1 from public.purchase_payments pp
     where pp.business_id = p_business_id
       and pp.purchase_id = p_purchase_id
  ) then
    raise exception 'Cette facture a déjà un historique de règlement. Inversez les paiements ou annulez l’achat au lieu de le modifier.';
  end if;
  if exists (
    select 1 from public.purchase_receipts pr
     where pr.business_id = p_business_id
       and pr.purchase_id = p_purchase_id
  ) or exists (
    select 1 from public.purchase_returns pr
     where pr.business_id = p_business_id
       and pr.purchase_id = p_purchase_id
  ) or exists (
    select 1 from public.purchase_items pi
     where pi.purchase_id = p_purchase_id
       and (pi.received_quantity <> 0 or pi.returned_quantity <> 0)
  ) then
    raise exception 'Cette facture a déjà un historique de réception ou de retour. Elle ne peut plus être modifiée directement.';
  end if;
  if not exists (
    select 1 from public.suppliers s
     where s.id = p_supplier_id
       and s.business_id = p_business_id
       and s.active
  ) then
    raise exception 'Fournisseur inactif ou non autorisé.';
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
      select 1 from public.products p
       where p.id = (line->>'product_id')::uuid
         and p.business_id = p_business_id
         and p.product_type = 'product'
    ) then
      raise exception 'Un produit de la facture fournisseur est invalide.';
    end if;
  end loop;

  tax_amount := round(subtotal_amount * p_tax_rate / 100, 2);
  total_amount := subtotal_amount + tax_amount;
  if total_amount <= 0 then raise exception 'Le montant total de l’achat doit être supérieur à zéro.'; end if;

  update public.purchases
     set supplier_id = p_supplier_id,
         supplier_invoice_number = normalized_supplier_invoice,
         purchase_date = p_purchase_date,
         due_date = p_due_date,
         subtotal = subtotal_amount,
         tax = tax_amount,
         total = total_amount,
         notes = nullif(trim(p_notes), ''),
         updated_at = now()
   where id = p_purchase_id
     and business_id = p_business_id;

  delete from public.purchase_items
   where purchase_id = p_purchase_id;

  for line in select value from jsonb_array_elements(p_lines)
  loop
    insert into public.purchase_items (purchase_id, product_id, description, quantity, unit_cost)
    values (
      p_purchase_id,
      nullif(line->>'product_id', '')::uuid,
      trim(line->>'description'),
      (line->>'quantity')::numeric,
      (line->>'unit_cost')::numeric
    );
  end loop;

  insert into public.purchase_activity_logs (
    business_id, actor_id, actor_name, action, entity_type, entity_id, summary, details
  ) values (
    p_business_id,
    auth.uid(),
    actor_label,
    'purchase_updated',
    'purchase',
    p_purchase_id,
    'Facture d’achat modifiée',
    jsonb_build_object(
      'purchase_number', purchase_row.purchase_number,
      'previous_supplier_id', purchase_row.supplier_id,
      'supplier_id', p_supplier_id,
      'previous_total', purchase_row.total,
      'total', total_amount
    )
  );
end;
$$;

revoke all on function public.update_unposted_purchase(uuid, uuid, uuid, text, date, date, numeric, text, jsonb) from public, anon;
grant execute on function public.update_unposted_purchase(uuid, uuid, uuid, text, date, date, numeric, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
