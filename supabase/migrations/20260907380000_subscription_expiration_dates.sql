create or replace function public.ensure_subscription_expiration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.plan = 'free' then
    new.expires_at := null;
  elsif new.expires_at is null then
    new.expires_at := coalesce(new.created_at, now()) + interval '31 days';
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_subscription_expiration_trigger on public.business_subscriptions;
create trigger ensure_subscription_expiration_trigger
before insert or update of plan, expires_at on public.business_subscriptions
for each row execute function public.ensure_subscription_expiration();

update public.business_subscriptions
set expires_at = created_at + interval '31 days',
    updated_at = now()
where plan <> 'free'
  and expires_at is null;

notify pgrst, 'reload schema';
