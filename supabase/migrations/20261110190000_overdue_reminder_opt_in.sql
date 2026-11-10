create table if not exists public.invoice_reminder_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.invoice_reminder_settings enable row level security;
revoke all on public.invoice_reminder_settings from public, anon, authenticated;
grant select on public.invoice_reminder_settings to service_role;
grant select on public.manual_invoice_reminders to service_role;
grant select, insert, delete on public.invoice_reminders to service_role;
grant insert on public.invoice_communications to service_role;

create or replace function public.get_overdue_reminders_enabled(p_business_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
begin
  if not public.is_business_member(p_business_id, 'viewer') then
    raise exception 'Entreprise non autorisée.';
  end if;
  return coalesce((
    select s.enabled
    from public.invoice_reminder_settings s
    where s.business_id = p_business_id
  ), false);
end;
$$;

create or replace function public.set_overdue_reminders_enabled(
  p_business_id uuid,
  p_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  business_role text;
begin
  if p_enabled is null then raise exception 'Le choix d’activation est obligatoire.'; end if;
  business_role := public.get_business_role(p_business_id);
  if business_role not in ('owner', 'admin') then
    raise exception 'Seul le propriétaire ou un administrateur peut gérer les relances automatiques.';
  end if;

  insert into public.invoice_reminder_settings (business_id, enabled, updated_at, updated_by)
  values (p_business_id, p_enabled, now(), auth.uid())
  on conflict (business_id) do update
    set enabled = excluded.enabled,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;

  return p_enabled;
end;
$$;

revoke all on function public.get_overdue_reminders_enabled(uuid) from public, anon;
grant execute on function public.get_overdue_reminders_enabled(uuid) to authenticated;
revoke all on function public.set_overdue_reminders_enabled(uuid, boolean) from public, anon;
grant execute on function public.set_overdue_reminders_enabled(uuid, boolean) to authenticated;
