create or replace function public.enforce_subscription_member_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_members integer;
  member_limit integer;
  is_demo_owner boolean;
begin
  select exists (
    select 1
    from public.businesses b
    join auth.users u on u.id = b.owner_id
    where b.id = new.business_id
      and lower(u.email) = 'azoganlandry3@gmail.com'
  ) into is_demo_owner;

  if is_demo_owner then
    return new;
  end if;

  select count(*)::integer into current_members
  from public.business_members
  where business_id = new.business_id;

  select case plan
    when 'free' then 1
    when 'starter' then 1
    when 'pro' then 5
    when 'business' then 25
    else 1
  end into member_limit
  from public.business_subscriptions
  where business_id = new.business_id
    and status in ('active', 'trialing')
    and (expires_at is null or expires_at > now());

  if coalesce(member_limit, 1) <= current_members
     and not exists (
       select 1 from public.business_members
       where business_id = new.business_id and user_id = new.user_id
     ) then
    raise exception 'La limite de % utilisateur(s) de votre abonnement est atteinte.', member_limit;
  end if;
  return new;
end;
$$;
