create or replace function public.reply_my_support_ticket(p_ticket_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Connexion requise pour répondre à une demande.';
  end if;
  if nullif(trim(p_body), '') is null or length(trim(p_body)) > 5000 then
    raise exception 'Le message est obligatoire et limité à 5000 caractères.';
  end if;
  if not exists (
    select 1
    from public.support_tickets
    where id = p_ticket_id and user_id = auth.uid()
  ) then
    raise exception 'Demande introuvable ou accès non autorisé.';
  end if;

  insert into public.support_ticket_messages (ticket_id, author_id, body, internal)
  values (p_ticket_id, auth.uid(), trim(p_body), false);

  update public.support_tickets
     set updated_at = now(),
         status = case when status in ('resolved', 'closed') then 'open' else status end
   where id = p_ticket_id and user_id = auth.uid();
end;
$$;

revoke all on function public.reply_my_support_ticket(uuid, text) from public, anon;
grant execute on function public.reply_my_support_ticket(uuid, text) to authenticated;
