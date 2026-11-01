alter table public.recurring_invoices
  add column if not exists consecutive_failures integer not null default 0
    check (consecutive_failures between 0 and 3),
  add column if not exists last_error text,
  add column if not exists retry_at timestamptz,
  add column if not exists failure_suspended boolean not null default false,
  add column if not exists last_attempt_at timestamptz;

alter table public.recurring_invoice_runs
  drop constraint if exists recurring_invoice_runs_status_check,
  add column if not exists attempt_number integer not null default 1
    check (attempt_number > 0),
  add constraint recurring_invoice_runs_status_check
    check (status in ('issued', 'skipped_stock', 'skipped_subscription', 'failed'));

create index if not exists recurring_invoices_retry_idx
  on public.recurring_invoices (retry_at, next_issue_date)
  where active = true and failure_suspended = false;

create or replace function public.run_recurring_invoice(p_recurring_invoice_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recurring public.recurring_invoices;
  product_row public.products;
  subscription_row public.business_subscriptions;
  invoice_id uuid;
  invoice_number text;
  invoice_count integer;
  next_date date;
  failure_message text;
  next_failure_count integer;
begin
  select * into recurring
  from public.recurring_invoices
  where id = p_recurring_invoice_id
  for update;
  if not found
    or not recurring.active
    or recurring.next_issue_date > current_date
    or (recurring.retry_at is not null and recurring.retry_at > now()) then
    return false;
  end if;

  next_date := case recurring.frequency
    when 'weekly' then recurring.next_issue_date + 7
    when 'monthly' then (recurring.next_issue_date + interval '1 month')::date
    when 'quarterly' then (recurring.next_issue_date + interval '3 months')::date
    when 'yearly' then (recurring.next_issue_date + interval '1 year')::date
  end;

  begin
    select * into product_row
    from public.products
    where id = recurring.product_id and business_id = recurring.business_id
    for update;
    if not found then
      raise exception 'Le produit ou service associé à cette récurrence est introuvable.';
    end if;

    select * into subscription_row
    from public.business_subscriptions
    where business_id = recurring.business_id
    for update;

    if not found
      or subscription_row.plan not in ('starter', 'pro', 'business')
      or subscription_row.status not in ('active', 'trialing')
      or (subscription_row.expires_at is not null and subscription_row.expires_at <= now()) then
      raise exception 'Abonnement gratuit, inactif, expiré ou non configuré.';
    end if;

    select count(*)::integer into invoice_count
    from public.invoices
    where business_id = recurring.business_id
      and issue_date >= date_trunc('month', recurring.next_issue_date)::date
      and issue_date < (date_trunc('month', recurring.next_issue_date) + interval '1 month')::date
      and status <> 'CANCELLED';

    if invoice_count >= subscription_row.monthly_invoice_limit then
      insert into public.recurring_invoice_runs (
        recurring_invoice_id, business_id, issue_date, status, message, attempt_number
      ) values (
        recurring.id, recurring.business_id, recurring.next_issue_date,
        'skipped_subscription', format('Limite mensuelle de %s factures atteinte.', subscription_row.monthly_invoice_limit), 1
      );
      update public.recurring_invoices
      set next_issue_date = next_date, consecutive_failures = 0,
          last_error = null, retry_at = null, failure_suspended = false,
          last_attempt_at = now()
      where id = recurring.id;
      return false;
    end if;

    if product_row.product_type = 'product' and product_row.stock_quantity < 1 then
      raise exception 'Stock insuffisant pour générer la facture.';
    end if;

    invoice_number := public.next_invoice_number(
      recurring.business_id,
      extract(year from recurring.next_issue_date)::integer
    );
    insert into public.invoices (
      business_id, client_id, invoice_number, issue_date, due_date,
      status, subtotal, total
    ) values (
      recurring.business_id, recurring.client_id, invoice_number,
      recurring.next_issue_date, recurring.next_issue_date + recurring.due_days,
      'SENT', product_row.price, product_row.price
    ) returning id into invoice_id;

    insert into public.invoice_items (
      invoice_id, product_id, description, quantity, unit_price
    ) values (
      invoice_id, recurring.product_id, product_row.name, 1, product_row.price
    );

    if product_row.product_type = 'product' then
      update public.products
      set stock_quantity = stock_quantity - 1, updated_at = now()
      where id = recurring.product_id
        and business_id = recurring.business_id
        and stock_quantity >= 1;

      if not found then
        raise exception 'Stock insuffisant pour la récurrence %', recurring.id;
      end if;

      insert into public.stock_movements (
        business_id, product_id, quantity, movement_type, note
      ) values (
        recurring.business_id, recurring.product_id, -1, 'out',
        format('Vente récurrente liée à %s', invoice_number)
      );
    end if;

    update public.recurring_invoices
    set next_issue_date = next_date,
        last_issued_date = recurring.next_issue_date,
        consecutive_failures = 0,
        last_error = null,
        retry_at = null,
        failure_suspended = false,
        last_attempt_at = now()
    where id = recurring.id;

    insert into public.recurring_invoice_runs (
      recurring_invoice_id, business_id, issue_date, status, invoice_id, message, attempt_number
    ) values (
      recurring.id, recurring.business_id, recurring.next_issue_date,
      'issued', invoice_id, 'Facture générée automatiquement.', recurring.consecutive_failures + 1
    );
    return true;
  exception when others then
    get stacked diagnostics failure_message = message_text;
  end;

  next_failure_count := recurring.consecutive_failures + 1;
  update public.recurring_invoices
  set consecutive_failures = next_failure_count,
      last_error = left(failure_message, 1000),
      retry_at = case when next_failure_count >= 3 then null else now() + interval '1 day' end,
      failure_suspended = next_failure_count >= 3,
      active = case when next_failure_count >= 3 then false else active end,
      last_attempt_at = now()
  where id = recurring.id;

  insert into public.recurring_invoice_runs (
    recurring_invoice_id, business_id, issue_date, status, message, attempt_number
  ) values (
    recurring.id, recurring.business_id, recurring.next_issue_date,
    'failed',
    case when next_failure_count >= 3
      then format('Suspension après %s échecs. %s', next_failure_count, left(failure_message, 900))
      else format('Nouvelle tentative prévue après environ 24 heures (%s/3). %s', next_failure_count, left(failure_message, 850))
    end,
    next_failure_count
  );
  return false;
end;
$$;

revoke all on function public.run_recurring_invoice(uuid) from public, anon, authenticated;

create or replace function public.process_due_recurring_invoices()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  recurring_id uuid;
  issued_count integer := 0;
begin
  perform pg_advisory_xact_lock(hashtext('facturefacile:recurring-invoices'));

  for recurring_id in
    select id
    from public.recurring_invoices
    where active = true
      and failure_suspended = false
      and next_issue_date <= current_date
      and (retry_at is null or retry_at <= now())
    order by next_issue_date, created_at
  loop
    if public.run_recurring_invoice(recurring_id) then
      issued_count := issued_count + 1;
    end if;
  end loop;
  return issued_count;
end;
$$;

revoke all on function public.process_due_recurring_invoices() from public, anon, authenticated;
grant execute on function public.process_due_recurring_invoices() to service_role;

create or replace function public.retry_recurring_invoice(
  p_business_id uuid,
  p_recurring_invoice_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recurring public.recurring_invoices;
  issued boolean;
begin
  if auth.uid() is null or not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;
  if not public.has_active_business_subscription(p_business_id, array['starter', 'pro', 'business']) then
    raise exception 'Un abonnement actif est requis pour relancer une facture récurrente.';
  end if;

  perform pg_advisory_xact_lock(hashtext('facturefacile:recurring-invoices'));
  select * into recurring
  from public.recurring_invoices
  where id = p_recurring_invoice_id and business_id = p_business_id
  for update;
  if not found then
    raise exception 'Récurrence introuvable.';
  end if;
  if recurring.consecutive_failures = 0 or recurring.failure_suspended = false and recurring.last_error is null then
    raise exception 'Aucun échec à relancer pour cette récurrence.';
  end if;
  if recurring.next_issue_date > current_date then
    raise exception 'Cette échéance n’est pas encore arrivée.';
  end if;

  update public.recurring_invoices
  set active = true,
      failure_suspended = false,
      consecutive_failures = 0,
      retry_at = null
  where id = recurring.id;

  issued := public.run_recurring_invoice(recurring.id);
  return issued;
end;
$$;

revoke all on function public.retry_recurring_invoice(uuid, uuid) from public, anon;
grant execute on function public.retry_recurring_invoice(uuid, uuid) to authenticated;

create or replace function public.notify_recurring_invoice_run()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  suspended boolean;
begin
  if new.status = 'failed' then
    select failure_suspended into suspended
    from public.recurring_invoices
    where id = new.recurring_invoice_id;
  end if;

  insert into public.business_notifications (
    business_id, type, alert_key, title, message, severity
  )
  values (
    new.business_id,
    'recurring_invoice',
    'recurring-run:' || new.id::text,
    case
      when new.status = 'issued' then 'Facture récurrente générée'
      when new.status = 'failed' and coalesce(suspended, false) then 'Récurrence suspendue après plusieurs échecs'
      when new.status = 'failed' then 'Échec de facture récurrente : nouvelle tentative prévue'
      when new.status = 'skipped_stock' then 'Facture récurrente ignorée : stock insuffisant'
      else 'Facture récurrente ignorée : abonnement ou limite'
    end,
    format(
      'Échéance du %s · tentative %s. %s',
      to_char(new.issue_date, 'DD/MM/YYYY'),
      new.attempt_number,
      coalesce(new.message, 'Aucun détail fourni.')
    ),
    case
      when new.status = 'issued' then 'info'
      when new.status = 'failed' and coalesce(suspended, false) then 'critical'
      when new.status = 'failed' then 'warning'
      else 'warning'
    end
  )
  on conflict (business_id, alert_key) do update
    set title = excluded.title,
        message = excluded.message,
        severity = excluded.severity,
        active = true,
        archived_at = null,
        read_at = null,
        updated_at = now();

  return new;
end;
$$;

revoke all on function public.notify_recurring_invoice_run() from public, anon, authenticated;
