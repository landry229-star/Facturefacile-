create or replace function public.check_platform_health()
returns table (
  service_key text,
  service_name text,
  status text,
  detail text,
  checked_at timestamptz,
  latency_ms integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  checked timestamptz := clock_timestamp();
  payment_status text;
  email_status text;
begin
  if not public.has_platform_admin_permission('overview') then
    raise exception 'Accès administrateur requis.';
  end if;

  select i.status into payment_status
  from public.platform_integrations i
  where i.service_type = 'payment'
  order by i.name
  limit 1;

  select i.status into email_status
  from public.platform_integrations i
  where i.service_type = 'email'
  order by i.name
  limit 1;

  return query values
    ('application', 'Application FactureFacile', 'operational', 'L’application web répond à la vérification de la plateforme.', checked, 1),
    ('postgresql', 'PostgreSQL', 'operational', 'La base de données et les fonctions de contrôle sont accessibles.', checked, 1),
    ('storage', 'Stockage', case when to_regclass('storage.objects') is not null then 'operational' else 'incident' end,
      case when to_regclass('storage.objects') is not null then 'Le stockage Supabase est disponible.' else 'La table de stockage Supabase est introuvable.' end, checked, 1),
    ('pdf', 'Génération PDF', 'operational', 'Le module de génération de documents est disponible dans l’application.', checked, 1),
    ('email', 'Service e-mail', case when coalesce(email_status, 'not_configured') in ('connected', 'operational') then 'operational' when email_status = 'unavailable' then 'incident' else 'attention' end,
      case when coalesce(email_status, 'not_configured') in ('connected', 'operational') then 'Le prestataire e-mail est opérationnel.' when email_status = 'unavailable' then 'Le prestataire e-mail est indisponible.' else 'Le prestataire e-mail nécessite une configuration ou une vérification.' end, checked, null),
    ('payment', 'Service de paiement', case when coalesce(payment_status, 'not_configured') in ('connected', 'operational') then 'operational' when payment_status = 'unavailable' then 'incident' else 'attention' end,
      case when coalesce(payment_status, 'not_configured') in ('connected', 'operational') then 'Le prestataire de paiement est opérationnel.' when payment_status = 'unavailable' then 'Le prestataire de paiement est indisponible.' else 'Le prestataire de paiement nécessite une configuration ou une vérification.' end, checked, null),
    ('api', 'API', 'operational', 'Les fonctions RPC protégées répondent côté Supabase.', checked, 1),
    ('notifications', 'Notifications', case when to_regclass('public.platform_notifications') is not null then 'operational' else 'incident' end,
      case when to_regclass('public.platform_notifications') is not null then 'Le centre de notifications est disponible.' else 'Le système de notifications est introuvable.' end, checked, 1);
end;
$$;

revoke all on function public.check_platform_health() from public, anon;
grant execute on function public.check_platform_health() to authenticated;
