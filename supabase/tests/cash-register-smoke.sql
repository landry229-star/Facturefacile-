begin;

do $$
begin
  if to_regclass('public.cash_register_sales') is null then
    raise exception 'Table public.cash_register_sales absente.';
  end if;
  if not exists (
    select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'cash_register_sales'
       and c.relrowsecurity
  ) then raise exception 'RLS non activé sur cash_register_sales.'; end if;

  if has_table_privilege('authenticated', 'public.cash_register_sales', 'SELECT')
    or has_table_privilege('authenticated', 'public.cash_register_sales', 'INSERT')
    or has_table_privilege('authenticated', 'public.cash_register_sales', 'UPDATE')
    or has_table_privilege('authenticated', 'public.cash_register_sales', 'DELETE') then
    raise exception 'Les ventes de caisse sont modifiables hors du RPC contrôlé.';
  end if;

  if to_regprocedure('public.record_cash_register_sale(uuid,uuid,uuid,text,jsonb)') is null
    or has_function_privilege('anon', 'public.record_cash_register_sale(uuid,uuid,uuid,text,jsonb)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.record_cash_register_sale(uuid,uuid,uuid,text,jsonb)', 'EXECUTE') then
    raise exception 'Les droits du RPC de caisse sont incorrects.';
  end if;

  if to_regclass('public.clients_cash_register_walk_in_uidx') is null then
    raise exception 'L’index du client comptoir de caisse est absent.';
  end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'cash_register_sales'
       and column_name = 'request_fingerprint'
  ) then
    raise exception 'La vérification de contenu des clés anti-doublon est absente.';
  end if;

  if not exists (
    select 1
      from pg_indexes
     where schemaname = 'public'
       and tablename = 'cash_register_sales'
       and indexdef ilike '%unique%'
       and indexdef ilike '%business_id%'
       and indexdef ilike '%request_id%'
  ) then
    raise exception 'La clé anti-doublon des ventes de caisse est absente.';
  end if;
end
$$;

rollback;
