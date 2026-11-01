alter table public.business_invitations
  add column if not exists validated_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists full_name text,
  add column if not exists invited_user_id uuid references auth.users(id) on delete cascade;

create or replace function public.validate_business_invitation(p_invitation_id uuid)
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
    raise exception 'Vous ne pouvez pas valider cette invitation.';
  end if;
  if target.accepted_at is not null then
    raise exception 'Cette invitation est déjà activée.';
  end if;
  if target.expires_at <= now() then
    raise exception 'Cette invitation est expirée.';
  end if;
  if target.invited_user_id is null then
    raise exception 'Compte invité introuvable.';
  end if;

  update public.business_invitations
  set validated_at = coalesce(validated_at, now()), sent_at = coalesce(sent_at, now())
  where id = p_invitation_id;
  insert into public.business_members (business_id, user_id, role)
  values (target.business_id, target.invited_user_id, target.role)
  on conflict (business_id, user_id) do update set role = excluded.role;
end;
$$;

revoke all on function public.validate_business_invitation(uuid) from public, anon;
grant execute on function public.validate_business_invitation(uuid) to authenticated;

create or replace function public.accept_business_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.business_invitations;
  member_id uuid;
begin
  select * into invitation
  from public.business_invitations
  where token = p_token
    and validated_at is not null
    and accepted_at is null
    and expires_at > now()
    and lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
  for update;
  if not found then
    raise exception 'Invitation non validée, expirée ou non liée à votre email.';
  end if;

  insert into public.business_members (business_id, user_id, role)
  values (invitation.business_id, auth.uid(), invitation.role)
  on conflict (business_id, user_id) do update set role = excluded.role
  returning id into member_id;

  update public.business_invitations set accepted_at = now() where id = invitation.id;
  return member_id;
end;
$$;

revoke all on function public.accept_business_invitation(text) from public, anon;
grant execute on function public.accept_business_invitation(text) to authenticated;
