begin;
create table public.user_presence (
 session_id uuid primary key,
 profile_id uuid not null references public.profiles(id),
 last_seen_at timestamptz not null default now()
);
alter table public.user_presence enable row level security;
create function public.touch_my_presence(tab_session_id uuid, connected boolean default true)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.has_active_profile() then raise exception 'Cuenta inhabilitada'; end if;
 if connected then
  insert into public.user_presence(session_id,profile_id) values(tab_session_id,auth.uid())
  on conflict(session_id) do update set last_seen_at=now() where user_presence.profile_id=auth.uid();
 else delete from public.user_presence where session_id=tab_session_id and profile_id=auth.uid(); end if;
 delete from public.user_presence where profile_id=auth.uid() and last_seen_at<now()-interval '1 day';
end $$;
create function public.list_user_presence() returns table(profile_id uuid,online boolean)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_manager() then raise exception 'Solo el jefe puede consultar la conexión'; end if;
 return query select p.id,p.active and exists(select 1 from public.user_presence u where u.profile_id=p.id and u.last_seen_at>now()-interval '90 seconds') from public.profiles p where p.deleted_at is null;
end $$;
revoke all on function public.touch_my_presence(uuid,boolean),public.list_user_presence() from public,anon;
grant execute on function public.touch_my_presence(uuid,boolean),public.list_user_presence() to authenticated;
commit;
