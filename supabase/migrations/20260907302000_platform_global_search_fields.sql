create or replace function public.search_platform_global(p_query text, p_limit integer default 20)
returns table (category text, label text, resource_id uuid)
language plpgsql stable security definer set search_path = public
as $$
declare
  q text := lower(trim(coalesce(p_query, '')));
  result_limit integer := greatest(1, least(coalesce(p_limit, 20), 20));
begin
  if length(q) < 2 then return; end if;

  if public.has_platform_admin_permission('businesses') then
    return query
      select 'Entreprise', b.name, b.id from public.businesses b
      where lower(coalesce(b.name, '')) like '%' || q || '%' order by b.name limit result_limit;
  end if;
  if public.has_platform_admin_permission('users') then
    return query
      select 'Utilisateur', coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), u.email::text), u.id
      from auth.users u
      where lower(coalesce(u.email::text, '') || ' ' || coalesce(u.raw_user_meta_data->>'full_name', '')) like '%' || q || '%'
      order by coalesce(u.raw_user_meta_data->>'full_name', u.email::text) limit result_limit;
  end if;
  if public.has_platform_admin_permission('subscriptions') then
    return query
      select 'Abonnement', b.name || ' · ' || s.plan || ' · ' || s.status, s.id
      from public.business_subscriptions s join public.businesses b on b.id = s.business_id
      where lower(b.name || ' ' || s.plan || ' ' || s.status) like '%' || q || '%'
      order by s.created_at desc limit result_limit;
  end if;
  if public.has_platform_admin_permission('subscription_payments') then
    return query
      select 'Transaction', '#' || left(p.id::text, 8) || ' · ' || b.name || ' · ' || p.status, p.id
      from public.subscription_payments p join public.businesses b on b.id = p.business_id
      where lower(p.id::text || ' ' || b.name || ' ' || p.provider || ' ' || p.status || ' ' || p.plan || ' ' || p.currency || ' ' || p.amount::text) like '%' || q || '%'
      order by p.created_at desc limit result_limit;
  end if;
  if public.has_platform_admin_permission('support') then
    return query
      select 'Ticket', '#' || left(t.id::text, 8) || ' · ' || t.subject, t.id
      from public.support_tickets t
      where lower(t.id::text || ' ' || coalesce(t.subject, '')) like '%' || q || '%'
      order by t.updated_at desc limit result_limit;
  end if;
  if public.has_platform_admin_permission('incidents') then
    return query
      select 'Incident', i.title || ' · ' || i.service, i.id
      from public.platform_incidents i
      where lower(coalesce(i.title, '') || ' ' || coalesce(i.description, '') || ' ' || coalesce(i.service, '') || ' ' || i.id::text) like '%' || q || '%'
      order by i.started_at desc limit result_limit;
  end if;
end;
$$;

revoke all on function public.search_platform_global(text, integer) from public, anon;
grant execute on function public.search_platform_global(text, integer) to authenticated;
