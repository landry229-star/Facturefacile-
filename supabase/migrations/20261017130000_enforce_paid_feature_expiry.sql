create or replace function public.has_active_business_subscription(
  p_business_id uuid,
  p_allowed_plans text[]
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_business_member(p_business_id, 'viewer')
    and exists (
      select 1
      from public.business_subscriptions
      where business_id = p_business_id
        and plan = any(p_allowed_plans)
        and status in ('active', 'trialing')
        and (expires_at is null or expires_at > now())
    );
$$;

revoke all on function public.has_active_business_subscription(uuid, text[]) from public, anon;
grant execute on function public.has_active_business_subscription(uuid, text[]) to authenticated;

create or replace function public.apply_stock_movement(
  p_business_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_movement_type text,
  p_note text default null
)
returns table (
  movement_id uuid,
  previous_stock numeric,
  new_stock numeric
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  product_row public.products%rowtype;
  delta numeric;
  v_movement_id uuid;
  v_previous_stock numeric;
  v_new_stock numeric;
begin
  if not public.is_business_member(p_business_id, 'member')
    or lower(coalesce(auth.jwt()->>'email', '')) <> 'azoganlandry3@gmail.com' then
    raise exception 'Les factures récurrentes sont disponibles uniquement pour le compte de démonstration Dossou.';
  end if;
  if not public.has_active_business_subscription(p_business_id, array['starter', 'pro', 'business']) then
    raise exception 'La gestion du stock nécessite un abonnement payant actif.';
  end if;

  if p_product_id is null or p_quantity is null or p_quantity < 0
     or (p_movement_type in ('in', 'out') and p_quantity = 0) then
    raise exception 'La quantité doit être positive, sauf pour un ajustement à zéro.';
  end if;
  if p_movement_type not in ('in', 'out', 'adjustment') then
    raise exception 'Type de mouvement invalide.';
  end if;

  select *
  into product_row
  from public.products
  where id = p_product_id
    and business_id = p_business_id
    and product_type = 'product'
  for update;

  if not found then
    raise exception 'Produit non autorisé ou non stockable.';
  end if;

  delta := case
    when p_movement_type = 'in' then p_quantity
    when p_movement_type = 'out' then -p_quantity
    else p_quantity - product_row.stock_quantity
  end;

  if product_row.stock_quantity + delta < 0 then
    raise exception 'Le stock ne peut pas être négatif.';
  end if;

  update public.products
  set stock_quantity = product_row.stock_quantity + delta,
      updated_at = now()
  where id = product_row.id;

  insert into public.stock_movements (
    business_id, product_id, quantity, movement_type, note,
    previous_stock, new_stock, created_by
  )
  values (
    p_business_id, product_row.id, delta, p_movement_type, nullif(trim(p_note), ''),
    product_row.stock_quantity, product_row.stock_quantity + delta, auth.uid()
  )
  returning stock_movements.id, stock_movements.previous_stock, stock_movements.new_stock
  into v_movement_id, v_previous_stock, v_new_stock;

  movement_id := v_movement_id;
  previous_stock := v_previous_stock;
  new_stock := v_new_stock;
  return next;
end;
$$;

revoke all on function public.apply_stock_movement(uuid, uuid, numeric, text, text) from public, anon;
grant execute on function public.apply_stock_movement(uuid, uuid, numeric, text, text) to authenticated;

create or replace function public.enforce_subscription_member_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_members integer;
  member_limit integer;
begin
  if exists (
    select 1
    from public.business_members
    where business_id = new.business_id
      and user_id = new.user_id
  ) then
    return new;
  end if;

  select case plan
    when 'pro' then 5
    when 'business' then 25
    else 0
  end
  into member_limit
  from public.business_subscriptions
  where business_id = new.business_id
    and status in ('active', 'trialing')
    and (expires_at is null or expires_at > now());

  if coalesce(member_limit, 0) = 0 then
    raise exception 'L’accès à l’équipe nécessite un abonnement Pro ou Business actif.';
  end if;

  select count(*)::integer
  into current_members
  from public.business_members
  where business_id = new.business_id;

  if current_members >= member_limit then
    raise exception 'La limite de % utilisateur(s) de votre abonnement est atteinte.', member_limit;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_subscription_member_limit on public.business_members;
create trigger enforce_subscription_member_limit
before insert on public.business_members
for each row execute function public.enforce_subscription_member_limit();

revoke all on function public.enforce_subscription_member_limit() from public, anon;

create or replace function public.create_recurring_invoice(
  p_business_id uuid,
  p_client_id uuid,
  p_product_id uuid,
  p_frequency text,
  p_next_issue_date date,
  p_due_days integer
)
returns public.recurring_invoices
language plpgsql
security invoker
set search_path = public
as $$
declare
  created_recurring public.recurring_invoices;
begin
  if not public.is_business_member(p_business_id, 'member') then
    raise exception 'Entreprise non autorisée.';
  end if;
  if not public.has_active_business_subscription(p_business_id, array['starter', 'pro', 'business']) then
    raise exception 'Les factures récurrentes nécessitent un abonnement payant actif.';
  end if;

  insert into public.recurring_invoices (
    business_id, client_id, product_id, frequency, next_issue_date, due_days
  )
  values (
    p_business_id, p_client_id, p_product_id, p_frequency, p_next_issue_date, p_due_days
  )
  returning * into created_recurring;

  return created_recurring;
end;
$$;

revoke all on function public.create_recurring_invoice(uuid, uuid, uuid, text, date, integer) from public, anon;
grant execute on function public.create_recurring_invoice(uuid, uuid, uuid, text, date, integer) to authenticated;

notify pgrst, 'reload schema';
