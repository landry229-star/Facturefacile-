create or replace function public.sync_product_stock_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alert_key text := 'stock:' || new.id::text;
  is_low boolean := new.product_type = 'product' and new.stock_quantity <= new.low_stock_threshold;
begin
  if is_low then
    insert into public.business_notifications (
      business_id, type, alert_key, title, message, severity, product_id,
      read_at, archived_at, active, updated_at
    )
    values (
      new.business_id, 'stock', v_alert_key,
      case when new.stock_quantity <= 0 then 'Rupture de stock' else 'Stock faible' end,
      case when new.stock_quantity <= 0
        then 'Rupture de stock : ' || new.name || '.'
        else 'Stock faible : ' || new.name || ' (' || new.stock_quantity || ' restant(s)).'
      end,
      case when new.stock_quantity <= 0 then 'critical' else 'warning' end,
      new.id, null, null, true, now()
    )
    on conflict (business_id, alert_key) do update
      set title = excluded.title, message = excluded.message, severity = excluded.severity,
          active = true, archived_at = null, read_at = case
            when business_notifications.active = false then null
            else business_notifications.read_at
          end, updated_at = now();
  else
    update public.business_notifications as n
    set active = false, updated_at = now()
    where n.business_id = new.business_id
      and n.alert_key = v_alert_key
      and n.active = true;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_product_stock_alert() from public, anon, authenticated;
