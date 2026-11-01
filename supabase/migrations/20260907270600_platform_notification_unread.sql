create or replace function public.mark_platform_notification_unread(p_notification_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.platform_notifications
    set read_at = null
    where id = p_notification_id
      and (recipient_user_id is null or recipient_user_id = auth.uid());
  perform public.write_platform_audit('mark_unread', 'platform_notification', p_notification_id);
end;
$$;

revoke all on function public.mark_platform_notification_unread(uuid) from public, anon;
grant execute on function public.mark_platform_notification_unread(uuid) to authenticated;
notify pgrst, 'reload schema';
