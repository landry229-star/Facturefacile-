create or replace function public.accept_business_invitation(p_token text)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  invitation public.business_invitations;
  member_id uuid;
begin
  select *
  into invitation
  from public.business_invitations
  where token = p_token
    and accepted_at is null
    and expires_at > now()
    and lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
  for update;

  if not found then
    raise exception 'Invitation invalide, expirée ou non liée à votre email.';
  end if;

  insert into public.business_members (business_id, user_id, role)
  values (invitation.business_id, auth.uid(), invitation.role)
  on conflict (business_id, user_id)
  do update set role = excluded.role
  returning id into member_id;

  update public.business_invitations
  set accepted_at = now()
  where id = invitation.id;

  return member_id;
end;
$$;

grant execute on function public.accept_business_invitation(text) to authenticated;
