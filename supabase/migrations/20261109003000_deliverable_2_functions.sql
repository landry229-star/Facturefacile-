-- ============================================================================
-- FACTUREFACILE BENIN - LIVRABLE 2
-- PostgreSQL stock RPCs and an explicitly fictitious e-MECeF workflow.
--
-- Apply only after the base schema, stock migration, and Livrable 1 metadata
-- migration. This file targets the existing businesses/products/invoices model.
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

-- B. Safe DGI workflow simulation. This is not a DGI/e-MECeF integration.
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

notify pgrst, 'reload schema';
