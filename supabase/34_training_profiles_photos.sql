begin;
create function public.list_training_instructors() returns table(id uuid,full_name text,role public.app_role,active boolean)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.has_active_profile() then raise exception 'Perfil activo requerido'; end if;
 return query select p.id,p.full_name,p.role,p.active from public.profiles p where p.active and p.deleted_at is null and p.role in ('jefe','tecnico') order by p.role,p.full_name;
end $$;
create function public.validate_training_instructor() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_technician_or_manager() then raise exception 'Perfil autorizado requerido'; end if;
 if public.is_active_technician() then
  if tg_op='UPDATE' and old.instructor_id<>auth.uid() then raise exception 'Solo puedes gestionar tu capacitación'; end if;
  new.instructor_id:=auth.uid();
 end if;
 if not exists(select 1 from public.profiles where id=new.instructor_id and active and deleted_at is null and role in ('jefe','tecnico')) then raise exception 'Selecciona un jefe o biomédico habilitado'; end if;
 return new;
end $$;
create trigger validate_training_instructor before insert or update on public.trainings for each row execute function public.validate_training_instructor();
drop policy if exists "active engineers manage trainings" on public.trainings;
create policy "active engineers manage trainings" on public.trainings for all to authenticated using (public.is_manager() or (public.is_active_technician() and instructor_id=auth.uid())) with check(public.is_manager() or (public.is_active_technician() and instructor_id=auth.uid()));
alter table public.profiles add column avatar_path text;
alter table public.user_access_requests add column avatar_path text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('profile-avatars','profile-avatars',false,65536,array['image/webp','image/jpeg']) on conflict(id) do nothing;
create policy avatar_read on storage.objects for select to authenticated using(bucket_id='profile-avatars' and public.has_active_profile() and (public.is_manager() or exists(select 1 from public.profiles where id=auth.uid() and avatar_path=name)));
create policy avatar_upload on storage.objects for insert to authenticated with check(bucket_id='profile-avatars' and public.is_manager() and name ~ '^(profiles|registrations)/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg)$');
create policy avatar_remove on storage.objects for delete to authenticated using(bucket_id='profile-avatars' and public.is_manager());
create function public.validate_avatar_reference() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='UPDATE' and new.avatar_path is not distinct from old.avatar_path then return new; end if;
 if new.avatar_path is not null and (new.avatar_path !~ '^(profiles|registrations)/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg)$' or not exists(select 1 from storage.objects where bucket_id='profile-avatars' and name=new.avatar_path and (metadata->>'size')::bigint<=65536 and metadata->>'mimetype' in ('image/webp','image/jpeg'))) then raise exception 'Foto de perfil inválida o no cargada'; end if;
 return new;
end $$;
create trigger validate_avatar_reference before insert or update on public.profiles for each row execute function public.validate_avatar_reference();
create trigger validate_avatar_reference before insert or update on public.user_access_requests for each row execute function public.validate_avatar_reference();
create function public.manage_profile_details(target_profile_id uuid,new_first_name text,new_last_name text,new_age smallint,new_phone text,new_avatar_path text,new_department text,new_role public.app_role,new_active boolean,change_reason text)
returns public.profiles language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.profiles;
begin
 if not public.is_manager() then raise exception 'Operación reservada para el rol jefe'; end if;
 new_first_name:=btrim(new_first_name);new_last_name:=btrim(new_last_name);
 if new_first_name is null or new_last_name is null or length(new_first_name) not between 2 and 80 or length(new_last_name) not between 2 and 100 or new_first_name !~ '^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ ''’.-]*[A-Za-zÀ-ÖØ-öø-ÿ]$' or new_last_name !~ '^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ ''’.-]*[A-Za-zÀ-ÖØ-öø-ÿ]$' then raise exception 'Nombres y apellidos inválidos'; end if;
 if new_age is null or new_age not between 18 and 100 then raise exception 'Edad requerida: 18 a 100 años'; end if;
 result:=public.manage_profile(target_profile_id,new_first_name||' '||new_last_name,new_department,new_role,new_active,change_reason);
 update public.profiles set first_name=new_first_name,last_name=new_last_name,age=new_age,phone=nullif(btrim(new_phone),''),avatar_path=new_avatar_path where id=target_profile_id returning * into result;
 return result;
end $$;
revoke all on function public.list_training_instructors(),public.validate_training_instructor(),public.validate_avatar_reference(),public.manage_profile_details(uuid,text,text,smallint,text,text,text,public.app_role,boolean,text) from public,anon;
revoke all on function public.validate_training_instructor(),public.validate_avatar_reference() from authenticated;
grant execute on function public.list_training_instructors(),public.manage_profile_details(uuid,text,text,smallint,text,text,text,public.app_role,boolean,text) to authenticated;
commit;
