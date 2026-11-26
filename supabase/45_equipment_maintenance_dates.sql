begin;
set local lock_timeout='10s';
alter table public.equipment_inventory_extensions add column reported_last_maintenance_on date,add column reported_next_maintenance_on date,add column maintenance_date_notes text,add column maintenance_schedule_sha256 text,add column maintenance_schedule_row integer;
create function public.get_equipment_maintenance_dates(target_equipment_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not public.has_active_profile() then raise exception 'Perfil habilitado requerido';end if;
 if not exists(select 1 from public.equipment_assets where id=target_equipment_id and active) then raise exception 'Equipo no disponible';end if;
 select coalesce(jsonb_agg(to_jsonb(d) order by d.next_on nulls last),'[]'::jsonb) into result from (
 select p.maintenance_program_id as program_id,m.name as program_name,x.maintenance_periodicity as periodicity,p.interval_months,p.last_completed_on as last_on,p.next_due_on as next_on,x.reported_last_maintenance_on as reported_last_on,x.reported_next_maintenance_on as reported_next_on,x.maintenance_date_notes as notes
 from public.equipment_maintenance_programs p join public.maintenance_programs m on m.id=p.maintenance_program_id left join public.equipment_inventory_extensions x on x.equipment_id=p.equipment_id where p.equipment_id=target_equipment_id
 ) d;
 return result;
end $$;
alter function public.list_role_calendar(timestamptz,timestamptz) rename to list_role_calendar_bookings;
revoke all on function public.list_role_calendar_bookings(timestamptz,timestamptz) from public,anon,authenticated;
create function public.list_role_calendar(from_time timestamptz,to_time timestamptz) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare booked jsonb;planned jsonb;result jsonb;
begin
 booked:=public.list_role_calendar_bookings(from_time,to_time);
 select coalesce(jsonb_agg(jsonb_build_object(
 'event_key','preventivo:'||p.equipment_id||':'||p.maintenance_program_id,'kind','mantenimiento','title','Mantenimiento preventivo · '||e.inventory_code||' · '||e.equipment_type,
 'starts_at',(p.next_due_on::timestamp at time zone 'America/Mexico_City'),'ends_at',((p.next_due_on+1)::timestamp at time zone 'America/Mexico_City'),
 'location_id',null,'location_name',concat_ws(' · ',e.hospital_area,e.location),'equipment_ids',jsonb_build_array(p.equipment_id),'status','pendiente_programacion','blocks_resources',false,
 'responsible_name',null,'description',concat_ws(E'\n',m.name,x.maintenance_date_notes,'Fecha prevista. Confirma el horario y responsable en Mantenimiento.'),
 'audience',null,'can_cancel',false,'can_view_loan',false,'all_day',true,'schedule_date',p.next_due_on,'planned_only',true
 )),'[]'::jsonb) into planned
 from public.equipment_maintenance_programs p join public.equipment_assets a on a.id=p.equipment_id and a.active
 join public.equipment_inventory_detail e on e.id=a.id join public.maintenance_programs m on m.id=p.maintenance_program_id left join public.equipment_inventory_extensions x on x.equipment_id=a.id
 where p.next_due_on is not null and (p.next_due_on::timestamp at time zone 'America/Mexico_City')<to_time and ((p.next_due_on+1)::timestamp at time zone 'America/Mexico_City')>from_time
 and not exists(select 1 from public.maintenances mt where mt.equipment_id=p.equipment_id and mt.maintenance_program_id=p.maintenance_program_id and mt.status in ('programado','en_proceso'));
 select coalesce(jsonb_agg(value order by value->>'starts_at',value->>'event_key'),'[]'::jsonb) into result from jsonb_array_elements(booked||planned);
 return result;
end $$;
revoke all on function public.get_equipment_maintenance_dates(uuid),public.list_role_calendar(timestamptz,timestamptz) from public,anon;
grant execute on function public.get_equipment_maintenance_dates(uuid),public.list_role_calendar(timestamptz,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
