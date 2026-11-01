-- Public tickets are accessed through their access-code RPCs. Direct table
-- reads are limited to the ticket creator (when authenticated) or platform staff.
drop policy if exists "support_tickets_select_own_business" on public.support_tickets;
create policy "support_tickets_select_own_business"
on public.support_tickets
for select
using (
  (business_id is null and user_id = auth.uid())
  or exists (
    select 1
    from public.business_members bm
    where bm.business_id = support_tickets.business_id
      and bm.user_id = auth.uid()
  )
  or public.is_platform_super_admin()
);

drop policy if exists "support_ticket_messages_select_own_business" on public.support_ticket_messages;
create policy "support_ticket_messages_select_own_business"
on public.support_ticket_messages
for select
using (
  exists (
    select 1
    from public.support_tickets t
    where t.id = support_ticket_messages.ticket_id
      and (
        (t.business_id is null and t.user_id = auth.uid())
        or exists (
          select 1
          from public.business_members bm
          where bm.business_id = t.business_id
            and bm.user_id = auth.uid()
        )
      )
  )
  or public.is_platform_super_admin()
);
