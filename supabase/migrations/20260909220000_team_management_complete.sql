create or replace function public.list_business_team(p_business_id uuid)
returns table (
  id uuid,
  user_id uuid,
  email text,
  full_name text,
  role text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    m.id,
    m.user_id,
    u.email::text,
    nullif(u.raw_user_meta_data->>'full_name', ''),
    m.role,
    m.created_at
  from public.business_members m
  join auth.users u on u.id = m.user_id
  where m.business_id = p_business_id
    and public.is_business_member(p_business_id, 'viewer')
  order by m.created_at;
$$;

revoke all on function public.list_business_team(uuid) from public, anon;
grant execute on function public.list_business_team(uuid) to authenticated;

create or replace function public.update_business_member_role(p_member_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.business_members;
begin
  if p_role not in ('admin', 'member', 'viewer') then
    raise exception 'Rôle d’équipe invalide.';
  end if;

  select * into target
  from public.business_members
  where id = p_member_id
  for update;

  if not found
     or not public.is_business_admin(target.business_id)
     or target.user_id = auth.uid() then
    raise exception 'Vous ne pouvez pas modifier ce membre.';
  end if;

  update public.business_members
  set role = p_role
  where id = p_member_id;
end;
$$;

revoke all on function public.update_business_member_role(uuid, text) from public, anon;
grant execute on function public.update_business_member_role(uuid, text) to authenticated;

create or replace function public.cancel_business_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.business_invitations;
begin
  select * into target
  from public.business_invitations
  where id = p_invitation_id
  for update;

  if not found or not public.is_business_admin(target.business_id) then
    raise exception 'Vous ne pouvez pas annuler cette invitation.';
  end if;

  delete from public.business_invitations where id = p_invitation_id;
end;
$$;

revoke all on function public.cancel_business_invitation(uuid) from public, anon;
grant execute on function public.cancel_business_invitation(uuid) to authenticated;

create or replace function public.remove_business_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.business_members;
begin
  select * into target
  from public.business_members
  where id = p_member_id
  for update;

  if not found
     or not public.is_business_admin(target.business_id)
     or target.user_id = auth.uid() then
    raise exception 'Vous ne pouvez pas retirer ce membre.';
  end if;

  delete from public.business_members where id = p_member_id;
end;
$$;

revoke all on function public.remove_business_member(uuid) from public, anon;
grant execute on function public.remove_business_member(uuid) to authenticated;
