create table if not exists public.audit_log_maintenance (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  actor_id uuid references auth.users(id) on delete set null,
  removed_audit_log_id uuid not null,
  removed_table_name text not null,
  removed_action text not null,
  removed_record_id uuid,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.audit_log_maintenance enable row level security;
revoke all on public.audit_log_maintenance from public, anon, authenticated;

create or replace function public.list_business_audit_logs(
  p_business_id uuid,
  p_query text default null,
  p_action text default null,
  p_table_name text default null,
  p_from date default null,
  p_to date default null
)
returns table (
  id uuid,
  table_name text,
  action text,
  record_id uuid,
  changed_fields text[],
  actor_label text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not (
    exists (
      select 1 from public.businesses b
      where b.id = p_business_id and b.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.business_members bm
      where bm.business_id = p_business_id
        and bm.user_id = auth.uid()
        and bm.role in ('owner', 'admin')
    )
  ) then
    raise exception 'Accès non autorisé au journal de cette entreprise.';
  end if;

  return query
  select
    al.id,
    al.table_name,
    al.action,
    al.record_id,
    al.changed_fields,
    coalesce(
      nullif(u.raw_user_meta_data ->> 'full_name', ''),
      nullif(u.raw_user_meta_data ->> 'name', ''),
      u.email,
      'Acteur non renseigné'
    )::text,
    al.created_at
  from public.audit_logs al
  left join auth.users u on u.id = al.actor_id
  where al.business_id = p_business_id
    and (p_action is null or al.action = p_action)
    and (p_table_name is null or al.table_name = p_table_name)
    and (p_from is null or al.created_at::date >= p_from)
    and (p_to is null or al.created_at::date <= p_to)
    and (
      nullif(trim(p_query), '') is null
      or position(lower(trim(p_query)) in lower(concat_ws(' ', al.table_name, al.action, al.record_id::text, u.email, u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'))) > 0
    )
  order by al.created_at desc
  limit 500;
end;
$$;

revoke all on function public.list_business_audit_logs(uuid, text, text, text, date, date) from public, anon;
grant execute on function public.list_business_audit_logs(uuid, text, text, text, date, date) to authenticated;

create or replace function public.delete_business_audit_log(
  p_business_id uuid,
  p_audit_log_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  audit_entry public.audit_logs;
begin
  if auth.uid() is null or not (
    exists (
      select 1 from public.businesses b
      where b.id = p_business_id and b.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.business_members bm
      where bm.business_id = p_business_id
        and bm.user_id = auth.uid()
        and bm.role in ('owner', 'admin')
    )
  ) then
    raise exception 'Seuls le propriétaire ou un administrateur peuvent supprimer une entrée du journal.';
  end if;

  select * into audit_entry
  from public.audit_logs
  where id = p_audit_log_id and business_id = p_business_id
  for update;
  if not found then
    raise exception 'Entrée du journal introuvable dans cette entreprise.';
  end if;

  insert into public.audit_log_maintenance (
    business_id, actor_id, removed_audit_log_id, removed_table_name,
    removed_action, removed_record_id, reason
  ) values (
    p_business_id, auth.uid(), audit_entry.id, audit_entry.table_name,
    audit_entry.action, audit_entry.record_id, 'Suppression confirmée par un administrateur'
  );

  delete from public.audit_logs
  where id = audit_entry.id and business_id = p_business_id;
end;
$$;

revoke all on function public.delete_business_audit_log(uuid, uuid) from public, anon;
grant execute on function public.delete_business_audit_log(uuid, uuid) to authenticated;
