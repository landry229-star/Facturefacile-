create or replace function public.notify_platform_security_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.action in ('login_failed', 'access_denied', 'disable', 'delete', 'change_role')
     or new.resource_type ilike '%security%' then
    perform public.create_platform_notification(
      'security_issue',
      'Problème de sécurité',
      format('Une action de sécurité (%s) a été enregistrée.', new.action),
      case when new.result = 'failure' or new.action in ('login_failed', 'access_denied') then 'critical' else 'warning' end
    );
  end if;
  return new;
end;
$$;

create or replace function public.notify_platform_integration_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('unavailable', 'attention') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform public.create_platform_notification(
      'integration_unavailable',
      'Intégration indisponible',
      format('L’intégration « %s » nécessite une vérification.', new.name),
      case when new.status = 'unavailable' then 'critical' else 'warning' end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists platform_security_notification on public.platform_audit_logs;
create trigger platform_security_notification
after insert on public.platform_audit_logs
for each row execute function public.notify_platform_security_event();

drop trigger if exists platform_integration_notification on public.platform_integrations;
create trigger platform_integration_notification
after insert or update of status on public.platform_integrations
for each row execute function public.notify_platform_integration_event();

notify pgrst, 'reload schema';
