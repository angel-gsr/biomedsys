begin;
alter table public.profiles add column deleted_at timestamptz;
create function public.prevent_deleted_profile_activation() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if old.deleted_at is not null then raise exception 'La cuenta fue eliminada'; end if;
 if new.deleted_at is not null and new.active then raise exception 'Desactiva primero la cuenta'; end if;
 return new;
end $$;
create trigger prevent_deleted_profile_activation before update on public.profiles for each row execute function public.prevent_deleted_profile_activation();
create function public.delete_inactive_user(target_profile_id uuid) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare target public.profiles;
begin
 if not public.is_manager() then raise exception 'Solo el jefe puede eliminar usuarios'; end if;
 if target_profile_id=auth.uid() then raise exception 'No puedes eliminar tu propia cuenta'; end if;
 select * into target from public.profiles where id=target_profile_id for update;
 if target.id is null then raise exception 'Perfil no encontrado'; end if;
 if target.active then raise exception 'Desactiva primero la cuenta'; end if;
 if target.deleted_at is not null then return target.id; end if;
 update public.profiles set deleted_at=now() where id=target.id;
 insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'DELETE_INACTIVE_USER','profiles',target.id::text,jsonb_build_object('institutional_id',target.institutional_id));
 return target.id;
end $$;
revoke all on function public.delete_inactive_user(uuid) from public,anon;
grant execute on function public.delete_inactive_user(uuid) to authenticated;
revoke all on function public.prevent_deleted_profile_activation() from public,anon,authenticated;
commit;
