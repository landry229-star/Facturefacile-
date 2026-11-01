alter table public.businesses
  add column if not exists timezone text not null default 'Africa/Porto-Novo',
  add column if not exists invoice_number_prefix text not null default 'FAC',
  add column if not exists invoice_number_include_year boolean not null default true,
  add column if not exists invoice_number_sequence_width integer not null default 5;

alter table public.businesses
  drop constraint if exists businesses_timezone_check,
  drop constraint if exists businesses_invoice_number_prefix_check,
  drop constraint if exists businesses_invoice_number_sequence_width_check,
  add constraint businesses_timezone_check
    check (timezone in ('Africa/Porto-Novo', 'Africa/Abidjan', 'Africa/Lagos', 'UTC')),
  add constraint businesses_invoice_number_prefix_check
    check (invoice_number_prefix ~ '^[A-Z0-9][A-Z0-9-]{0,11}$'),
  add constraint businesses_invoice_number_sequence_width_check
    check (invoice_number_sequence_width between 3 and 8);

alter table public.invoice_counters
  drop constraint if exists invoice_counters_invoice_year_check,
  add constraint invoice_counters_invoice_year_check
    check (invoice_year between 0 and 9999);

create or replace function public.next_invoice_number(p_business_id uuid, p_invoice_year integer)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_number integer;
  counter_year integer;
  number_prefix text;
  include_year boolean;
  sequence_width integer;
  candidate text;
begin
  select invoice_number_prefix, invoice_number_include_year, invoice_number_sequence_width
    into number_prefix, include_year, sequence_width
    from public.businesses
   where id = p_business_id;

  if not found then
    raise exception 'Entreprise introuvable pour la numérotation.';
  end if;
  if p_invoice_year is null or p_invoice_year < 2000 or p_invoice_year > 9999 then
    raise exception 'Année de numérotation invalide.';
  end if;

  counter_year := case when include_year then p_invoice_year else 0 end;
  loop
    insert into public.invoice_counters (business_id, invoice_year, last_number)
    values (p_business_id, counter_year, 1)
    on conflict (business_id, invoice_year)
    do update set last_number = public.invoice_counters.last_number + 1
    returning last_number into next_number;

    candidate := number_prefix || '-' ||
      case when include_year then p_invoice_year::text || '-' else '' end ||
      lpad(next_number::text, sequence_width, '0');

    exit when not exists (
      select 1
        from public.invoices
       where business_id = p_business_id
         and invoice_number = candidate
    );
  end loop;

  return candidate;
end;
$$;

alter table public.invoices
  add column if not exists currency text not null default 'XOF';

alter table public.invoices
  drop constraint if exists invoices_currency_check,
  add constraint invoices_currency_check
    check (currency in ('XOF', 'EUR', 'USD'));

update public.invoices i
   set currency = coalesce(b.currency, 'XOF')
  from public.businesses b
 where i.business_id = b.id;

create or replace function public.set_invoice_currency_from_business()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select coalesce(currency, 'XOF')
    into new.currency
    from public.businesses
   where id = new.business_id;

  if not found then
    raise exception 'Entreprise introuvable pour la devise de la facture.';
  end if;
  return new;
end;
$$;

drop trigger if exists set_invoice_currency_from_business on public.invoices;
create trigger set_invoice_currency_from_business
before insert on public.invoices
for each row execute function public.set_invoice_currency_from_business();
