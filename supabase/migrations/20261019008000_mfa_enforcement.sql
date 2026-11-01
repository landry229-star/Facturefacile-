create or replace function public.mfa_requirement_satisfied()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select not exists (
    select 1
    from auth.mfa_factors factor
    where factor.user_id = auth.uid()
      and factor.status = 'verified'
  )
  or auth.jwt() ->> 'aal' = 'aal2';
$$;

revoke all on function public.mfa_requirement_satisfied() from public, anon;
grant execute on function public.mfa_requirement_satisfied() to authenticated;

do $$
declare
  table_name text;
begin
  for table_name in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity
  loop
    execute format('drop policy if exists "require aal2 when mfa enrolled" on public.%I', table_name);
    execute format(
      'create policy "require aal2 when mfa enrolled" on public.%I as restrictive for all to authenticated using (public.mfa_requirement_satisfied()) with check (public.mfa_requirement_satisfied())',
      table_name
    );
  end loop;
end;
$$;
