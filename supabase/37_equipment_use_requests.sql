-- Equipment requests share the authoritative calendar booking source and collision guard.
begin;
set local lock_timeout='10s';
alter table public.calendar_bookings add column usage_location text check(length(usage_location)<=160);
create function public.request_equipment_use(target_equipment uuid,start_time timestamptz,end_time timestamptz,usage_location text)
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare asset public.equipment_assets;result bigint;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active and deleted_at is null and role='usuario') then raise exception 'Solo un usuario clínico habilitado puede solicitar equipo'; end if;
 if start_time is null or end_time is null or start_time<now() or end_time<=start_time then raise exception 'Selecciona un horario futuro y una hora de fin posterior al inicio'; end if;
 if usage_location is null or length(btrim(usage_location)) not between 3 and 160 then raise exception 'Indica la ubicación donde se utilizará el equipo'; end if;
 perform pg_advisory_xact_lock(20261122,20);
 select * into asset from public.equipment_assets where id=target_equipment for update;
 if asset.id is null or not asset.active or asset.status<>'operativo' then raise exception 'El equipo no está disponible para uso'; end if;
 begin
  insert into public.calendar_bookings(kind,title,starts_at,ends_at,equipment_ids,created_by,usage_location)
  values('uso_equipo','Solicitud de equipo · '||asset.inventory_code,start_time,end_time,array[target_equipment],auth.uid(),btrim(usage_location)) returning id into result;
 exception when raise_exception then
  -- Clinical requesters need availability, not the title of restricted surgery events.
  if sqlerrm like 'Conflicto de horario con %' then raise exception 'El equipo ya tiene una actividad programada en ese horario. Consulta el calendario o elige otro horario.'; end if;
  raise;
 end;
 return result;
end $$;
create function public.cancel_equipment_use(target_booking_id bigint) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.has_active_profile() then raise exception 'Perfil habilitado requerido'; end if;
 perform pg_advisory_xact_lock(20261122,20);
 update public.calendar_bookings set status='cancelado' where id=target_booking_id and kind='uso_equipo' and status='programado' and ends_at>now() and (created_by=auth.uid() or public.is_manager());
 if not found then raise exception 'La solicitud no está disponible o no tienes permiso para cancelarla'; end if;
end $$;
revoke all on function public.request_equipment_use(uuid,timestamptz,timestamptz,text),public.cancel_equipment_use(bigint) from public,anon;
grant execute on function public.request_equipment_use(uuid,timestamptz,timestamptz,text),public.cancel_equipment_use(bigint) to authenticated;
create or replace function public.list_role_calendar(from_time timestamptz,to_time timestamptz) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare viewer public.app_role;result jsonb;
begin
 select role into viewer from public.profiles where id=auth.uid() and active and deleted_at is null;
 if viewer is null then raise exception 'Perfil habilitado requerido'; end if;
 if from_time is null or to_time is null or to_time<=from_time or to_time-from_time>interval '400 days' then raise exception 'Rango inválido'; end if;
 with visible as (
  select e.event_key,e.kind,e.title,e.starts_at,e.ends_at,e.location_id,
    coalesce((select h.name||' · '||l.name from public.equipment_locations l join public.hospital_areas h on h.id=l.hospital_area_id where l.id=e.location_id),case when e.kind='uso_equipo' then (select b.usage_location from public.calendar_bookings b where e.event_key='reserva:'||b.id) when e.kind='capacitacion' then (select tr.location from public.trainings tr where e.event_key='capacitacion:'||tr.id) end) location_name,
    e.equipment_ids,e.status,e.blocks_resources,
    case when e.kind='mantenimiento' then (select p.full_name from public.maintenances m left join public.profiles p on p.id=m.assigned_to where e.event_key='mantenimiento:'||m.id)
         when e.kind='uso_equipo' then (select p.full_name from public.calendar_bookings b join public.profiles p on p.id=b.created_by where e.event_key='reserva:'||b.id)
         when e.kind='capacitacion' then (select p.full_name from public.trainings tr join public.profiles p on p.id=tr.instructor_id where e.event_key='capacitacion:'||tr.id) end responsible_name,
    null::text description,null::public.app_role[] audience
  from public.calendar_resource_events() e
  where e.status not in ('cancelado','cancelada') and (
   e.kind in ('mantenimiento','uso_equipo') or viewer='jefe'
   or (e.kind in ('cirugia','uso_equipo') and viewer='tecnico')
   or (e.kind='capacitacion' and exists(select 1 from public.trainings tr where e.event_key='capacitacion:'||tr.id and (tr.instructor_id=auth.uid() or viewer=any(tr.calendar_audience) or exists(select 1 from public.training_participants tp where tp.training_id=tr.id and tp.participant_id=auth.uid()))))
  )
  union all
  select 'evento:'||oe.id,'evento',oe.title,oe.starts_at,oe.ends_at,null::bigint,oe.location,'{}'::uuid[],oe.status,false,
    (select p.full_name from public.profiles p where p.id=oe.created_by),oe.description,oe.audience
  from public.organized_events oe where oe.status='programado' and (viewer='jefe' or viewer=any(oe.audience))
 )select coalesce(jsonb_agg(to_jsonb(v)||jsonb_build_object('can_cancel',case when v.kind='uso_equipo' then exists(select 1 from public.calendar_bookings b where v.event_key='reserva:'||b.id and (b.created_by=auth.uid() or viewer='jefe') and b.status='programado' and b.ends_at>now()) else false end) order by v.starts_at),'[]'::jsonb) into result from visible v
 where v.starts_at<to_time and (coalesce(v.ends_at,'infinity'::timestamptz)>from_time);
 return result;
end $$;

commit;
