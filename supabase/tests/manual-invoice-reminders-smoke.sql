begin;

do $$
declare
  function_name text;
  required_functions text[] := array[
    'prepare_overdue_invoice_reminder',
    'update_manual_invoice_reminder_message',
    'mark_manual_invoice_reminder_sent'
  ];
begin
  if to_regclass('public.manual_invoice_reminders') is null then
    raise exception 'Table public.manual_invoice_reminders absente.';
  end if;
  if not exists (
    select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'manual_invoice_reminders'
       and c.relrowsecurity
  ) then raise exception 'RLS non activé sur manual_invoice_reminders.'; end if;

  foreach function_name in array required_functions loop
    if not exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = function_name
    ) then raise exception 'Fonction requise absente : public.%', function_name; end if;
  end loop;

  if to_regprocedure('public.prepare_overdue_invoice_reminder(uuid,uuid,uuid)') is null
    or to_regprocedure('public.update_manual_invoice_reminder_message(uuid,uuid,text)') is null
    or to_regprocedure('public.mark_manual_invoice_reminder_sent(uuid,uuid,text)') is null then
    raise exception 'Signature des RPC de relance incorrecte.';
  end if;
  if has_function_privilege('anon', 'public.prepare_overdue_invoice_reminder(uuid,uuid,uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.prepare_overdue_invoice_reminder(uuid,uuid,uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.update_manual_invoice_reminder_message(uuid,uuid,text)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.update_manual_invoice_reminder_message(uuid,uuid,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.mark_manual_invoice_reminder_sent(uuid,uuid,text)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.mark_manual_invoice_reminder_sent(uuid,uuid,text)', 'EXECUTE') then
    raise exception 'Les droits d''exécution des RPC de relance sont incorrects.';
  end if;
  if has_table_privilege('authenticated', 'public.manual_invoice_reminders', 'INSERT')
    or has_table_privilege('authenticated', 'public.manual_invoice_reminders', 'UPDATE')
    or has_table_privilege('authenticated', 'public.manual_invoice_reminders', 'DELETE') then
    raise exception 'Les relances sont modifiables hors des RPC contrôlées.';
  end if;

  if to_regclass('public.invoice_reminder_settings') is null then
    raise exception 'Table public.invoice_reminder_settings absente.';
  end if;
  if not exists (
    select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'invoice_reminder_settings'
       and c.relrowsecurity
  ) then raise exception 'RLS non activé sur invoice_reminder_settings.'; end if;
  if has_table_privilege('authenticated', 'public.invoice_reminder_settings', 'SELECT')
    or has_table_privilege('authenticated', 'public.invoice_reminder_settings', 'INSERT')
    or has_table_privilege('authenticated', 'public.invoice_reminder_settings', 'UPDATE')
    or has_table_privilege('authenticated', 'public.invoice_reminder_settings', 'DELETE') then
    raise exception 'Les paramètres d’automatisation sont accessibles directement.';
  end if;
  if not has_table_privilege('service_role', 'public.invoice_reminder_settings', 'SELECT')
    or not has_table_privilege('service_role', 'public.manual_invoice_reminders', 'SELECT') then
    raise exception 'Le worker ne peut pas lire les paramètres et l’historique manuel.';
  end if;
  if not has_table_privilege('service_role', 'public.invoice_reminders', 'INSERT')
    or not has_table_privilege('service_role', 'public.invoice_reminders', 'DELETE')
    or not has_table_privilege('service_role', 'public.invoice_communications', 'INSERT') then
    raise exception 'Les droits du worker pour la réservation et l’historique des envois sont incorrects.';
  end if;
  if to_regprocedure('public.get_overdue_reminders_enabled(uuid)') is null
    or to_regprocedure('public.set_overdue_reminders_enabled(uuid,boolean)') is null
    or has_function_privilege('anon', 'public.get_overdue_reminders_enabled(uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.set_overdue_reminders_enabled(uuid,boolean)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.get_overdue_reminders_enabled(uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.set_overdue_reminders_enabled(uuid,boolean)', 'EXECUTE') then
    raise exception 'Les droits des RPC de configuration automatique sont incorrects.';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'invoice_reminder_settings'
      and column_name = 'enabled'
      and column_default in ('false', 'false::boolean')
  ) then
    raise exception 'Les relances automatiques ne sont pas désactivées par défaut.';
  end if;
end
$$;

rollback;
