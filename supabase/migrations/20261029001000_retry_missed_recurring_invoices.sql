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
  if recurring.next_issue_date > current_date then
    raise exception 'Cette échéance n’est pas encore arrivée.';
  end if;
  if exists (
    select 1
    from public.recurring_invoice_runs
    where recurring_invoice_id = recurring.id
      and issue_date = recurring.next_issue_date
      and status <> 'failed'
  ) then
    raise exception 'Une exécution non échouée existe déjà pour cette échéance.';
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
