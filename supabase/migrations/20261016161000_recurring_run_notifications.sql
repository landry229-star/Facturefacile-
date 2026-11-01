create or replace function public.notify_recurring_invoice_run()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.business_notifications (
    business_id, type, alert_key, title, message, severity
  )
  values (
    new.business_id,
    'recurring_invoice',
    'recurring-run:' || new.id::text,
    case new.status
      when 'issued' then 'Facture récurrente générée'
      when 'skipped_stock' then 'Facture récurrente ignorée : stock insuffisant'
      else 'Facture récurrente ignorée : abonnement ou limite'
    end,
    format(
      'Échéance du %s. %s',
      to_char(new.issue_date, 'DD/MM/YYYY'),
      coalesce(new.message, 'Aucun détail fourni.')
    ),
    case when new.status = 'issued' then 'info' else 'warning' end
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

drop trigger if exists recurring_invoice_run_notification on public.recurring_invoice_runs;
create trigger recurring_invoice_run_notification
after insert on public.recurring_invoice_runs
for each row execute function public.notify_recurring_invoice_run();

revoke all on function public.notify_recurring_invoice_run() from public, anon, authenticated;
