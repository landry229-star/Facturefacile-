-- Test automatisé du socle Version 8.
-- À exécuter après les migrations avec :
-- supabase test db

begin;

do $$
begin
  if to_regclass('public.invoice_reminders') is null then
    raise exception 'La table public.invoice_reminders est absente.';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'invoice_reminders'
      and indexname = 'invoice_reminders_invoice_date_type_idx'
  ) then
    raise exception 'L''index anti-doublon invoice_reminders_invoice_date_type_idx est absent.';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'invoice_reminders'
      and policyname = 'owners and members can read invoice reminders'
  ) then
    raise exception 'La policy de lecture des relances est absente.';
  end if;

  if not exists (
    select 1
    from pg_proc
    where proname = 'write_audit_log'
      and pronamespace = 'public'::regnamespace
  ) then
    raise exception 'La fonction d''audit est absente.';
  end if;
end
$$;

rollback;
