create or replace function public.load_public_quote(p_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  quote_row record;
begin
  if p_token !~ '^[0-9a-f]{64}$' then return null; end if;
  select q.*, c.name as client_name, b.name as business_name,
         b.phone as business_phone, b.email as business_email,
         b.address as business_address, b.city as business_city,
         b.country as business_country, b.tax_id as business_tax_id
    into quote_row
    from public.quote_share_links l
    join public.quotes q on q.id = l.quote_id
    join public.clients c on c.id = q.client_id
    join public.businesses b on b.id = q.business_id
   where l.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
     and l.expires_at > now();
  if not found then return null; end if;
  return jsonb_build_object(
    'id', quote_row.id, 'quoteNumber', quote_row.quote_number,
    'issueDate', quote_row.issue_date, 'validUntil', quote_row.valid_until,
    'currency', quote_row.currency, 'subtotal', quote_row.subtotal,
    'discount', quote_row.discount, 'tax', quote_row.tax, 'total', quote_row.total,
    'status', quote_row.status, 'clientName', quote_row.client_name,
    'businessName', quote_row.business_name,
    'businessPhone', quote_row.business_phone,
    'businessEmail', quote_row.business_email,
    'businessAddress', quote_row.business_address,
    'businessCity', quote_row.business_city,
    'businessCountry', quote_row.business_country,
    'businessTaxId', quote_row.business_tax_id,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', i.description, 'quantity', i.quantity,
        'unitPrice', i.unit_price, 'total', i.total
      ) order by i.id)
      from public.quote_items i where i.quote_id = quote_row.id
    ), '[]'::jsonb)
  );
end;
$$;
