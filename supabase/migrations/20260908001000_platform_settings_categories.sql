insert into public.platform_settings(key, value) values
  ('platform_logo_url', ''),
  ('general_info', 'Plateforme de facturation et de gestion pour les entreprises du Bénin.'),
  ('email_notifications', 'enabled'),
  ('system_notifications', 'enabled'),
  ('alert_notifications', 'enabled'),
  ('session_duration_minutes', '480'),
  ('security_rules', 'Mots de passe de 8 caractères minimum.'),
  ('login_settings', 'Authentification Supabase et confirmation e-mail.'),
  ('subscription_plans', 'Free, Starter, Pro et Business'),
  ('subscription_rules', 'Les limites sont contrôlées côté serveur.'),
  ('commercial_settings', 'Tarification configurée dans le module Abonnements.'),
  ('timezone', 'Africa/Porto-Novo'),
  ('maintenance_mode', 'disabled'),
  ('pdf_provider', 'Génération locale sécurisée')
on conflict (key) do nothing;

create or replace function public.update_platform_setting(p_key text, p_value text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('settings') then
    raise exception 'Accès administrateur requis.';
  end if;
  if p_key not in (
    'platform_name', 'platform_logo_url', 'support_email', 'support_phone', 'general_info',
    'default_currency', 'country', 'payment_provider',
    'email_notifications', 'system_notifications', 'alert_notifications',
    'session_duration_minutes', 'security_rules', 'login_settings',
    'subscription_plans', 'subscription_rules', 'commercial_settings',
    'timezone', 'maintenance_mode', 'pdf_provider'
  ) then
    raise exception 'Paramètre non modifiable.';
  end if;
  if p_key = 'session_duration_minutes' and (p_value !~ '^[0-9]+$' or p_value::integer < 15 or p_value::integer > 43200) then
    raise exception 'La durée de session doit être comprise entre 15 et 43200 minutes.';
  end if;
  if p_key in ('email_notifications', 'system_notifications', 'alert_notifications', 'maintenance_mode')
    and p_value not in ('enabled', 'disabled') then
    raise exception 'Valeur booléenne de paramètre invalide.';
  end if;
  insert into public.platform_settings(key, value, updated_by, updated_at)
  values (p_key, coalesce(trim(p_value), ''), auth.uid(), now())
  on conflict (key) do update set value = excluded.value, updated_by = auth.uid(), updated_at = now();
  perform public.write_platform_audit('update', 'platform_setting', null, 'success', jsonb_build_object('key', p_key));
end;
$$;

revoke all on function public.update_platform_setting(text, text) from public, anon;
grant execute on function public.update_platform_setting(text, text) to authenticated;
notify pgrst, 'reload schema';
