do $$
declare
  function_definition text;
  original_statement text := E'update public.purchase_items\n       set received_quantity = received_quantity + quantity\n     where id = item_row.id\n       and purchase_id = p_purchase_id;';
  corrected_statement text := E'update public.purchase_items pi\n       set received_quantity = pi.received_quantity + (line->>''quantity'')::numeric\n     where pi.id = item_row.id\n       and pi.purchase_id = p_purchase_id;';
begin
  select pg_get_functiondef(
    'public.apply_purchase_receipt(uuid, uuid, date, jsonb, uuid)'::regprocedure
  )
    into function_definition;

  if position(original_statement in function_definition) = 0 then
    raise exception 'Could not find the expected purchase receipt quantity update.';
  end if;

  execute replace(function_definition, original_statement, corrected_statement);
end;
$$;

notify pgrst, 'reload schema';
