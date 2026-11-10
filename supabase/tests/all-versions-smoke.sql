-- Smoke test automatisé des Versions 1 à 8.
-- Il vérifie le contrat de base sans créer, modifier ou supprimer de données.
-- Exécution : supabase test db

begin;

do $$
declare
  table_name text;
  function_name text;
  required_tables text[] := array[
    'businesses', 'clients', 'products', 'stock_movements',
    'invoices', 'invoice_items', 'payments', 'expenses',
    'recurring_invoices', 'recurring_invoice_runs', 'invoice_counters',
    'audit_logs', 'business_members', 'business_invitations',
    'business_subscriptions', 'subscription_payments', 'invoice_reminders',
    'invoice_communications', 'ai_assistant_daily_usage'
  ];
  required_functions text[] := array[
    'write_audit_log', 'next_invoice_number', 'create_invoice_with_lines',
    'snapshot_invoice_fiscal_regime',
    'process_due_recurring_invoices', 'is_business_member',
    'retry_recurring_invoice',
    'is_business_owner', 'get_business_role', 'update_business_subscription',
    'has_active_business_subscription', 'accept_business_invitation', 'cancel_business_invitation',
    'remove_business_member', 'complete_kkiapay_subscription_payment',
    'log_invoice_email_attempt', 'set_expense_receipt_path',
    'save_benin_invoice_metadata',
    'consume_ai_assistant_quota', 'mfa_requirement_satisfied',
    'list_my_support_tickets', 'submit_public_support_request', 'reply_my_support_ticket'
  ];
begin
  foreach table_name in array required_tables loop
    if to_regclass(format('public.%s', table_name)) is null then
      raise exception 'Table requise absente : public.%', table_name;
    end if;
  end loop;

  foreach table_name in array required_tables loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = table_name
        and c.relrowsecurity
    ) then
      raise exception 'RLS non activé sur public.%', table_name;
    end if;
  end loop;

  foreach function_name in array required_functions loop
    if not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = function_name
    ) then
      raise exception 'Fonction requise absente : public.%', function_name;
    end if;
  end loop;

  if not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'products'
      and c.column_name in ('stock_quantity', 'low_stock_threshold')
    group by c.table_schema, c.table_name
    having count(*) = 2
  ) then
    raise exception 'Colonnes de stock absentes.';
  end if;

  if not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'businesses'
      and c.column_name in (
        'default_due_days', 'default_tax_rate', 'currency', 'timezone',
        'invoice_number_prefix', 'invoice_number_include_year', 'invoice_number_sequence_width'
      )
    group by c.table_schema, c.table_name
    having count(*) = 7
  ) then
    raise exception 'Préférences de facturation, fuseau horaire ou format de numérotation absents.';
  end if;

  if not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'invoices'
      and c.column_name = 'currency'
  ) then
    raise exception 'Instantané de devise des factures absent.';
  end if;

  if not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'businesses'
      and c.column_name in ('payment_instructions', 'invoice_legal_notice')
    group by c.table_schema, c.table_name
    having count(*) = 2
  ) then
    raise exception 'Modalités de règlement ou mentions de facture absentes.';
  end if;

  if not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'expenses'
      and c.column_name in ('supplier_name', 'payment_method', 'receipt_path')
    group by c.table_schema, c.table_name
    having count(*) = 3
  ) then
    raise exception 'Champs fournisseur, paiement ou justificatif des dépenses absents.';
  end if;

  if not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'recurring_invoices'
      and c.column_name in ('consecutive_failures', 'last_error', 'retry_at', 'failure_suspended', 'last_attempt_at')
    group by c.table_schema, c.table_name
    having count(*) = 5
  ) then
    raise exception 'Colonnes de politique d''échec des factures récurrentes absentes.';
  end if;

  if not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'recurring_invoice_runs'
      and c.column_name = 'attempt_number'
  ) then
    raise exception 'Historique des tentatives de factures récurrentes absent.';
  end if;

  if position(
    'Une exécution non échouée existe déjà pour cette échéance.'
    in pg_get_functiondef('public.retry_recurring_invoice(uuid,uuid)'::regprocedure)
  ) = 0 then
    raise exception 'La reprise manuelle des échéances ne protège pas contre une exécution existante.';
  end if;

  if not exists (
    select 1 from storage.buckets
    where id = 'expense-receipts' and public = false
  ) then
    raise exception 'Bucket privé des justificatifs de dépenses absent.';
  end if;

  if not exists (
    select 1 from storage.buckets
    where id = 'user-profile-photos' and public = true
      and file_size_limit = 2097152
  ) then
    raise exception 'Bucket des photos de profil absent ou mal configuré.';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'invoice_reminders_invoice_date_type_idx'
  ) then
    raise exception 'Protection anti-doublon des relances absente.';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'audit_invoices'
      and tgrelid = 'public.invoices'::regclass
  ) then
    raise exception 'Trigger d''audit des factures absent.';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'invoices'
      and policyname = 'require aal2 when mfa enrolled'
      and permissive = 'RESTRICTIVE'
      and cmd = 'ALL'
  ) then
    raise exception 'La règle MFA obligatoire côté base de données est absente des factures.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'audit_logs'
      and column_name = 'changed_fields'
  ) then
    raise exception 'Historique des champs modifiés absent.';
  end if;

  if to_regprocedure('public.list_business_audit_logs(uuid,text,text,text,date,date)') is null then
    raise exception 'Lecture filtrable du journal avec acteur absente.';
  end if;

  if to_regprocedure('public.save_benin_invoice_metadata(uuid,uuid,text,text,text,text,text)') is null then
    raise exception 'Saisie manuelle des métadonnées fiscales sur une facture absente.';
  end if;
  if has_function_privilege('anon', 'public.save_benin_invoice_metadata(uuid,uuid,text,text,text,text,text)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.save_benin_invoice_metadata(uuid,uuid,text,text,text,text,text)', 'EXECUTE') then
    raise exception 'Les droits d''exécution de la saisie fiscale manuelle sont incorrects.';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_logs'
      and cmd in ('DELETE', 'ALL')
  ) or has_table_privilege('authenticated', 'public.audit_logs', 'DELETE') then
    raise exception 'La suppression directe du journal d''audit est possible hors RPC contrôlée.';
  end if;

  if to_regclass('public.audit_log_maintenance') is null
    or to_regprocedure('public.delete_business_audit_log(uuid,uuid)') is null then
    raise exception 'Suppression confirmée du journal et traçabilité de maintenance absentes.';
  end if;

  if has_table_privilege('authenticated', 'public.audit_log_maintenance', 'SELECT')
    or has_table_privilege('authenticated', 'public.audit_log_maintenance', 'INSERT') then
    raise exception 'Le journal de maintenance est accessible directement aux utilisateurs.';
  end if;

  if has_table_privilege('authenticated', 'public.ai_assistant_daily_usage', 'SELECT')
    or has_table_privilege('authenticated', 'public.ai_assistant_daily_usage', 'INSERT')
    or has_table_privilege('authenticated', 'public.ai_assistant_daily_usage', 'UPDATE')
    or has_table_privilege('authenticated', 'public.ai_assistant_daily_usage', 'DELETE')
    or has_function_privilege('authenticated', 'public.consume_ai_assistant_quota(uuid,integer)', 'EXECUTE') then
    raise exception 'Les compteurs ou RPC de quota IA sont directement accessibles aux utilisateurs.';
  end if;

  if not has_table_privilege('service_role', 'public.ai_assistant_daily_usage', 'SELECT')
    or not has_table_privilege('service_role', 'public.ai_assistant_daily_usage', 'INSERT')
    or not has_function_privilege('service_role', 'public.consume_ai_assistant_quota(uuid,integer)', 'EXECUTE') then
    raise exception 'Le service IA ne peut pas appliquer le quota.';
  end if;
end
$$;

rollback;
