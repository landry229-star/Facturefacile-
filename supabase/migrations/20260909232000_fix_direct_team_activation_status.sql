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
  set validated_at = coalesce(validated_at, now()),
      sent_at = coalesce(sent_at, now()),
      accepted_at = now()
  where id = p_invitation_id;

  insert into public.business_members (business_id, user_id, role)
  values (target.business_id, target.invited_user_id, target.role)
  on conflict (business_id, user_id) do update set role = excluded.role;
end;
$$;

revoke all on function public.validate_business_invitation(uuid) from public, anon;
grant execute on function public.validate_business_invitation(uuid) to authenticated;
