create table if not exists public.purchase_activity_log_purges (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  deleted_by uuid references auth.users(id) on delete set null,
  deleted_count integer not null check (deleted_count > 0),
  created_at timestamptz not null default now()
);

alter table public.purchase_activity_log_purges enable row level security;
revoke all on public.purchase_activity_log_purges from public, anon, authenticated;

create or replace function public.delete_purchase_activity_logs(
  p_business_id uuid,
  p_activity_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested_count integer;
  deleted_count integer;
begin
  if auth.uid() is null
    or not public.can_manage_purchase(p_business_id, 'manage_suppliers') then
    raise exception 'Seuls le propriétaire ou un administrateur peuvent supprimer l’historique des achats.';
  end if;

  if p_activity_ids is null
    or cardinality(p_activity_ids) = 0
    or cardinality(p_activity_ids) > 50
    or array_position(p_activity_ids, null) is not null then
    raise exception 'Sélectionnez entre 1 et 50 actions valides.';
  end if;

  select count(distinct selected.id)
    into requested_count
    from unnest(p_activity_ids) as selected(id);
  if requested_count <> cardinality(p_activity_ids) then
    raise exception 'La sélection contient des actions en double.';
  end if;

  delete from public.purchase_activity_logs
   where business_id = p_business_id
     and id = any(p_activity_ids);
  get diagnostics deleted_count = row_count;

  if deleted_count <> requested_count then
    raise exception 'Une ou plusieurs actions sont introuvables dans cette entreprise; aucune suppression n’a été effectuée.';
  end if;

  insert into public.purchase_activity_log_purges (business_id, deleted_by, deleted_count)
  values (p_business_id, auth.uid(), deleted_count);

  return deleted_count;
end;
$$;

revoke all on function public.delete_purchase_activity_logs(uuid, uuid[]) from public, anon;
grant execute on function public.delete_purchase_activity_logs(uuid, uuid[]) to authenticated;

notify pgrst, 'reload schema';
