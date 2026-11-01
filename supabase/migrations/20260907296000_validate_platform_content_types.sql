create or replace function public.upsert_platform_content(
  p_id uuid, p_content_type text, p_slug text, p_title text, p_body text, p_status text
) returns uuid language plpgsql security definer set search_path = public
as $$
declare
  content_id uuid;
  normalized_type text := lower(trim(coalesce(p_content_type, '')));
  normalized_status text := lower(trim(coalesce(p_status, '')));
begin
  if not public.has_platform_admin_permission('content') then
    raise exception 'Accès administrateur requis.';
  end if;
  if normalized_type not in ('faq', 'feature', 'plan', 'announcement', 'article', 'resource') then
    raise exception 'Type de contenu invalide.';
  end if;
  if normalized_status not in ('draft', 'published', 'archived') then
    raise exception 'Statut de contenu invalide.';
  end if;
  if nullif(trim(p_title), '') is null or nullif(trim(p_slug), '') is null then
    raise exception 'Titre et identifiant obligatoires.';
  end if;
  insert into public.platform_content(id, content_type, slug, title, body, status, updated_by, updated_at)
  values (coalesce(p_id, gen_random_uuid()), normalized_type, trim(p_slug), trim(p_title), coalesce(p_body, ''), normalized_status, auth.uid(), now())
  on conflict (id) do update set
    content_type = excluded.content_type,
    slug = excluded.slug,
    title = excluded.title,
    body = excluded.body,
    status = excluded.status,
    updated_by = auth.uid(),
    updated_at = now()
  returning id into content_id;
  perform public.write_platform_audit(case when p_id is null then 'create' else 'update' end, 'platform_content', content_id);
  return content_id;
end;
$$;

revoke all on function public.upsert_platform_content(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.upsert_platform_content(uuid, text, text, text, text, text) to authenticated;
notify pgrst, 'reload schema';
