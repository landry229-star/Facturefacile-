create or replace function public.get_platform_analytics(
  p_from timestamptz default now() - interval '30 days',
  p_to timestamptz default now(),
  p_plan text default null,
  p_sector text default null,
  p_business_type text default null
) returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare result jsonb;
begin
  if not public.has_platform_admin_permission('analytics') then raise exception 'Accès administrateur requis.'; end if;
  with scope as (
    select b.id, b.created_at, b.platform_status, coalesce(bs.plan, 'free') plan
    from businesses b left join business_subscriptions bs on bs.business_id = b.id
    where not exists (select 1 from platform_admins pa where pa.user_id = b.owner_id)
      and (p_plan is null or coalesce(bs.plan, 'free') = p_plan)
      and (p_sector is null or b.sector = p_sector)
  ), current_metrics as (
    select count(*) filter (where created_at between p_from and p_to) signups,
      count(*) filter (where platform_status = 'active') active_businesses,
      count(*) filter (where plan <> 'free') paid_businesses,
      coalesce((select count(*) from business_members m where m.created_at between p_from and p_to), 0) active_users,
      coalesce((select sum(amount) from subscription_payments p join scope s on s.id = p.business_id where p.status = 'completed' and p.created_at between p_from and p_to), 0) revenue,
      coalesce((select sum(price) from subscription_plans where status = 'active' and code in (select plan from scope where plan <> 'free')), 0) mrr
    from scope
  ), previous_metrics as (
    select count(*) filter (where created_at between p_from - (p_to-p_from) and p_from) signups from scope
  )
  select jsonb_build_object('current', to_jsonb(c), 'previous', to_jsonb(pm), 'feature_usage', jsonb_build_array(
    jsonb_build_object('feature','Factures','usage',(select count(*) from invoices i where i.created_at between p_from and p_to)),
    jsonb_build_object('feature','Clients','usage',(select count(*) from clients c where c.created_at between p_from and p_to)),
    jsonb_build_object('feature','Produits','usage',(select count(*) from products pr where pr.created_at between p_from and p_to))
  )) into result from current_metrics c cross join previous_metrics pm;
  return result;
end;
$$;

create or replace function public.list_platform_security_events(p_limit integer default 100)
returns table (id uuid, action text, resource_type text, result text, actor_email text, created_at timestamptz, context jsonb)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('audit') then raise exception 'Accès administrateur requis.'; end if;
  return query select l.id, l.action, l.resource_type, l.result, u.email::text, l.created_at, l.context
    from platform_audit_logs l left join auth.users u on u.id = l.actor_id
    where l.resource_type ilike '%security%' or l.action ilike '%login%' or l.action in ('disable','delete','update_role','access_denied')
    order by l.created_at desc limit greatest(1, least(p_limit, 200));
end;
$$;

revoke all on function public.get_platform_analytics(timestamptz,timestamptz,text,text,text) from public, anon;
grant execute on function public.get_platform_analytics(timestamptz,timestamptz,text,text,text) to authenticated;
revoke all on function public.list_platform_security_events(integer) from public, anon;
grant execute on function public.list_platform_security_events(integer) to authenticated;
notify pgrst, 'reload schema';
