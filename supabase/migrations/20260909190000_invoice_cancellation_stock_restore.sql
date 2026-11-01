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
