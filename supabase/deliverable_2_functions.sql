-- ============================================================================
-- FACTUREFACILE BENIN - LIVRABLE 2
-- PostgreSQL stock RPCs and an explicitly fictitious e-MECeF workflow.
--
-- Apply only after the base schema, stock migration, and Livrable 1 metadata
-- migrations. This file targets the existing businesses/products/invoices model.
-- It never contacts the DGI, never creates official credentials, and never
-- changes an invoice payment status.
-- ============================================================================

-- A. Idempotent extension of the existing atomic stock movement RPC.
-- Existing callers using the five/six argument RPC remain compatible.
alter table public.stock_movements
  add column if not exists idempotency_key uuid,
  add column if not exists request_fingerprint text;

create unique index if not exists stock_movements_business_idempotency_uidx
  on public.stock_movements (business_id, idempotency_key)
  where idempotency_key is not null;

drop function if exists public.apply_stock_movement(uuid, uuid, numeric, text, text, text, uuid);

create function public.apply_stock_movement(
  p_business_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_movement_type text,
  p_note text,
  p_supplier_name text,
  p_idempotency_key uuid
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
  movement_row public.stock_movements%rowtype;
  delta numeric;
  request_hash text;
  normalized_note text := nullif(trim(p_note), '');
  normalized_supplier text := case
    when p_movement_type = 'in' then nullif(trim(p_supplier_name), '')
    else null
  end;
begin
  if not exists (
    select 1
      from public.businesses b
     where b.id = p_business_id
       and b.owner_id = auth.uid()
  ) then
    raise exception 'Seul le propriétaire de l’entreprise peut modifier ces informations.';
  end if;

  if p_product_id is null or p_quantity is null or p_quantity < 0
     or (p_movement_type in ('in', 'out') and p_quantity = 0) then
    raise exception 'La quantité doit être positive, sauf pour un ajustement à zéro.';
  end if;

  if p_movement_type not in ('in', 'out', 'adjustment') then
    raise exception 'Type de mouvement invalide.';
  end if;

  if p_idempotency_key is not null then
    request_hash := encode(digest(jsonb_build_object(
      'product_id', p_product_id,
      'quantity', p_quantity,
      'movement_type', p_movement_type,
      'note', normalized_note,
      'supplier_name', normalized_supplier
    )::text, 'sha256'), 'hex');

    perform pg_advisory_xact_lock(
      hashtextextended(p_business_id::text || ':' || p_idempotency_key::text, 0)
    );

    select *
      into movement_row
      from public.stock_movements sm
     where sm.business_id = p_business_id
       and sm.idempotency_key = p_idempotency_key;

    if found then
      if movement_row.request_fingerprint is distinct from request_hash then
        raise exception 'Cette clé de requête a déjà été utilisée pour un autre mouvement.';
      end if;
      movement_id := movement_row.id;
      previous_stock := movement_row.previous_stock;
      new_stock := movement_row.new_stock;
      return next;
      return;
    end if;
  end if;

  select *
    into product_row
    from public.products p
   where p.id = p_product_id
     and p.business_id = p_business_id
     and p.product_type = 'product'
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
    business_id,
    product_id,
    quantity,
    movement_type,
    supplier_name,
    note,
    previous_stock,
    new_stock,
    created_by,
    idempotency_key,
    request_fingerprint
  )
  values (
    p_business_id,
    product_row.id,
    delta,
    p_movement_type,
    normalized_supplier,
    normalized_note,
    product_row.stock_quantity,
    product_row.stock_quantity + delta,
    auth.uid(),
    p_idempotency_key,
    request_hash
  )
  returning stock_movements.id, stock_movements.previous_stock, stock_movements.new_stock
       into movement_id, previous_stock, new_stock;

  return next;
end;
$$;

revoke all on function public.apply_stock_movement(uuid, uuid, numeric, text, text, text, uuid)
  from public, anon;
grant execute on function public.apply_stock_movement(uuid, uuid, numeric, text, text, text, uuid)
  to authenticated;

-- B. Persist manually transcribed invoice metadata without claiming DGI validation.
create or replace function public.save_benin_invoice_metadata(
  p_business_id uuid,
  p_invoice_id uuid,
  p_reg_fiscal_emetteur text,
  p_benin_document_type text,
  p_dgi_nim text,
  p_dgi_counters text,
  p_dgi_signature text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  invoice_row public.invoices%rowtype;
  nim_value text := nullif(btrim(p_dgi_nim), '');
  counters_value text := nullif(btrim(p_dgi_counters), '');
  signature_value text := nullif(btrim(p_dgi_signature), '');
begin
  if auth.uid() is null then
    raise exception 'Authentification requise.';
  end if;

  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;

  if p_reg_fiscal_emetteur is not null
     and p_reg_fiscal_emetteur not in ('TPS', 'REEL') then
    raise exception 'Régime fiscal invalide.';
  end if;

  if p_benin_document_type is not null
     and p_benin_document_type not in ('proforma', 'recu_vente', 'bon_livraison', 'facture_interne') then
    raise exception 'Type de document invalide.';
  end if;

  if num_nonnulls(nim_value, counters_value, signature_value) not in (0, 3) then
    raise exception 'Le NIM, le compteur et la signature doivent être renseignés ensemble.';
  end if;

  if length(nim_value) > 50 or length(counters_value) > 50 or length(signature_value) > 100 then
    raise exception 'Une référence e-MECeF dépasse la longueur autorisée.';
  end if;

  select i.*
    into invoice_row
    from public.invoices i
   where i.id = p_invoice_id
     and i.business_id = p_business_id
   for update;

  if not found then
    raise exception 'Facture introuvable dans cette entreprise.';
  end if;

  if invoice_row.status in ('DRAFT', 'CANCELLED') or invoice_row.invoice_type = 'PROFORMA' then
    raise exception 'Les références e-MECeF ne peuvent être liées qu’à un document émis et non proforma.';
  end if;

  if p_benin_document_type = 'proforma' and nim_value is not null then
    raise exception 'Une facture proforma ne peut pas recevoir de références e-MECeF dans ce module.';
  end if;

  update public.invoices
     set reg_fiscal_emetteur = p_reg_fiscal_emetteur,
         benin_document_type = p_benin_document_type,
         dgi_nim = nim_value,
         dgi_counters = counters_value,
         dgi_signature = signature_value,
         is_dgi_mock = false,
         normalized_at = null,
         updated_at = now()
   where id = p_invoice_id
     and business_id = p_business_id;

  return jsonb_build_object(
    'success', true,
    'is_dgi_mock', false,
    'references_saved', nim_value is not null
  );
end;
$$;

revoke all on function public.save_benin_invoice_metadata(uuid, uuid, text, text, text, text, text) from public, anon;
grant execute on function public.save_benin_invoice_metadata(uuid, uuid, text, text, text, text, text) to authenticated;

-- C. Safe DGI workflow simulation. This is not a DGI/e-MECeF integration.
create or replace function public.simulate_dgi_normalisation(p_invoice_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  invoice_row public.invoices%rowtype;
  mock_nim text;
  mock_signature text;
  mock_counters text := 'MOCK-COUNTER-NOT-OFFICIAL';
  normalized_time timestamptz;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Authentification requise.');
  end if;

  select i.*
    into invoice_row
    from public.invoices i
    join public.businesses b on b.id = i.business_id
   where i.id = p_invoice_id
     and b.owner_id = auth.uid()
   for update of i;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Facture introuvable ou accès non autorisé.');
  end if;

  if invoice_row.status in ('DRAFT', 'CANCELLED')
     or invoice_row.invoice_type = 'PROFORMA'
     or invoice_row.benin_document_type = 'proforma' then
    return jsonb_build_object(
      'success', false,
      'error', 'Seule une facture émise et non proforma/annulée peut être simulée.'
    );
  end if;

  if invoice_row.is_dgi_mock then
    return jsonb_build_object(
      'success', true,
      'is_mock', true,
      'status', 'simulation',
      'nim', invoice_row.dgi_nim,
      'signature', invoice_row.dgi_signature,
      'counters', invoice_row.dgi_counters,
      'normalized_at', invoice_row.normalized_at
    );
  end if;

  if invoice_row.dgi_nim is not null
     or invoice_row.dgi_signature is not null
     or invoice_row.dgi_counters is not null then
    return jsonb_build_object(
      'success', false,
      'error', 'La facture contient déjà des métadonnées non simulées ; elles ne seront pas remplacées.'
    );
  end if;

  mock_nim := 'MOCK-NIM-NOT-OFFICIAL-' || left(replace(p_invoice_id::text, '-', ''), 8);
  mock_signature := 'MOCK-SIGNATURE-NOT-VALID-' || left(replace(p_invoice_id::text, '-', ''), 8);
  normalized_time := now();

  update public.invoices
     set dgi_nim = mock_nim,
         dgi_signature = mock_signature,
         dgi_counters = mock_counters,
         is_dgi_mock = true,
         normalized_at = normalized_time
   where id = p_invoice_id;

  return jsonb_build_object(
    'success', true,
    'is_mock', true,
    'status', 'simulation',
    'nim', mock_nim,
    'signature', mock_signature,
    'counters', mock_counters,
    'normalized_at', normalized_time,
    'notice', 'SIMULATION FICTIVE - aucune validation DGI/e-MECeF.'
  );
end;
$$;

revoke all on function public.simulate_dgi_normalisation(uuid) from public, anon;
grant execute on function public.simulate_dgi_normalisation(uuid) to authenticated;

-- D. Enforce the selected fiscal rate when a new invoice is inserted.
create or replace function public.snapshot_invoice_fiscal_regime()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  taxable_amount numeric;
begin
  select b.fiscal_regime
    into new.reg_fiscal_emetteur
    from public.businesses b
   where b.id = new.business_id;

  if new.reg_fiscal_emetteur in ('TPS', 'REEL') then
    taxable_amount := greatest(
      coalesce(new.subtotal, 0) - least(greatest(coalesce(new.discount, 0), 0), coalesce(new.subtotal, 0)),
      0
    );
    new.tax := case when new.reg_fiscal_emetteur = 'TPS' then 0 else taxable_amount * 0.18 end;
    new.total := taxable_amount + new.tax;
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
