create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  quote_number text not null,
  issue_date date not null default current_date,
  valid_until date not null,
  currency text not null default 'XOF' check (currency in ('XOF', 'EUR', 'USD')),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  tax numeric(12, 2) not null default 0 check (tax >= 0),
  total numeric(12, 2) not null check (total >= 0),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CONVERTED')),
  responded_at timestamptz,
  acceptance_method text check (acceptance_method is null or acceptance_method in ('manual', 'online')),
  accepted_by_name text,
  accepted_by_email text,
  signature_data text,
  converted_invoice_id uuid references public.invoices(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (business_id, quote_number),
  check ((status = 'CONVERTED') = (converted_invoice_id is not null))
);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  description text not null,
  quantity numeric(12, 2) not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  total numeric(12, 2) generated always as (quantity * unit_price) stored
);

create table if not exists public.quote_share_links (
  quote_id uuid primary key references public.quotes(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists quotes_business_date_idx on public.quotes (business_id, issue_date desc);

alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.quote_share_links enable row level security;

drop policy if exists "quote members read quotes" on public.quotes;
create policy "quote members read quotes" on public.quotes
for select to authenticated
using (public.is_business_member(business_id, 'viewer'));

drop policy if exists "quote members read quote items" on public.quote_items;
create policy "quote members read quote items" on public.quote_items
for select to authenticated
using (exists (
  select 1 from public.quotes q
  where q.id = quote_items.quote_id
    and public.is_business_member(q.business_id, 'viewer')
));

revoke all on public.quotes, public.quote_items, public.quote_share_links from anon, authenticated;
grant select on public.quotes, public.quote_items to authenticated;

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
  quote_number text;
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
  select coalesce(max(right(quote_number, 5)::integer), 0) + 1 into sequence_number
    from public.quotes
    where business_id = p_business_id
      and quote_number like 'DEV-' || extract(year from current_date)::integer::text || '-%';
  quote_number := 'DEV-' || extract(year from current_date)::integer::text || '-' || lpad(sequence_number::text, 5, '0');

  insert into public.quotes (
    business_id, client_id, quote_number, issue_date, valid_until, currency,
    subtotal, discount, tax, total, created_by
  ) values (
    p_business_id, p_client_id, quote_number, current_date, p_valid_until, business_row.currency,
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

create or replace function public.accept_quote_manually(p_business_id uuid, p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_business_member(p_business_id, 'member') then raise exception 'Entreprise non autorisée.'; end if;
  update public.quotes
     set status = 'ACCEPTED',
         responded_at = now(),
         acceptance_method = 'manual',
         accepted_by_name = coalesce(auth.jwt()->'user_metadata'->>'full_name', auth.jwt()->>'email', 'Utilisateur'),
         accepted_by_email = auth.jwt()->>'email'
   where id = p_quote_id and business_id = p_business_id
     and status in ('DRAFT', 'SENT') and valid_until >= current_date;
  if not found then raise exception 'Ce devis ne peut pas être marqué comme accepté.'; end if;
end;
$$;

create or replace function public.create_quote_share_link(p_business_id uuid, p_quote_id uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  quote_row public.quotes;
begin
  if not public.is_business_member(p_business_id, 'member') then raise exception 'Entreprise non autorisée.'; end if;
  if p_token !~ '^[0-9a-f]{64}$' then raise exception 'Jeton de partage invalide.'; end if;
  select * into quote_row from public.quotes
   where id = p_quote_id and business_id = p_business_id for update;
  if not found or quote_row.status not in ('DRAFT', 'SENT') or quote_row.valid_until < current_date then
    raise exception 'Ce devis ne peut pas être partagé.';
  end if;
  insert into public.quote_share_links (quote_id, token_hash, expires_at)
  values (p_quote_id, encode(sha256(convert_to(p_token, 'UTF8')), 'hex'), (quote_row.valid_until + 1)::timestamp at time zone 'UTC')
  on conflict (quote_id) do update
    set token_hash = excluded.token_hash, expires_at = excluded.expires_at, created_at = now();
  update public.quotes set status = 'SENT' where id = p_quote_id;
end;
$$;

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
  select q.*, c.name as client_name, b.name as business_name
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
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('description', i.description, 'quantity', i.quantity, 'unitPrice', i.unit_price, 'total', i.total) order by i.id)
      from public.quote_items i where i.quote_id = quote_row.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.respond_to_public_quote(
  p_token text,
  p_decision text,
  p_full_name text,
  p_email text,
  p_confirmed boolean,
  p_signature_data text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  quote_row public.quotes;
  token_hash_value text;
begin
  if p_token !~ '^[0-9a-f]{64}$' then raise exception 'Lien de devis invalide ou expiré.'; end if;
  if p_decision not in ('accept', 'decline') then raise exception 'Réponse de devis invalide.'; end if;
  if not p_confirmed or length(trim(coalesce(p_full_name, ''))) < 2 or length(trim(coalesce(p_full_name, ''))) > 120 then
    raise exception 'Indiquez votre nom et confirmez votre réponse.';
  end if;
  if length(trim(coalesce(p_email, ''))) > 254 or trim(coalesce(p_email, '')) !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'Adresse e-mail invalide.';
  end if;
  if p_decision = 'accept' and (
    p_signature_data is null
    or length(p_signature_data) > 250000
    or p_signature_data !~ '^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$'
  ) then raise exception 'La signature dessinée est requise pour accepter le devis.'; end if;

  token_hash_value := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  select q.* into quote_row
    from public.quote_share_links l
    join public.quotes q on q.id = l.quote_id
   where l.token_hash = token_hash_value and l.expires_at > now()
   for update of q;
  if not found or quote_row.status <> 'SENT' or quote_row.valid_until < current_date then
    raise exception 'Ce devis n’est plus disponible pour une réponse.';
  end if;

  update public.quotes
     set status = case when p_decision = 'accept' then 'ACCEPTED' else 'REJECTED' end,
         responded_at = now(),
         acceptance_method = 'online',
         accepted_by_name = trim(p_full_name),
         accepted_by_email = lower(trim(p_email)),
         signature_data = case when p_decision = 'accept' then p_signature_data else null end
   where id = quote_row.id;
  delete from public.quote_share_links where quote_id = quote_row.id;
end;
$$;

create or replace function public.convert_accepted_quote_to_invoice(p_business_id uuid, p_quote_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  quote_row public.quotes;
  business_row public.businesses;
  subscription_row record;
  invoice_id uuid;
  invoice_number text;
  invoice_count integer;
  current_year integer := extract(year from current_date)::integer;
  month_start date := date_trunc('month', current_date)::date;
  next_month date := (date_trunc('month', current_date) + interval '1 month')::date;
  item record;
begin
  if not public.is_business_member(p_business_id, 'member') then raise exception 'Entreprise non autorisée.'; end if;
  select * into quote_row from public.quotes
   where id = p_quote_id and business_id = p_business_id for update;
  if not found or quote_row.status <> 'ACCEPTED' or quote_row.converted_invoice_id is not null then
    raise exception 'Seul un devis accepté non converti peut devenir une facture.';
  end if;
  select * into business_row from public.businesses where id = p_business_id;
  select * into subscription_row from public.business_subscriptions where business_id = p_business_id for update;
  if not found or subscription_row.status not in ('active', 'trialing')
    or (subscription_row.expires_at is not null and subscription_row.expires_at < now()) then
    raise exception 'Votre abonnement ne permet pas de créer une facture.';
  end if;
  select count(*)::integer into invoice_count from public.invoices
   where business_id = p_business_id and issue_date >= month_start and issue_date < next_month and status <> 'CANCELLED';
  if invoice_count >= subscription_row.monthly_invoice_limit then
    raise exception 'La limite mensuelle de % factures est atteinte.', subscription_row.monthly_invoice_limit;
  end if;
  for item in select product_id, quantity, description from public.quote_items where quote_id = p_quote_id
  loop
    if item.product_id is not null and not exists (
      select 1 from public.products where id = item.product_id and business_id = p_business_id
    ) then raise exception 'Un produit de ce devis n’appartient plus à cette entreprise.'; end if;
  end loop;

  invoice_number := public.next_invoice_number(p_business_id, current_year);
  insert into public.invoices (
    business_id, client_id, invoice_number, currency, invoice_type,
    issue_date, due_date, status, subtotal, discount, tax, total
  ) values (
    p_business_id, quote_row.client_id, invoice_number, quote_row.currency, 'STANDARD',
    current_date, current_date + business_row.default_due_days, 'DRAFT',
    quote_row.subtotal, quote_row.discount, quote_row.tax, quote_row.total
  ) returning id into invoice_id;
  insert into public.invoice_items (invoice_id, product_id, description, quantity, unit_price)
  select invoice_id, product_id, description, quantity, unit_price
    from public.quote_items where quote_id = p_quote_id;
  update public.quotes
     set status = 'CONVERTED', converted_invoice_id = invoice_id
   where id = p_quote_id;
  return invoice_number;
end;
$$;

revoke all on function public.create_quote_with_lines(uuid, uuid, date, numeric, numeric, jsonb) from public, anon;
revoke all on function public.accept_quote_manually(uuid, uuid) from public, anon;
revoke all on function public.create_quote_share_link(uuid, uuid, text) from public, anon;
revoke all on function public.convert_accepted_quote_to_invoice(uuid, uuid) from public, anon;
revoke all on function public.load_public_quote(text) from public;
revoke all on function public.respond_to_public_quote(text, text, text, text, boolean, text) from public;
grant execute on function public.create_quote_with_lines(uuid, uuid, date, numeric, numeric, jsonb) to authenticated;
grant execute on function public.accept_quote_manually(uuid, uuid) to authenticated;
grant execute on function public.create_quote_share_link(uuid, uuid, text) to authenticated;
grant execute on function public.convert_accepted_quote_to_invoice(uuid, uuid) to authenticated;
grant execute on function public.load_public_quote(text) to anon, authenticated;
grant execute on function public.respond_to_public_quote(text, text, text, text, boolean, text) to anon, authenticated;
