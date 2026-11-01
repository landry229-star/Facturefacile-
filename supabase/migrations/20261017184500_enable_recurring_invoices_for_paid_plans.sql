drop policy if exists "demo owner reads recurring invoices" on public.recurring_invoices;
drop policy if exists "demo owner manages recurring invoices" on public.recurring_invoices;
drop policy if exists "team members read recurring invoices" on public.recurring_invoices;
drop policy if exists "team members manage recurring invoices" on public.recurring_invoices;
drop policy if exists "business owners manage recurring invoices" on public.recurring_invoices;
drop policy if exists "recurring_invoices_select_own_business" on public.recurring_invoices;
drop policy if exists "recurring_invoices_update_own_business" on public.recurring_invoices;

create policy "paid members read recurring invoices"
  on public.recurring_invoices
  for select
  using (
    public.is_business_member(business_id, 'viewer')
    and public.has_active_business_subscription(business_id, array['starter', 'pro', 'business'])
  );

create policy "paid members create recurring invoices"
  on public.recurring_invoices
  for insert
  with check (
    public.is_business_member(business_id, 'member')
    and public.has_active_business_subscription(business_id, array['starter', 'pro', 'business'])
  );

create policy "paid members update recurring invoices"
  on public.recurring_invoices
  for update
  using (
    public.is_business_member(business_id, 'member')
    and public.has_active_business_subscription(business_id, array['starter', 'pro', 'business'])
  )
  with check (
    public.is_business_member(business_id, 'member')
    and public.has_active_business_subscription(business_id, array['starter', 'pro', 'business'])
  );

create policy "paid members delete recurring invoices"
  on public.recurring_invoices
  for delete
  using (
    public.is_business_member(business_id, 'member')
    and public.has_active_business_subscription(business_id, array['starter', 'pro', 'business'])
  );

create or replace function public.create_recurring_invoice(
  p_business_id uuid,
  p_client_id uuid,
  p_product_id uuid,
  p_frequency text,
  p_next_issue_date date,
  p_due_days integer
)
returns public.recurring_invoices
language plpgsql
security invoker
set search_path = public
as $$
declare
  created_recurring public.recurring_invoices;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;
  if not public.has_active_business_subscription(p_business_id, array['starter', 'pro', 'business']) then
    raise exception 'Les factures récurrentes nécessitent un abonnement Starter, Pro ou Business actif.';
  end if;

  insert into public.recurring_invoices (
    business_id, client_id, product_id, frequency, next_issue_date, due_days
  )
  values (
    p_business_id, p_client_id, p_product_id, p_frequency, p_next_issue_date, p_due_days
  )
  returning * into created_recurring;

  return created_recurring;
end;
$$;

revoke all on function public.create_recurring_invoice(uuid, uuid, uuid, text, date, integer) from public, anon;
grant execute on function public.create_recurring_invoice(uuid, uuid, uuid, text, date, integer) to authenticated;

create or replace function public.process_due_recurring_invoices()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  recurring record;
  subscription_row record;
  invoice_id uuid;
  invoice_number text;
  processed integer := 0;
  invoice_count integer;
  next_date date;
begin
  perform pg_advisory_xact_lock(hashtext('facturefacile:recurring-invoices'));

  for recurring in
    select r.*, p.name as product_name, p.price as product_price, p.product_type, p.stock_quantity
    from public.recurring_invoices r
    join public.products p on p.id = r.product_id and p.business_id = r.business_id
    where r.active = true and r.next_issue_date <= current_date
    order by r.next_issue_date, r.created_at
  loop
    next_date := case recurring.frequency
      when 'weekly' then recurring.next_issue_date + 7
      when 'monthly' then (recurring.next_issue_date + interval '1 month')::date
      when 'quarterly' then (recurring.next_issue_date + interval '3 months')::date
      when 'yearly' then (recurring.next_issue_date + interval '1 year')::date
    end;

    select *
    into subscription_row
    from public.business_subscriptions
    where business_id = recurring.business_id
    for update;

    if not found
      or subscription_row.plan not in ('starter', 'pro', 'business')
      or subscription_row.status not in ('active', 'trialing')
      or (subscription_row.expires_at is not null and subscription_row.expires_at <= now()) then
      insert into public.recurring_invoice_runs (
        recurring_invoice_id, business_id, issue_date, status, message
      ) values (
        recurring.id, recurring.business_id, recurring.next_issue_date,
        'skipped_subscription', 'Abonnement gratuit, inactif, expiré ou non configuré.'
      );
      update public.recurring_invoices
      set next_issue_date = next_date
      where id = recurring.id;
      continue;
    end if;

    select count(*)::integer
    into invoice_count
    from public.invoices
    where business_id = recurring.business_id
      and issue_date >= date_trunc('month', recurring.next_issue_date)::date
      and issue_date < (date_trunc('month', recurring.next_issue_date) + interval '1 month')::date
      and status <> 'CANCELLED';

    if invoice_count >= subscription_row.monthly_invoice_limit then
      insert into public.recurring_invoice_runs (
        recurring_invoice_id, business_id, issue_date, status, message
      ) values (
        recurring.id, recurring.business_id, recurring.next_issue_date,
        'skipped_subscription', format('Limite mensuelle de %s factures atteinte.', subscription_row.monthly_invoice_limit)
      );
      update public.recurring_invoices
      set next_issue_date = next_date
      where id = recurring.id;
      continue;
    end if;

    if recurring.product_type = 'product' and recurring.stock_quantity < 1 then
      insert into public.recurring_invoice_runs (
        recurring_invoice_id, business_id, issue_date, status, message
      ) values (
        recurring.id, recurring.business_id, recurring.next_issue_date,
        'skipped_stock', 'Stock insuffisant pour générer la facture.'
      );
      update public.recurring_invoices
      set next_issue_date = next_date
      where id = recurring.id;
      continue;
    end if;

    invoice_number := public.next_invoice_number(recurring.business_id, extract(year from recurring.next_issue_date)::integer);
    insert into public.invoices (
      business_id, client_id, invoice_number, issue_date, due_date,
      status, subtotal, total
    ) values (
      recurring.business_id, recurring.client_id, invoice_number, recurring.next_issue_date,
      recurring.next_issue_date + recurring.due_days, 'SENT',
      recurring.product_price, recurring.product_price
    ) returning id into invoice_id;

    insert into public.invoice_items (
      invoice_id, product_id, description, quantity, unit_price
    ) values (
      invoice_id, recurring.product_id, recurring.product_name, 1, recurring.product_price
    );

    if recurring.product_type = 'product' then
      update public.products
      set stock_quantity = stock_quantity - 1, updated_at = now()
      where id = recurring.product_id and business_id = recurring.business_id and stock_quantity >= 1;

      if not found then
        raise exception 'Stock insuffisant pour la récurrence %', recurring.id;
      end if;

      insert into public.stock_movements (
        business_id, product_id, quantity, movement_type, note
      ) values (
        recurring.business_id, recurring.product_id, -1,
        'out', format('Vente récurrente liée à %s', invoice_number)
      );
    end if;

    update public.recurring_invoices
    set next_issue_date = next_date, last_issued_date = recurring.next_issue_date
    where id = recurring.id;

    insert into public.recurring_invoice_runs (
      recurring_invoice_id, business_id, issue_date, status, invoice_id, message
    ) values (
      recurring.id, recurring.business_id, recurring.next_issue_date,
      'issued', invoice_id, 'Facture générée automatiquement.'
    );

    processed := processed + 1;
  end loop;

  return processed;
end;
$$;

revoke all on function public.process_due_recurring_invoices() from public, anon, authenticated;
grant execute on function public.process_due_recurring_invoices() to service_role;

notify pgrst, 'reload schema';
