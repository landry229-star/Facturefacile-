begin;

do $$
declare
  required_table_name text;
  required_tables text[] := array[
    'suppliers', 'purchases', 'purchase_items', 'purchase_payments',
    'purchase_receipts', 'purchase_receipt_items', 'purchase_returns',
    'purchase_return_items', 'purchase_activity_logs', 'purchase_documents',
    'purchase_activity_log_purges'
  ];
  required_functions text[] := array[
    'create_purchase_with_lines', 'register_purchase_payment',
    'reverse_purchase_payment', 'cancel_purchase', 'receive_purchase_items',
    'return_purchase_items', 'get_purchase_summary', 'get_purchase_page_ids',
    'can_manage_purchase', 'validate_purchase_document', 'update_unposted_purchase',
    'delete_purchase_activity_logs', 'get_purchase_status_counts'
  ];
  function_name text;
  receipt_function_definition text;
  return_function_definition text;
begin
  foreach required_table_name in array required_tables loop
    if to_regclass(format('public.%s', required_table_name)) is null then
      raise exception 'Table requise absente : public.%', required_table_name;
    end if;
    if not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = required_table_name
        and c.relrowsecurity
    ) then
      raise exception 'RLS non activé sur public.%', required_table_name;
    end if;
  end loop;

  foreach function_name in array required_functions loop
    if not exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = function_name
    ) then
      raise exception 'Fonction requise absente : public.%', function_name;
    end if;
  end loop;

  if to_regprocedure('public.create_purchase_with_lines(uuid,uuid,text,date,date,numeric,text,jsonb,uuid)') is null
    or to_regprocedure('public.register_purchase_payment(uuid,uuid,numeric,date,text,text,uuid)') is null
    or to_regprocedure('public.reverse_purchase_payment(uuid,uuid,date,text)') is null
    or to_regprocedure('public.cancel_purchase(uuid,uuid,text)') is null
    or to_regprocedure('public.receive_purchase_items(uuid,uuid,date,jsonb,uuid)') is null
    or to_regprocedure('public.return_purchase_items(uuid,uuid,date,text,jsonb,uuid)') is null
    or to_regprocedure('public.get_purchase_summary(uuid)') is null
    or to_regprocedure('public.get_purchase_page_ids(uuid,integer,integer,text,uuid,text,date,date)') is null
    or to_regprocedure('public.get_purchase_status_counts(uuid,text,uuid,date,date)') is null
    or to_regprocedure('public.can_manage_purchase(uuid,text)') is null
    or to_regprocedure('public.update_unposted_purchase(uuid,uuid,uuid,text,date,date,numeric,text,jsonb)') is null
    or to_regprocedure('public.delete_purchase_activity_logs(uuid,uuid[])') is null then
    raise exception 'Signatures des RPC fournisseur incorrectes.';
  end if;
  if has_function_privilege('anon', 'public.create_purchase_with_lines(uuid,uuid,text,date,date,numeric,text,jsonb,uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.create_purchase_with_lines(uuid,uuid,text,date,date,numeric,text,jsonb,uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.register_purchase_payment(uuid,uuid,numeric,date,text,text,uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.register_purchase_payment(uuid,uuid,numeric,date,text,text,uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.receive_purchase_items(uuid,uuid,date,jsonb,uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.receive_purchase_items(uuid,uuid,date,jsonb,uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.cancel_purchase(uuid,uuid,text)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.cancel_purchase(uuid,uuid,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.return_purchase_items(uuid,uuid,date,text,jsonb,uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.return_purchase_items(uuid,uuid,date,text,jsonb,uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.can_manage_purchase(uuid,text)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.can_manage_purchase(uuid,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.get_purchase_summary(uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.get_purchase_summary(uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.get_purchase_page_ids(uuid,integer,integer,text,uuid,text,date,date)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.get_purchase_page_ids(uuid,integer,integer,text,uuid,text,date,date)', 'EXECUTE')
    or has_function_privilege('anon', 'public.get_purchase_status_counts(uuid,text,uuid,date,date)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.get_purchase_status_counts(uuid,text,uuid,date,date)', 'EXECUTE')
    or has_function_privilege('anon', 'public.update_unposted_purchase(uuid,uuid,uuid,text,date,date,numeric,text,jsonb)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.update_unposted_purchase(uuid,uuid,uuid,text,date,date,numeric,text,jsonb)', 'EXECUTE')
    or has_function_privilege('anon', 'public.delete_purchase_activity_logs(uuid,uuid[])', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.delete_purchase_activity_logs(uuid,uuid[])', 'EXECUTE') then
    raise exception 'Les droits d''exécution des RPC fournisseur sont incorrects.';
  end if;
  if has_function_privilege('authenticated', 'public.apply_purchase_receipt(uuid,uuid,date,jsonb,uuid)', 'EXECUTE') then
    raise exception 'La fonction interne de réception est directement accessible aux utilisateurs.';
  end if;
  select pg_get_functiondef(
    'public.apply_purchase_receipt(uuid,uuid,date,jsonb,uuid)'::regprocedure
  )
    into receipt_function_definition;
  if position(
    'pi.received_quantity + (line->>''quantity'')::numeric'
    in receipt_function_definition
  ) = 0 then
    raise exception 'La mise à jour des quantités reçues utilise une référence ambiguë.';
  end if;
  select pg_get_functiondef(
    'public.return_purchase_items(uuid,uuid,date,text,jsonb,uuid)'::regprocedure
  )
    into return_function_definition;
  if position(
    'pi.returned_quantity + (line->>''quantity'')::numeric'
    in return_function_definition
  ) = 0 then
    raise exception 'La mise à jour des quantités retournées utilise une référence ambiguë.';
  end if;

  if has_table_privilege('authenticated', 'public.purchases', 'INSERT')
    or has_table_privilege('authenticated', 'public.purchases', 'UPDATE')
    or has_table_privilege('authenticated', 'public.purchase_items', 'INSERT')
    or has_table_privilege('authenticated', 'public.purchase_items', 'UPDATE')
    or has_table_privilege('authenticated', 'public.purchase_payments', 'INSERT')
    or has_table_privilege('authenticated', 'public.purchase_payments', 'UPDATE')
    or has_table_privilege('authenticated', 'public.purchase_receipts', 'INSERT')
    or has_table_privilege('authenticated', 'public.purchase_receipt_items', 'INSERT')
    or has_table_privilege('authenticated', 'public.purchase_returns', 'INSERT')
    or has_table_privilege('authenticated', 'public.purchase_return_items', 'INSERT')
    or has_table_privilege('authenticated', 'public.purchase_activity_logs', 'INSERT')
    or has_table_privilege('authenticated', 'public.purchase_activity_logs', 'DELETE')
    or has_table_privilege('authenticated', 'public.purchase_activity_log_purges', 'SELECT')
    or has_table_privilege('authenticated', 'public.purchase_activity_log_purges', 'INSERT') then
    raise exception 'Les achats ou règlements sont modifiables hors des RPC contrôlées.';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where information_schema.columns.table_schema = 'public'
       and information_schema.columns.table_name = 'purchase_items'
       and information_schema.columns.column_name = 'received_quantity'
  ) then
    raise exception 'Le suivi des quantités reçues est absent.';
  end if;
  if not exists (
    select 1 from information_schema.columns
     where information_schema.columns.table_schema = 'public'
       and information_schema.columns.table_name = 'purchase_items'
       and information_schema.columns.column_name = 'returned_quantity'
  ) then
    raise exception 'Le suivi des quantités retournées est absent.';
  end if;

  if has_column_privilege('authenticated', 'public.suppliers', 'business_id', 'UPDATE') then
    raise exception 'Le transfert d''un fournisseur entre entreprises est possible.';
  end if;

  if not exists (
    select 1 from pg_trigger
     where tgname = 'guard_purchase_write'
       and not tgisinternal
  ) or not exists (
    select 1 from pg_trigger
     where tgname = 'guard_purchase_payment_write'
       and not tgisinternal
  ) or not exists (
    select 1 from pg_trigger
     where tgname = 'log_business_member_purchase_activity'
       and not tgisinternal
  ) or not exists (
    select 1 from pg_trigger
     where tgname = 'validate_purchase_document'
       and not tgisinternal
  ) then
    raise exception 'Les garde-fous de permissions ou la traçabilité des rôles sont absents.';
  end if;
  if not exists (
    select 1 from storage.buckets
     where id = 'purchase-documents'
       and public is false
       and file_size_limit = 10485760
  ) then
    raise exception 'Le bucket privé des justificatifs fournisseurs est absent ou mal configuré.';
  end if;
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'purchase_documents'
       and policyname = 'purchase members read documents'
  ) or not exists (
    select 1 from pg_policies
     where schemaname = 'storage'
       and tablename = 'objects'
       and policyname = 'authorized users upload purchase documents'
  ) then
    raise exception 'Les policies RLS des justificatifs fournisseurs sont absentes.';
  end if;
end
$$;

rollback;
