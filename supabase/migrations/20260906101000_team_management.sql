create or replace function public.cancel_business_invitation(p_invitation_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.business_invitations invitation
  where invitation.id = p_invitation_id
    and exists (
      select 1 from public.businesses business
      where business.id = invitation.business_id
        and business.owner_id = auth.uid()
    );
end;
$$;

create or replace function public.remove_business_member(p_member_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.business_members member
  where member.id = p_member_id
    and exists (
      select 1 from public.businesses business
      where business.id = member.business_id
        and business.owner_id = auth.uid()
    );
end;
$$;

grant execute on function public.cancel_business_invitation(uuid) to authenticated;
grant execute on function public.remove_business_member(uuid) to authenticated;
