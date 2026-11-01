drop function if exists public.create_platform_notification(text, text, text, text);

create or replace function public.notify_platform_business_event()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform public.create_platform_notification(
    'new_business', 'Nouvelle entreprise inscrite',
    format('L’entreprise « %s » vient de rejoindre la plateforme.', new.name), 'info',
    'admin', null, 'business', new.id, new.id::text
  );
  return new;
end;
$$;

create or replace function public.notify_platform_member_event()
returns trigger language plpgsql security definer set search_path = public
as $$
declare member_email text;
begin
  select u.email::text into member_email from auth.users u where u.id = new.user_id;
  perform public.create_platform_notification(
    'new_user', 'Nouvel utilisateur',
    format('Un nouvel utilisateur a rejoint une entreprise (%s).', coalesce(member_email, 'e-mail non renseigné')), 'info',
    'support', null, 'user', new.user_id, new.id::text
  );
  return new;
end;
$$;

create or replace function public.notify_platform_ticket_event()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform public.create_platform_notification(
    case when new.priority = 'urgent' then 'urgent_ticket' else 'new_ticket' end,
    case when new.priority = 'urgent' then 'Ticket urgent' else 'Nouveau ticket support' end,
    new.subject, case when new.priority = 'urgent' then 'critical' else 'info' end,
    'support', null, 'support_ticket', new.id, new.id::text
  );
  return new;
end;
$$;

create or replace function public.notify_platform_payment_event()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'failed' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform public.create_platform_notification(
      'failed_payment', 'Paiement échoué',
      format('Le paiement d’abonnement %s a échoué.', new.id), 'warning',
      'finance', null, 'subscription_payment', new.id, new.id::text || ':' || new.status
    );
  end if;
  return new;
end;
$$;

create or replace function public.notify_platform_subscription_event()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'expired' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform public.create_platform_notification(
      'expired_subscription', 'Abonnement expiré',
      format('L’abonnement de l’entreprise %s est arrivé à expiration.', new.business_id), 'warning',
      'finance', null, 'business_subscription', new.id, new.id::text || ':' || new.status
    );
  end if;
  return new;
end;
$$;

create or replace function public.notify_platform_incident_event()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform public.create_platform_notification(
    'technical_incident', 'Incident technique', new.title,
    case when new.severity in ('high', 'critical') then 'critical' else 'warning' end,
    'admin', null, 'platform_incident', new.id, new.id::text
  );
  return new;
end;
$$;

create or replace function public.notify_platform_security_event()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.action in ('login_failed', 'access_denied', 'disable', 'delete', 'change_role')
     or new.resource_type ilike '%security%' then
    perform public.create_platform_notification(
      'security_issue', 'Problème de sécurité',
      format('Une action de sécurité (%s) a été enregistrée.', new.action),
      case when new.result = 'failure' or new.action in ('login_failed', 'access_denied') then 'critical' else 'warning' end,
      'admin', null, 'platform_audit', new.id, new.id::text
    );
  end if;
  return new;
end;
$$;

create or replace function public.notify_platform_integration_event()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status in ('unavailable', 'attention') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform public.create_platform_notification(
      'integration_unavailable', 'Intégration indisponible',
      format('L’intégration « %s » nécessite une vérification.', new.name),
      case when new.status = 'unavailable' then 'critical' else 'warning' end,
      'admin', null, 'platform_integration', new.id, new.id::text || ':' || new.status
    );
  end if;
  return new;
end;
$$;

revoke all on function public.create_platform_notification(text, text, text, text, text, uuid, text, uuid, text) from public, anon, authenticated;
notify pgrst, 'reload schema';
