create table if not exists public.cash_register_sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  request_id uuid not null,
  request_fingerprint text not null,
  invoice_id uuid unique references public.invoices(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (business_id, request_id)
);

alter table public.cash_register_sales enable row level security;
revoke all on public.cash_register_sales from public, anon, authenticated;

create unique index if not exists clients_cash_register_walk_in_uidx
  on public.clients (business_id)
  where notes = 'Client comptoir géré par la caisse rapide.';

create or replace function public.record_cash_register_sale(
  p_business_id uuid,
  p_request_id uuid,
  p_client_id uuid,
  p_payment_method text,
  p_lines jsonb
)
returns table (invoice_id uuid, invoice_number text, total numeric)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sale_id uuid;
  existing_invoice_id uuid;
  existing_request_fingerprint text;
  resolved_client_id uuid;
  invoice_number_value text;
  invoice_total numeric;
  request_fingerprint text;
  invoice_date date;
  business_timezone text;
  due_days integer;
  tax_rate numeric;
  line jsonb;
  product_id_value uuid;
  quantity_value numeric;
  product_type_value text;
  previously_seen_products uuid[] := '{}';
  payment_row record;
begin
  if auth.uid() is null or not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;
  if p_request_id is null then raise exception 'Identifiant de vente manquant.'; end if;
  if p_payment_method is null or p_payment_method not in ('cash', 'mobile_money', 'card', 'bank_transfer') then
    raise exception 'Mode de paiement invalide.';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Le panier doit contenir au moins un article.';
  end if;
  request_fingerprint := encode(digest(jsonb_build_object(
    'client_id', p_client_id,
    'payment_method', p_payment_method,
    'lines', p_lines
  )::text, 'sha256'), 'hex');

  insert into public.cash_register_sales (business_id, request_id, request_fingerprint, created_by)
  values (p_business_id, p_request_id, request_fingerprint, auth.uid())
  on conflict (business_id, request_id) do nothing
  returning id into sale_id;

  if sale_id is null then
    select s.invoice_id, s.request_fingerprint
      into existing_invoice_id, existing_request_fingerprint
      from public.cash_register_sales s
     where s.business_id = p_business_id and s.request_id = p_request_id
     for update;
    if existing_request_fingerprint is distinct from request_fingerprint then
      raise exception 'Cette clé de vente est déjà associée à un autre panier ou paiement.';
    end if;
    if existing_invoice_id is null then
      raise exception 'Cette vente est déjà en cours ou son reçu n’est plus disponible.';
    end if;
    return query
      select i.id, i.invoice_number, i.total
        from public.invoices i
       where i.id = existing_invoice_id and i.business_id = p_business_id;
    if not found then raise exception 'La facture associée à cette vente est introuvable.'; end if;
    return;
  end if;

  for line in select value from jsonb_array_elements(p_lines)
  loop
    if nullif(line->>'product_id', '') is null then
      raise exception 'Un article du panier est invalide.';
    end if;
    product_id_value := (line->>'product_id')::uuid;
    quantity_value := (line->>'quantity')::numeric;
    if quantity_value <= 0 then raise exception 'La quantité doit être positive.'; end if;
    if product_id_value = any(previously_seen_products) then
      raise exception 'Un article apparaît plusieurs fois dans le panier.';
    end if;
    previously_seen_products := array_append(previously_seen_products, product_id_value);
    if not exists (
      select 1 from public.products p
       where p.id = product_id_value and p.business_id = p_business_id and p.active
    ) then
      raise exception 'Un article du panier est indisponible.';
    end if;
  end loop;

  if p_client_id is null then
    perform pg_advisory_xact_lock(hashtextextended(p_business_id::text, 0));
    select c.id into resolved_client_id
      from public.clients c
     where c.business_id = p_business_id
       and c.notes = 'Client comptoir géré par la caisse rapide.'
     limit 1
     for update;
    if resolved_client_id is null then
      insert into public.clients (business_id, name, client_type, notes)
      values (p_business_id, 'Client comptoir', 'individual', 'Client comptoir géré par la caisse rapide.')
      returning id into resolved_client_id;
    end if;
  else
    resolved_client_id := p_client_id;
  end if;

  select coalesce(b.default_due_days, 0), coalesce(b.default_tax_rate, 0), b.timezone
    into due_days, tax_rate, business_timezone
    from public.businesses b
   where b.id = p_business_id;
  if not found then raise exception 'Entreprise introuvable.'; end if;
  invoice_date := (now() at time zone coalesce(business_timezone, 'Africa/Porto-Novo'))::date;

  invoice_number_value := public.create_invoice_with_lines(
    p_business_id,
    resolved_client_id,
    invoice_date,
    invoice_date + greatest(due_days, 0),
    0,
    tax_rate,
    'STANDARD',
    p_lines
  );
  select i.id, i.total into existing_invoice_id, invoice_total
    from public.invoices i
   where i.business_id = p_business_id and i.invoice_number = invoice_number_value
   for update;
  if existing_invoice_id is null or invoice_total <= 0 then
    raise exception 'Le total de la vente doit être supérieur à zéro.';
  end if;

  for line in select value from jsonb_array_elements(p_lines)
  loop
    product_id_value := (line->>'product_id')::uuid;
    quantity_value := (line->>'quantity')::numeric;
    select p.product_type into product_type_value
      from public.products p
     where p.id = product_id_value and p.business_id = p_business_id;
    if product_type_value = 'product' then
      perform public.apply_stock_movement(
        p_business_id,
        product_id_value,
        quantity_value,
        'out',
        format('Vente liée à %s', invoice_number_value),
        null,
        gen_random_uuid()
      );
    end if;
  end loop;

  update public.invoices
     set status = 'SENT', updated_at = now()
   where id = existing_invoice_id and business_id = p_business_id;

  select * into payment_row
    from public.record_invoice_payment(
      p_business_id,
      existing_invoice_id,
      invoice_total,
      invoice_date,
      p_payment_method,
      'Caisse rapide'
    );
  perform public.reconcile_invoice_payment(p_business_id, payment_row.payment_id, 'Caisse rapide');

  update public.cash_register_sales
     set invoice_id = existing_invoice_id
   where id = sale_id;

  return query select existing_invoice_id, invoice_number_value, invoice_total;
end;
$$;

revoke all on function public.record_cash_register_sale(uuid, uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.record_cash_register_sale(uuid, uuid, uuid, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
