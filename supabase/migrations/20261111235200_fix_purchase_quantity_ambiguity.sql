do $$
declare
  function_definition text;
  original_receipt_statement text := E'update public.purchase_items\n       set received_quantity = received_quantity + quantity\n     where id = item_row.id\n       and purchase_id = p_purchase_id;';
  corrected_receipt_statement text := E'update public.purchase_items pi\n       set received_quantity = pi.received_quantity + (line->>''quantity'')::numeric\n     where pi.id = item_row.id\n       and pi.purchase_id = p_purchase_id;';
  original_return_statement text := E'update public.purchase_items\n       set returned_quantity = returned_quantity + quantity\n     where id = item_row.id\n       and purchase_id = p_purchase_id;';
  corrected_return_statement text := E'update public.purchase_items pi\n       set returned_quantity = pi.returned_quantity + (line->>''quantity'')::numeric\n     where pi.id = item_row.id\n       and pi.purchase_id = p_purchase_id;';
begin
  select pg_get_functiondef(
    'public.apply_purchase_receipt(uuid, uuid, date, jsonb, uuid)'::regprocedure
  )
    into function_definition;

  if position(original_receipt_statement in function_definition) > 0 then
    execute replace(function_definition, original_receipt_statement, corrected_receipt_statement);
  elsif position(corrected_receipt_statement in function_definition) = 0 then
    raise exception 'Could not find the expected purchase receipt quantity update.';
  end if;

  select pg_get_functiondef(
    'public.return_purchase_items(uuid, uuid, date, text, jsonb, uuid)'::regprocedure
  )
    into function_definition;

  if position(original_return_statement in function_definition) > 0 then
    execute replace(function_definition, original_return_statement, corrected_return_statement);
  elsif position(corrected_return_statement in function_definition) = 0 then
    raise exception 'Could not find the expected purchase return quantity update.';
  end if;
end;
$$;

notify pgrst, 'reload schema';
