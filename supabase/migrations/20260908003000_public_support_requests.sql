create or replace function public.submit_public_support_request(
  p_name text,
  p_email text,
  p_subject text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket_id uuid;
  message_body text;
begin
  if nullif(trim(p_name), '') is null
     or nullif(trim(p_email), '') is null
     or nullif(trim(p_subject), '') is null
     or nullif(trim(p_body), '') is null then
    raise exception 'Tous les champs de la demande sont obligatoires.';
  end if;

  if length(trim(p_name)) > 120 or length(trim(p_email)) > 320
     or length(trim(p_subject)) > 160 or length(trim(p_body)) > 5000 then
    raise exception 'La demande dépasse la longueur autorisée.';
  end if;

  if trim(p_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Adresse e-mail invalide.';
  end if;

  insert into public.support_tickets (user_id, subject, priority, status)
  values (
    auth.uid(),
    trim(p_subject),
    case when lower(trim(p_subject)) in ('paiement ou abonnement', 'signaler un problème') then 'high' else 'normal' end,
    'open'
  )
  returning id into ticket_id;

  message_body := format('Nom : %s
E-mail : %s

%s', trim(p_name), trim(p_email), trim(p_body));

  insert into public.support_ticket_messages (ticket_id, author_id, body, internal)
  values (ticket_id, auth.uid(), message_body, false);

  return ticket_id;
end;
$$;

revoke all on function public.submit_public_support_request(text, text, text, text) from public;
grant execute on function public.submit_public_support_request(text, text, text, text) to anon, authenticated;
