-- CREATE OR REPLACE cannot remove an existing parameter default.
create or replace function public.is_business_member(
  p_business_id uuid,
  p_min_role text default 'member'
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = p_business_id and b.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.business_members m
    where m.business_id = p_business_id
      and m.user_id = auth.uid()
      and case p_min_role
        when 'viewer' then m.role in ('viewer', 'member', 'admin')
        when 'member' then m.role in ('member', 'admin')
        when 'admin' then m.role = 'admin'
        else false
      end
  );
$$;

revoke all on function public.is_business_member(uuid, text) from public, anon;
grant execute on function public.is_business_member(uuid, text) to authenticated;
