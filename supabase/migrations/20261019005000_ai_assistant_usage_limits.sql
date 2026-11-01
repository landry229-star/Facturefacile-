create table if not exists public.ai_assistant_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0 check (request_count > 0),
  primary key (user_id, usage_date)
);

alter table public.ai_assistant_daily_usage enable row level security;
revoke all on public.ai_assistant_daily_usage from public, anon, authenticated;
grant select, insert, update, delete on public.ai_assistant_daily_usage to service_role;

create or replace function public.consume_ai_assistant_quota(
  p_user_id uuid,
  p_daily_limit integer
)
returns table (allowed boolean, used integer, daily_limit integer, usage_date date)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  quota_date date := (now() at time zone 'UTC')::date;
  current_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Cette opération est réservée au service IA.';
  end if;
  if p_user_id is null or p_daily_limit is null or p_daily_limit < 1 or p_daily_limit > 100 then
    raise exception 'Paramètres de quota invalides.';
  end if;

  delete from public.ai_assistant_daily_usage
  where ai_assistant_daily_usage.usage_date < quota_date - 90;

  insert into public.ai_assistant_daily_usage as daily_usage (user_id, usage_date, request_count)
  values (p_user_id, quota_date, 1)
  on conflict (user_id, usage_date) do update
    set request_count = daily_usage.request_count + 1
    where daily_usage.request_count < p_daily_limit
  returning request_count into current_count;

  if not found then
    select request_count
      into current_count
      from public.ai_assistant_daily_usage
     where ai_assistant_daily_usage.user_id = p_user_id
       and ai_assistant_daily_usage.usage_date = quota_date;
    return query select false, current_count, p_daily_limit, quota_date;
  else
    return query select true, current_count, p_daily_limit, quota_date;
  end if;
end;
$$;

revoke all on function public.consume_ai_assistant_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_assistant_quota(uuid, integer) to service_role;
