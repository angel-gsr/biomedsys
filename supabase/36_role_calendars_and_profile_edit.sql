begin;
set local lock_timeout='10s';
alter table public.trainings add column calendar_audience public.app_role[] not null default array['usuario']::public.app_role[] check(cardinality(calendar_audience)>0);
create table public.organized_events(
 id bigint generated always as identity primary key,
 title text not null check(length(btrim(title)) between 3 and 160),
 description text check(length(description)<=2000),location text check(length(location)<=160),
 starts_at timestamptz not null,ends_at timestamptz not null check(ends_at>starts_at),
 audience public.app_role[] not null check(cardinality(audience)>0),
 status text not null default 'programado' check(status in ('programado','cancelado')),
 created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.organized_events enable row level security;
revoke all on public.organized_events from anon,authenticated;
create trigger audit_organized_events after insert or update on public.organized_events for each row execute function public.write_inventory_audit_log();
create function public.save_organized_event(target_id bigint,event_title text,event_description text,event_location text,start_time timestamptz,end_time timestamptz,target_roles public.app_role[])
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare result bigint;
begin
 if not public.is_manager() then raise exception 'Solo el jefe puede organizar eventos'; end if;
 if start_time is null or end_time is null or end_time<=start_time then raise exception 'Registra inicio y fin válidos'; end if;
 if target_roles is null or cardinality(target_roles)=0 or array_position(target_roles,null) is not null then raise exception 'Selecciona los perfiles destinatarios'; end if;
 if target_id is null then
  if start_time<now()-interval '5 minutes' then raise exception 'El evento debe programarse en un horario futuro'; end if;
  insert into public.organized_events(title,description,location,starts_at,ends_at,audience,created_by) values(btrim(event_title),nullif(btrim(event_description),''),nullif(btrim(event_location),''),start_time,end_time,target_roles,auth.uid()) returning id into result;
 else
  update public.organized_events set title=btrim(event_title),description=nullif(btrim(event_description),''),location=nullif(btrim(event_location),''),starts_at=start_time,ends_at=end_time,audience=target_roles,updated_at=now() where id=target_id and status='programado' returning id into result;
  if result is null then raise exception 'Evento no disponible'; end if;
 end if;
 return result;
end $$;
create function public.cancel_organized_event(target_id bigint) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_manager() then raise exception 'Solo el jefe puede cancelar eventos'; end if;
 update public.organized_events set status='cancelado',updated_at=now() where id=target_id and status='programado';
 if not found then raise exception 'Evento no disponible'; end if;
end $$;
create function public.list_role_calendar(from_time timestamptz,to_time timestamptz) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare viewer public.app_role;result jsonb;
begin
 select role into viewer from public.profiles where id=auth.uid() and active and deleted_at is null;
 if viewer is null then raise exception 'Perfil habilitado requerido'; end if;
 if from_time is null or to_time is null or to_time<=from_time or to_time-from_time>interval '400 days' then raise exception 'Rango inválido'; end if;
 with visible as (
  select e.event_key,e.kind,e.title,e.starts_at,e.ends_at,e.location_id,
    coalesce((select h.name||' · '||l.name from public.equipment_locations l join public.hospital_areas h on h.id=l.hospital_area_id where l.id=e.location_id),case when e.kind='capacitacion' then (select tr.location from public.trainings tr where e.event_key='capacitacion:'||tr.id) end) location_name,
    e.equipment_ids,e.status,e.blocks_resources,
    case when e.kind='mantenimiento' then (select p.full_name from public.maintenances m left join public.profiles p on p.id=m.assigned_to where e.event_key='mantenimiento:'||m.id)
         when e.kind='capacitacion' then (select p.full_name from public.trainings tr join public.profiles p on p.id=tr.instructor_id where e.event_key='capacitacion:'||tr.id) end responsible_name,
    null::text description,null::public.app_role[] audience
  from public.calendar_resource_events() e
  where e.status not in ('cancelado','cancelada') and (
   e.kind='mantenimiento' or viewer='jefe'
   or (e.kind in ('cirugia','uso_equipo') and viewer='tecnico')
   or (e.kind='capacitacion' and exists(select 1 from public.trainings tr where e.event_key='capacitacion:'||tr.id and (tr.instructor_id=auth.uid() or viewer=any(tr.calendar_audience) or exists(select 1 from public.training_participants tp where tp.training_id=tr.id and tp.participant_id=auth.uid()))))
  )
  union all
  select 'evento:'||oe.id,'evento',oe.title,oe.starts_at,oe.ends_at,null::bigint,oe.location,'{}'::uuid[],oe.status,false,
    (select p.full_name from public.profiles p where p.id=oe.created_by),oe.description,oe.audience
  from public.organized_events oe where oe.status='programado' and (viewer='jefe' or viewer=any(oe.audience))
 )select coalesce(jsonb_agg(to_jsonb(v) order by v.starts_at),'[]'::jsonb) into result from visible v
 where v.starts_at<to_time and (coalesce(v.ends_at,'infinity'::timestamptz)>from_time);
 return result;
end $$;
create function public.role_calendar_options() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.has_active_profile() then raise exception 'Perfil habilitado requerido'; end if;
 if public.is_technician_or_manager() then return public.general_calendar_options(); end if;
 return jsonb_build_object('equipment',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'name',a.inventory_code||' · '||et.name)),'[]'::jsonb) from public.equipment_assets a join public.equipment_models em on em.id=a.equipment_model_id join public.equipment_types et on et.id=em.equipment_type_id where a.active),'locations','[]'::jsonb,'programs','[]'::jsonb,'technicians','[]'::jsonb);
end $$;

create or replace function public.manage_profile_details(target_profile_id uuid,new_first_name text,new_last_name text,new_age smallint,new_phone text,new_avatar_path text,new_department text,new_role public.app_role,new_active boolean,change_reason text)
returns public.profiles language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.profiles;old_row public.profiles;new_name text;
begin
 if not public.is_manager() then raise exception 'Operación reservada para el rol jefe'; end if;
 select * into old_row from public.profiles where id=target_profile_id for update;
 if old_row.id is null then raise exception 'Perfil no encontrado'; end if;
 new_first_name:=btrim(coalesce(new_first_name,''));new_last_name:=btrim(coalesce(new_last_name,''));new_name:=btrim(new_first_name||' '||new_last_name);
 if length(new_first_name) not between 2 and 80 or new_first_name !~ '^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ ''’.-]*[A-Za-zÀ-ÖØ-öø-ÿ]$' then raise exception 'Nombres inválidos'; end if;
 if new_last_name='' then
  if old_row.last_name is not null or new_name<>regexp_replace(btrim(old_row.full_name),'\s+',' ','g') then raise exception 'Completa los apellidos'; end if;
 elsif length(new_last_name) not between 2 and 100 or new_last_name !~ '^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ ''’.-]*[A-Za-zÀ-ÖØ-öø-ÿ]$' then raise exception 'Apellidos inválidos'; end if;
 if (new_age is null and old_row.age is not null) or (new_age is not null and new_age not between 18 and 100) then raise exception 'Edad válida requerida'; end if;
 result:=public.manage_profile(target_profile_id,new_name,new_department,new_role,new_active,change_reason);
 update public.profiles set first_name=new_first_name,last_name=nullif(new_last_name,''),age=new_age,phone=nullif(btrim(new_phone),''),avatar_path=new_avatar_path where id=target_profile_id returning * into result;
 return result;
end $$;
revoke all on function public.list_role_calendar(timestamptz,timestamptz),public.role_calendar_options(),public.save_organized_event(bigint,text,text,text,timestamptz,timestamptz,public.app_role[]),public.cancel_organized_event(bigint) from public,anon;
grant execute on function public.list_role_calendar(timestamptz,timestamptz),public.role_calendar_options(),public.save_organized_event(bigint,text,text,text,timestamptz,timestamptz,public.app_role[]),public.cancel_organized_event(bigint) to authenticated;
commit;
