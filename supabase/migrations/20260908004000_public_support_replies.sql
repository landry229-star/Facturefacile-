create or replace function public.list_my_support_tickets()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Connexion requise pour consulter vos demandes.';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id,
      'subject', t.subject,
      'priority', t.priority,
      'status', t.status,
      'created_at', t.created_at,
      'updated_at', t.updated_at,
      'messages', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', m.id,
          'body', m.body,
          'internal', m.internal,
          'author_role', case when m.author_id = auth.uid() then 'vous' else 'support' end,
          'created_at', m.created_at
        ) order by m.created_at)
        from public.support_ticket_messages m
        where m.ticket_id = t.id and (m.internal = false or m.author_id = auth.uid())
      ), '[]'::jsonb)
    ) order by t.updated_at desc)
    from public.support_tickets t
    where t.user_id = auth.uid()
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_my_support_tickets() from public, anon;
grant execute on function public.list_my_support_tickets() to authenticated;
