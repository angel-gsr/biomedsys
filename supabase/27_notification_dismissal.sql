begin;
set local lock_timeout = '10s';
alter table public.notifications add column dismissed_at timestamptz;
create or replace function public.dismiss_notification(target_notification_id bigint)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.has_active_profile() then raise exception 'Perfil activo requerido'; end if;
  update public.notifications set dismissed_at=coalesce(dismissed_at,clock_timestamp()),read_at=coalesce(read_at,clock_timestamp())
  where id=target_notification_id and recipient_id=auth.uid();
  if not found then raise exception 'Notificación no encontrada o no autorizada'; end if;
end $$;
revoke all on function public.dismiss_notification(bigint) from public,anon;
grant execute on function public.dismiss_notification(bigint) to authenticated;
notify pgrst,'reload schema';
commit;
