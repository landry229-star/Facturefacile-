create or replace function public.reject_platform_admin_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.businesses b
    join public.platform_admins pa on pa.user_id = b.owner_id
    where b.id = new.business_id
  ) then
    raise exception 'Un administrateur plateforme ne peut pas souscrire à un abonnement.';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_platform_admin_subscription_trigger on public.business_subscriptions;
create trigger reject_platform_admin_subscription_trigger
before insert or update of business_id, plan, status on public.business_subscriptions
for each row execute function public.reject_platform_admin_subscription();

create or replace function public.reject_platform_admin_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.businesses b
    join public.platform_admins pa on pa.user_id = b.owner_id
    where b.id = new.business_id
  ) then
    raise exception 'Un administrateur plateforme ne peut pas effectuer de paiement d’abonnement.';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_platform_admin_payment_trigger on public.subscription_payments;
create trigger reject_platform_admin_payment_trigger
before insert or update of business_id, plan, status on public.subscription_payments
for each row execute function public.reject_platform_admin_payment();

create or replace function public.set_platform_user_status(p_user_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('users') then raise exception 'Accès administrateur requis.'; end if;
  if exists (select 1 from public.platform_admins where user_id = p_user_id) then
    raise exception 'Le compte administrateur plateforme est protégé et ne peut pas être désactivé ici.';
  end if;
  if p_status not in ('active', 'disabled') then raise exception 'Statut invalide.'; end if;
  update auth.users set banned_until = case when p_status = 'disabled' then 'infinity'::timestamptz else null end where id = p_user_id;
  if not found then raise exception 'Utilisateur introuvable.'; end if;
  perform public.write_platform_audit(case when p_status = 'disabled' then 'disable' else 'activate' end, 'platform_user', p_user_id);
end;
$$;

create or replace function public.delete_platform_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('user_management') then raise exception 'Permission insuffisante pour supprimer un utilisateur.'; end if;
  if p_user_id = auth.uid() then raise exception 'Vous ne pouvez pas supprimer votre propre compte administrateur.'; end if;
  if exists (select 1 from public.platform_admins where user_id = p_user_id) then
    raise exception 'Le compte administrateur plateforme est protégé et ne peut pas être supprimé ici.';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then raise exception 'Utilisateur introuvable.'; end if;
  perform public.write_platform_audit('delete', 'platform_user', p_user_id);
  delete from auth.users where id = p_user_id;
end;
$$;

create or replace function public.list_platform_admin_businesses(p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, name text, owner_id uuid, owner_email text, created_at timestamptz, plan text, subscription_status text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_platform_admin_permission('businesses') then raise exception 'Accès administrateur requis.'; end if;
  return query
    select b.id, b.name, b.owner_id, u.email::text, b.created_at,
      coalesce(bs.plan, 'free'), coalesce(bs.status, 'active')
    from public.businesses b
    left join auth.users u on u.id = b.owner_id
    left join public.business_subscriptions bs on bs.business_id = b.id
    where not exists (select 1 from public.platform_admins pa where pa.user_id = b.owner_id)
    order by b.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
end;
$$;

notify pgrst, 'reload schema';
