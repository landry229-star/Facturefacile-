drop function if exists public.search_platform_global(text, integer);

create function public.search_platform_global(p_query text, p_limit integer default 20)
returns table (category text, label text, resource_id uuid, status text, last_activity_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare q text := lower(trim(coalesce(p_query, ''))); n integer := greatest(1, least(coalesce(p_limit, 20), 20));
begin
  if length(q) < 2 then return; end if;
  if public.has_platform_admin_permission('businesses') then
    return query select 'Entreprise', b.name, b.id, b.platform_status, b.updated_at from businesses b where lower(coalesce(b.name,'')) like '%'||q||'%' order by b.updated_at desc limit n;
  end if;
  if public.has_platform_admin_permission('users') then
    return query select 'Utilisateur', coalesce(u.raw_user_meta_data->>'full_name', u.email::text), u.id, null::text, u.last_sign_in_at from auth.users u where lower(coalesce(u.email::text,'')||' '||coalesce(u.raw_user_meta_data->>'full_name','')) like '%'||q||'%' order by u.last_sign_in_at desc nulls last limit n;
  end if;
  if public.has_platform_admin_permission('subscriptions') then
    return query select 'Abonnement', b.name||' · '||s.plan, s.id, s.status, s.updated_at from business_subscriptions s join businesses b on b.id=s.business_id where lower(b.name||' '||s.plan||' '||s.status) like '%'||q||'%' order by s.updated_at desc limit n;
  end if;
  if public.has_platform_admin_permission('subscription_payments') then
    return query select 'Transaction', '#'||left(p.id::text,8)||' · '||b.name, p.id, p.status, p.created_at from subscription_payments p join businesses b on b.id=p.business_id where lower(p.id::text||' '||b.name||' '||p.status) like '%'||q||'%' order by p.created_at desc limit n;
  end if;
  if public.has_platform_admin_permission('support') then
    return query select 'Ticket', '#'||left(t.id::text,8)||' · '||t.subject, t.id, t.status, t.updated_at from support_tickets t where lower(t.id::text||' '||coalesce(t.subject,'')) like '%'||q||'%' order by t.updated_at desc limit n;
  end if;
  if public.has_platform_admin_permission('incidents') then
    return query select 'Incident', i.title||' · '||i.service, i.id, i.status, i.started_at from platform_incidents i where lower(i.title||' '||i.service||' '||i.status) like '%'||q||'%' order by i.started_at desc limit n;
  end if;
end;
$$;
grant execute on function public.search_platform_global(text, integer) to authenticated;
