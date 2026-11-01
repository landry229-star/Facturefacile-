create or replace function public.create_platform_notification(
  p_type text,
  p_title text,
  p_message text,
  p_severity text default 'info'
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare notification_id uuid;
begin
  if p_severity not in ('info', 'warning', 'critical') then
    raise exception 'Gravité de notification invalide.';
  end if;
  insert into public.platform_notifications(type, title, message, severity)
  values (p_type, p_title, p_message, p_severity)
  returning id into notification_id;
  return notification_id;
end;
$$;

create or replace function public.notify_platform_business_event()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.create_platform_notification(
    'new_business',
    'Nouvelle entreprise inscrite',
    format('L’entreprise « %s » vient de rejoindre la plateforme.', new.name),
    'info'
  );
  return new;
end;
$$;

create or replace function public.notify_platform_member_event()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare email text;
begin
  select u.email::text into email from auth.users u where u.id = new.user_id;
  perform public.create_platform_notification(
    'new_user',
    'Nouvel utilisateur',
    format('Un nouvel utilisateur a rejoint une entreprise (%s).', coalesce(email, 'e-mail non renseigné')),
    'info'
  );
  return new;
end;
$$;

create or replace function public.notify_platform_ticket_event()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.create_platform_notification(
    case when new.priority = 'urgent' then 'urgent_ticket' else 'new_ticket' end,
    case when new.priority = 'urgent' then 'Ticket urgent' else 'Nouveau ticket support' end,
    new.subject,
    case when new.priority = 'urgent' then 'critical' else 'info' end
  );
  return new;
end;
$$;

create or replace function public.notify_platform_payment_event()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'failed' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform public.create_platform_notification(
      'failed_payment',
      'Paiement échoué',
      format('Le paiement d’abonnement %s a échoué.', coalesce(new.id::text, 'inconnu')),
      'warning'
    );
  end if;
  return new;
end;
$$;

create or replace function public.notify_platform_subscription_event()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'expired' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform public.create_platform_notification(
      'expired_subscription',
      'Abonnement expiré',
      format('L’abonnement de l’entreprise %s est arrivé à expiration.', new.business_id),
      'warning'
    );
  end if;
  return new;
end;
$$;

create or replace function public.notify_platform_incident_event()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.create_platform_notification(
    'technical_incident',
    'Incident technique',
    new.title,
    case when new.severity in ('high', 'critical') then 'critical' else 'warning' end
  );
  return new;
end;
$$;

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

drop trigger if exists platform_business_notification on public.businesses;
create trigger platform_business_notification
after insert on public.businesses
for each row execute function public.notify_platform_business_event();

drop trigger if exists platform_member_notification on public.business_members;
create trigger platform_member_notification
after insert on public.business_members
for each row execute function public.notify_platform_member_event();

drop trigger if exists platform_ticket_notification on public.support_tickets;
create trigger platform_ticket_notification
after insert on public.support_tickets
for each row execute function public.notify_platform_ticket_event();

drop trigger if exists platform_payment_notification on public.subscription_payments;
create trigger platform_payment_notification
after insert or update of status on public.subscription_payments
for each row execute function public.notify_platform_payment_event();

drop trigger if exists platform_subscription_notification on public.business_subscriptions;
create trigger platform_subscription_notification
after insert or update of status on public.business_subscriptions
for each row execute function public.notify_platform_subscription_event();

drop trigger if exists platform_incident_notification on public.platform_incidents;
create trigger platform_incident_notification
after insert on public.platform_incidents
for each row execute function public.notify_platform_incident_event();

drop trigger if exists platform_security_notification on public.platform_audit_logs;
create trigger platform_security_notification
after insert on public.platform_audit_logs
for each row execute function public.notify_platform_security_event();

drop trigger if exists platform_integration_notification on public.platform_integrations;
create trigger platform_integration_notification
after insert or update of status on public.platform_integrations
for each row execute function public.notify_platform_integration_event();

revoke all on function public.create_platform_notification(text, text, text, text) from public, anon, authenticated;
notify pgrst, 'reload schema';
