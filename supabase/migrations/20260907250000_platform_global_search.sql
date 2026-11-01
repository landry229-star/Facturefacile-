create or replace function public.search_platform_global(p_query text, p_limit integer default 20)
returns table (category text, label text, resource_id uuid)
language plpgsql stable security definer set search_path = public
as $$
declare q text := lower(trim(coalesce(p_query, '')));
begin
  if length(q) < 2 or not public.has_platform_admin_permission('overview') then return; end if;
  return query
    select 'Entreprise', b.name, b.id from public.businesses b
    where lower(b.name) like '%' || q || '%' limit greatest(1, least(p_limit, 20));
  return query
    select 'Utilisateur', u.email::text, u.id from auth.users u
    where lower(coalesce(u.email::text, '')) like '%' || q || '%' limit greatest(1, least(p_limit, 20));
  return query
    select 'Ticket', t.subject, t.id from public.support_tickets t
    where lower(t.subject) like '%' || q || '%' limit greatest(1, least(p_limit, 20));
end;
$$;
revoke all on function public.search_platform_global(text, integer) from public, anon;
grant execute on function public.search_platform_global(text, integer) to authenticated;
notify pgrst, 'reload schema';
