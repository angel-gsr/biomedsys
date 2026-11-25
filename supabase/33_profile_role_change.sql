begin;
create or replace function public.manage_profile(
 target_profile_id uuid,new_full_name text,new_department text,new_role public.app_role,new_active boolean,change_reason text
) returns public.profiles language plpgsql security definer set search_path=public,pg_temp as $$
declare old_row public.profiles; updated_row public.profiles; new_identifier text; prefix text; login_email text;
begin
 if not public.is_manager() then raise exception 'Operación reservada para el rol jefe'; end if;
 if nullif(btrim(new_full_name),'') is null or nullif(btrim(change_reason),'') is null then raise exception 'Nombre y motivo del cambio son obligatorios'; end if;
 select * into old_row from public.profiles where id=target_profile_id for update;
 if old_row.id is null then raise exception 'Perfil no encontrado'; end if;
 if old_row.deleted_at is not null then raise exception 'La cuenta fue eliminada'; end if;
 if old_row.id=auth.uid() and (new_role<>old_row.role or not new_active) then raise exception 'El jefe no puede cambiar su propio rol ni inhabilitar su perfil'; end if;
 new_identifier:=old_row.institutional_id;
 if new_role<>old_row.role then
  prefix:=case new_role when 'jefe' then '00' when 'tecnico' then '01' when 'usuario' then '02' end;
  new_identifier:=prefix||right(old_row.institutional_id,6);
  while exists(select 1 from public.profiles where institutional_id=new_identifier and id<>old_row.id)
    or exists(select 1 from public.user_access_requests where institutional_id=new_identifier) loop
   new_identifier:=prefix||lpad(nextval('public.user_registration_number')::text,6,'0');
  end loop;
  -- Lock the login identity and update it in the same transaction as the profile.
  select email into login_email from auth.users where id=old_row.id for update;
  if login_email is distinct from old_row.institutional_id||'@biomedgest.local' then raise exception 'La identidad de acceso requiere revisión; no se cambió el rol'; end if;
  if exists(select 1 from auth.users where email=new_identifier||'@biomedgest.local' and id<>old_row.id) then raise exception 'El nuevo identificador ya tiene una cuenta de acceso'; end if;
  update auth.users set email=new_identifier||'@biomedgest.local',raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)||jsonb_build_object('institutional_id',new_identifier),updated_at=now() where id=old_row.id;
  update auth.identities set identity_data=identity_data||jsonb_build_object('email',new_identifier||'@biomedgest.local'),
    provider_id=case when provider_id=login_email then new_identifier||'@biomedgest.local' else provider_id end,updated_at=now()
    where user_id=old_row.id and provider='email';
 end if;
 update public.profiles set full_name=btrim(new_full_name),department=nullif(btrim(new_department),''),role=new_role,active=new_active,institutional_id=new_identifier where id=old_row.id returning * into updated_row;
 insert into public.profile_change_history(profile_id,changed_by,previous_role,new_role,previous_active,new_active,previous_full_name,new_full_name,previous_department,new_department,reason)
 values(old_row.id,auth.uid(),old_row.role,updated_row.role,old_row.active,updated_row.active,old_row.full_name,updated_row.full_name,old_row.department,updated_row.department,btrim(change_reason));
 if old_row.role<>updated_row.role then
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'CHANGE_USER_ROLE','profiles',old_row.id::text,jsonb_build_object('previous_id',old_row.institutional_id,'new_id',updated_row.institutional_id,'reason',btrim(change_reason)));
 end if;
 return updated_row;
end $$;
revoke all on function public.manage_profile(uuid,text,text,public.app_role,boolean,text) from public,anon;
grant execute on function public.manage_profile(uuid,text,text,public.app_role,boolean,text) to authenticated;
commit;
