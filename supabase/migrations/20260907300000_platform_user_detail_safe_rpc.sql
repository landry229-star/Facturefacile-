create or replace function public.get_platform_user_detail(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare result jsonb;
begin
  if not public.has_platform_admin_permission('users') then
    raise exception 'Accès administrateur requis.';
  end if;
  select jsonb_build_object(
    'user_id', u.id,
    'first_name', split_part(coalesce(u.raw_user_meta_data->>'full_name', ''), ' ', 1),
    'last_name', nullif(regexp_replace(coalesce(u.raw_user_meta_data->>'full_name', ''), '^[^ ]+ ?', ''), ''),
    'full_name', nullif(u.raw_user_meta_data->>'full_name', ''),
    'email', u.email::text,
    'phone', coalesce(u.raw_user_meta_data->>'phone', u.phone::text),
    'avatar_url', u.raw_user_meta_data->>'avatar_url',
    'created_at', u.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'last_activity_at', (select max(l.created_at) from public.platform_audit_logs l where l.actor_id = u.id),
    'connection_count', 0,
    'status', case when u.banned_until is not null and u.banned_until > now() then 'disabled' else 'active' end,
    'platform_role', pa.role,
    'businesses', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'role', x.role, 'plan', x.plan))
      from (
        select b.id, b.name, 'owner'::text as role, coalesce(bs.plan, 'free')::text as plan
        from public.businesses b left join public.business_subscriptions bs on bs.business_id = b.id where b.owner_id = u.id
        union all
        select b.id, b.name, m.role::text, coalesce(bs.plan, 'free')::text
        from public.business_members m join public.businesses b on b.id = m.business_id
        left join public.business_subscriptions bs on bs.business_id = b.id where m.user_id = u.id
      ) x
    ), '[]'::jsonb),
    'tickets', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'subject', t.subject, 'priority', t.priority, 'status', t.status, 'created_at', t.created_at))
      from (select id, subject, priority, status, created_at from public.support_tickets where user_id = u.id order by created_at desc limit 10) t
    ), '[]'::jsonb),
    'activity', coalesce((
      select jsonb_agg(jsonb_build_object('action', a.action, 'resource_type', a.resource_type, 'result', a.result, 'created_at', a.created_at))
      from (select action, resource_type, result, created_at from public.platform_audit_logs where actor_id = u.id order by created_at desc limit 20) a
    ), '[]'::jsonb)
  ) into result
  from auth.users u
  left join public.platform_admins pa on pa.user_id = u.id
  where u.id = p_user_id;
  if result is null then raise exception 'Utilisateur introuvable.'; end if;
  return result;
end;
$$;

revoke all on function public.get_platform_user_detail(uuid) from public, anon;
grant execute on function public.get_platform_user_detail(uuid) to authenticated;
notify pgrst, 'reload schema';
