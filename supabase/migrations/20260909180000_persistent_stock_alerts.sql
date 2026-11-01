create table if not exists public.business_notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  type text not null,
  alert_key text not null,
  title text not null,
  message text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  product_id uuid references public.products(id) on delete cascade,
  read_at timestamptz,
  archived_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, alert_key)
);

create index if not exists business_notifications_business_idx
  on public.business_notifications (business_id, active, created_at desc);

alter table public.business_notifications enable row level security;

create policy "business members read notifications"
on public.business_notifications for select
using (public.is_business_member(business_id, 'viewer'));

create or replace function public.mark_business_notification_read(
  p_business_id uuid,
  p_notification_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_business_member(p_business_id, 'viewer') then
    raise exception 'Entreprise non autorisée.';
  end if;
  update public.business_notifications
  set read_at = coalesce(read_at, now()), updated_at = now()
  where id = p_notification_id and business_id = p_business_id and active = true;
end;
$$;

revoke all on function public.mark_business_notification_read(uuid, uuid) from public, anon;
grant execute on function public.mark_business_notification_read(uuid, uuid) to authenticated;

create or replace function public.sync_product_stock_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  alert_key text := 'stock:' || new.id::text;
  is_low boolean := new.product_type = 'product' and new.stock_quantity <= new.low_stock_threshold;
begin
  if is_low then
    insert into public.business_notifications (
      business_id, type, alert_key, title, message, severity, product_id,
      read_at, archived_at, active, updated_at
    )
    values (
      new.business_id, 'stock', alert_key,
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
    where n.business_id = new.business_id and n.alert_key = alert_key and n.active = true;
  end if;
  return new;
end;
$$;

drop trigger if exists products_stock_alert_trigger on public.products;
create trigger products_stock_alert_trigger
after insert or update of stock_quantity, low_stock_threshold, product_type, name
on public.products
for each row execute function public.sync_product_stock_alert();

revoke all on function public.sync_product_stock_alert() from public, anon, authenticated;

update public.products
set updated_at = updated_at
where product_type = 'product';
