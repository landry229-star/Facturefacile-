create table if not exists public.platform_content (
  id uuid primary key default gen_random_uuid(),
  content_type text not null,
  slug text not null unique,
  title text not null,
  body text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_settings (
  key text primary key,
  value text not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.platform_content enable row level security;
alter table public.platform_settings enable row level security;

create or replace function public.has_platform_admin_permission(p_permission text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins
    where user_id = auth.uid() and (
      role = 'super_admin'
      or (role = 'admin' and p_permission <> 'admin_management')
      or (role = 'support' and p_permission in ('overview', 'users', 'businesses', 'subscriptions', 'support', 'notifications'))
      or (role = 'finance' and p_permission in ('overview', 'subscriptions', 'subscription_payments'))
      or (role = 'analyst' and p_permission in ('overview', 'users', 'businesses', 'subscriptions', 'subscription_payments', 'analytics'))
    )
  );
$$;

create or replace function public.list_platform_content()
returns table (id uuid, content_type text, slug text, title text, body text, status text, updated_by uuid, updated_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('content') then raise exception 'Accès administrateur requis.'; end if;
  return query select c.id, c.content_type, c.slug, c.title, c.body, c.status, c.updated_by, c.updated_at
    from public.platform_content c order by c.updated_at desc;
end;
$$;

create or replace function public.list_public_content(p_content_type text default null)
returns table (id uuid, content_type text, slug text, title text, body text, status text, updated_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select c.id, c.content_type, c.slug, c.title, c.body, c.status, c.updated_at
  from public.platform_content c
  where c.status = 'published'
    and (p_content_type is null or c.content_type = p_content_type)
  order by c.updated_at desc
$$;

create or replace function public.upsert_platform_content(
  p_id uuid, p_content_type text, p_slug text, p_title text, p_body text, p_status text
) returns uuid language plpgsql security definer set search_path = public
as $$
declare content_id uuid;
begin
  if not public.has_platform_admin_permission('content') then raise exception 'Accès administrateur requis.'; end if;
  if p_status not in ('draft', 'published', 'archived') then raise exception 'Statut de contenu invalide.'; end if;
  if nullif(trim(p_title), '') is null or nullif(trim(p_slug), '') is null then raise exception 'Titre et identifiant obligatoires.'; end if;
  insert into public.platform_content(id, content_type, slug, title, body, status, updated_by, updated_at)
  values (coalesce(p_id, gen_random_uuid()), trim(p_content_type), trim(p_slug), trim(p_title), coalesce(p_body, ''), p_status, auth.uid(), now())
  on conflict (id) do update set content_type = excluded.content_type, slug = excluded.slug, title = excluded.title,
    body = excluded.body, status = excluded.status, updated_by = auth.uid(), updated_at = now()
  returning id into content_id;
  perform public.write_platform_audit(case when p_id is null then 'create' else 'update' end, 'platform_content', content_id);
  return content_id;
end;
$$;

create or replace function public.list_platform_settings()
returns table (key text, value text, updated_by uuid, updated_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('settings') then raise exception 'Accès administrateur requis.'; end if;
  return query select s.key, s.value, s.updated_by, s.updated_at from public.platform_settings s order by s.key;
end;
$$;

create or replace function public.update_platform_setting(p_key text, p_value text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('settings') then raise exception 'Accès administrateur requis.'; end if;
  if p_key not in ('platform_name', 'support_email', 'support_phone', 'default_currency', 'country', 'payment_provider') then raise exception 'Paramètre non modifiable.';
  end if;
  insert into public.platform_settings(key, value, updated_by, updated_at)
  values (p_key, coalesce(trim(p_value), ''), auth.uid(), now())
  on conflict (key) do update set value = excluded.value, updated_by = auth.uid(), updated_at = now();
  perform public.write_platform_audit('update', 'platform_setting', null, 'success', jsonb_build_object('key', p_key));
end;
$$;

insert into public.platform_settings(key, value) values
  ('platform_name', 'FactureFacile Bénin'), ('support_email', 'support@facturefacile.bj'),
  ('support_phone', ''), ('default_currency', 'XOF'), ('country', 'Bénin'), ('payment_provider', 'PayDunya')
on conflict (key) do nothing;

revoke all on function public.list_platform_content() from public, anon;
revoke all on function public.upsert_platform_content(uuid, text, text, text, text, text) from public, anon;
revoke all on function public.list_platform_settings() from public, anon;
revoke all on function public.update_platform_setting(text, text) from public, anon;
grant execute on function public.list_platform_content() to authenticated;
grant execute on function public.list_public_content(text) to anon, authenticated;
grant execute on function public.upsert_platform_content(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.list_platform_settings() to authenticated;
grant execute on function public.update_platform_setting(text, text) to authenticated;
notify pgrst, 'reload schema';
