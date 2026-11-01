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
  subscription_row record;
  invoice_count integer;
  month_start date := date_trunc('month', p_issue_date)::date;
  next_month date := (date_trunc('month', p_issue_date) + interval '1 month')::date;
  subtotal numeric := 0;
  discount_amount numeric;
  tax_amount numeric;
  total_amount numeric;
  quantity numeric;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;

  if not exists (
    select 1 from public.clients
    where id = p_client_id and business_id = p_business_id
  ) then
    raise exception 'Client non autorisé.';
  end if;

  select *
  into subscription_row
  from public.business_subscriptions
  where business_id = p_business_id
  for update;

  if not found then
    raise exception 'Abonnement non configuré pour cette entreprise.';
  end if;
  if subscription_row.status not in ('active', 'trialing') then
    raise exception 'Votre abonnement ne permet pas de créer des factures.';
  end if;
  if subscription_row.expires_at is not null and subscription_row.expires_at < now() then
    raise exception 'Votre abonnement a expiré.';
  end if;

  select count(*)::integer
  into invoice_count
  from public.invoices
  where business_id = p_business_id
    and issue_date >= month_start
    and issue_date < next_month
    and status <> 'CANCELLED';

  if invoice_count >= subscription_row.monthly_invoice_limit then
    raise exception 'La limite mensuelle de % factures est atteinte.', subscription_row.monthly_invoice_limit;
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
    select id, name, price
    into product_row
    from public.products
    where id = (line->>'product_id')::uuid
      and business_id = p_business_id;

    insert into public.invoice_items (invoice_id, product_id, description, quantity, unit_price)
    values (invoice_id, product_row.id, product_row.name, quantity, product_row.price);
  end loop;

  return invoice_number;
end;
$$;

revoke all on function public.create_invoice_with_lines(uuid, uuid, date, date, numeric, numeric, jsonb) from public, anon;
grant execute on function public.create_invoice_with_lines(uuid, uuid, date, date, numeric, numeric, jsonb) to authenticated;

create or replace function public.cancel_invoice_with_stock_restore(
  p_business_id uuid,
  p_invoice_number text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  invoice_row public.invoices;
  item record;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;

  select *
  into invoice_row
  from public.invoices
  where business_id = p_business_id
    and invoice_number = p_invoice_number
  for update;

  if not found then
    raise exception 'Facture introuvable.';
  end if;
  if invoice_row.status = 'PAID' then
    raise exception 'Une facture payée ne peut pas être annulée.';
  end if;
  if invoice_row.status = 'CANCELLED' then
    return;
  end if;

  for item in
    select ii.product_id, ii.quantity
    from public.invoice_items ii
    join public.products p on p.id = ii.product_id
    where ii.invoice_id = invoice_row.id
      and p.product_type = 'product'
      and exists (
        select 1
        from public.stock_movements sm
        where sm.business_id = p_business_id
          and sm.product_id = ii.product_id
          and sm.movement_type = 'out'
          and sm.note = format('Vente liée à %s', p_invoice_number)
      )
  loop
    perform public.apply_stock_movement(
      p_business_id,
      item.product_id,
      item.quantity,
      'in',
      format('Restauration après annulation de %s', p_invoice_number)
    );
  end loop;

  update public.invoices
  set status = 'CANCELLED', updated_at = now()
  where id = invoice_row.id;
end;
$$;

revoke all on function public.cancel_invoice_with_stock_restore(uuid, text) from public, anon;
grant execute on function public.cancel_invoice_with_stock_restore(uuid, text) to authenticated;
