begin;

do $$
declare
  table_name text;
  required_tables text[] := array[
    'suppliers', 'purchases', 'purchase_items', 'purchase_payments'
  ];
  required_functions text[] := array[
    'create_purchase_with_lines', 'register_purchase_payment'
  ];
  function_name text;
begin
  foreach table_name in array required_tables loop
    if to_regclass(format('public.%s', table_name)) is null then
      raise exception 'Table requise absente : public.%', table_name;
    end if;
    if not exists (
      select 1 from pg_class c
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
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = function_name
    ) then
      raise exception 'Fonction requise absente : public.%', function_name;
    end if;
  end loop;

  if to_regprocedure('public.create_purchase_with_lines(uuid,uuid,text,date,date,numeric,text,jsonb,uuid)') is null
    or to_regprocedure('public.register_purchase_payment(uuid,uuid,numeric,date,text,text,uuid)') is null then
    raise exception 'Signatures des RPC de facturation fournisseur incorrectes.';
  end if;
  if has_function_privilege('anon', 'public.create_purchase_with_lines(uuid,uuid,text,date,date,numeric,text,jsonb,uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.create_purchase_with_lines(uuid,uuid,text,date,date,numeric,text,jsonb,uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.register_purchase_payment(uuid,uuid,numeric,date,text,text,uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.register_purchase_payment(uuid,uuid,numeric,date,text,text,uuid)', 'EXECUTE') then
    raise exception 'Les droits d''exécution des RPC d''achat sont incorrects.';
  end if;

  if has_table_privilege('authenticated', 'public.purchases', 'INSERT')
    or has_table_privilege('authenticated', 'public.purchases', 'UPDATE')
    or has_table_privilege('authenticated', 'public.purchase_items', 'INSERT')
    or has_table_privilege('authenticated', 'public.purchase_payments', 'INSERT')
    or has_table_privilege('authenticated', 'public.purchase_payments', 'UPDATE') then
    raise exception 'Les achats ou règlements sont modifiables hors des RPC contrôlées.';
  end if;

  if has_column_privilege('authenticated', 'public.suppliers', 'business_id', 'UPDATE') then
    raise exception 'Le transfert d''un fournisseur entre entreprises est possible.';
  end if;
end
$$;

rollback;
