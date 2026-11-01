alter table public.support_tickets
  add column if not exists access_code_hash text;

create index if not exists support_tickets_access_code_idx
  on public.support_tickets (id, access_code_hash);

drop function if exists public.submit_public_support_request(text, text, text, text);
create or replace function public.submit_public_support_request(p_name text, p_email text, p_subject text, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ticket_id uuid;
  access_code text;
begin
  if nullif(trim(p_name), '') is null or nullif(trim(p_email), '') is null
     or nullif(trim(p_subject), '') is null or nullif(trim(p_body), '') is null then
    raise exception 'Tous les champs de la demande sont obligatoires.';
  end if;
  if length(trim(p_name)) > 120 or length(trim(p_email)) > 320
     or length(trim(p_subject)) > 160 or length(trim(p_body)) > 5000 then
    raise exception 'La demande dépasse la longueur autorisée.';
  end if;
  if trim(p_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Adresse e-mail invalide.';
  end if;
  access_code := upper(encode(gen_random_bytes(5), 'hex'));
  insert into public.support_tickets (user_id, subject, priority, status, access_code_hash)
  values (auth.uid(), trim(p_subject),
    case when lower(trim(p_subject)) in ('paiement ou abonnement', 'signaler un problème') then 'high' else 'normal' end,
    'open', encode(digest(access_code, 'sha256'), 'hex'))
  returning id into ticket_id;
  insert into public.support_ticket_messages (ticket_id, author_id, body, internal)
  values (ticket_id, auth.uid(), format('Nom : %s
E-mail : %s

%s', trim(p_name), trim(p_email), trim(p_body)), false);
  return jsonb_build_object('ticket_id', ticket_id, 'access_code', access_code);
end;
$$;

create or replace function public.get_public_support_ticket(p_ticket_id uuid, p_access_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  select jsonb_build_object('id', t.id, 'subject', t.subject, 'priority', t.priority,
    'status', t.status, 'created_at', t.created_at, 'updated_at', t.updated_at,
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'body', m.body,
      'internal', false, 'author_role', case when m.author_id is null then 'vous' else 'support' end,
      'created_at', m.created_at) order by m.created_at)
      from public.support_ticket_messages m where m.ticket_id = t.id and m.internal = false), '[]'::jsonb))
  into result from public.support_tickets t
  where t.id = p_ticket_id and t.access_code_hash = encode(digest(upper(trim(p_access_code)), 'sha256'), 'hex');
  if result is null then raise exception 'Code de suivi invalide.'; end if;
  return result;
end;
$$;

create or replace function public.reply_public_support_ticket(p_ticket_id uuid, p_access_code text, p_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if nullif(trim(p_body), '') is null or length(trim(p_body)) > 5000 then
    raise exception 'Le message est obligatoire et limité à 5000 caractères.';
  end if;
  if not exists (select 1 from public.support_tickets where id = p_ticket_id and access_code_hash = encode(digest(upper(trim(p_access_code)), 'sha256'), 'hex')) then
    raise exception 'Code de suivi invalide.';
  end if;
  insert into public.support_ticket_messages (ticket_id, author_id, body, internal)
  values (p_ticket_id, auth.uid(), trim(p_body), false);
  update public.support_tickets set updated_at = now(), status = 'open' where id = p_ticket_id;
end;
$$;

revoke all on function public.submit_public_support_request(text, text, text, text) from public;
revoke all on function public.get_public_support_ticket(uuid, text) from public;
revoke all on function public.reply_public_support_ticket(uuid, text, text) from public;
grant execute on function public.submit_public_support_request(text, text, text, text) to anon, authenticated;
grant execute on function public.get_public_support_ticket(uuid, text) to anon, authenticated;
grant execute on function public.reply_public_support_ticket(uuid, text, text) to anon, authenticated;
