-- Loan vouchers use server-owned identity and equipment snapshots.
begin;
set local lock_timeout='10s';
alter table public.calendar_bookings add column loan_snapshot jsonb;
create function public.equipment_loan_snapshot(asset_id uuid,requester_id uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('equipment',jsonb_build_object('inventory_code',d.inventory_code,'equipment_type',d.equipment_type,'manufacturer',d.manufacturer,'model',d.model,'serial_number',case when a.serial_is_placeholder then null else d.serial_number end,'hospital_area',d.hospital_area,'location',d.location),
  'requester',jsonb_build_object('full_name',p.full_name,'institutional_id',p.institutional_id,'department',p.department),
  'institution',s.institution_name,'timezone',s.timezone,'snapshot_at',now())
 from public.equipment_inventory_detail d join public.equipment_assets a on a.id=d.id cross join public.profiles p cross join public.institution_settings s
 where d.id=asset_id and p.id=requester_id and s.id=1
$$;
create function public.capture_equipment_loan() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='INSERT' and new.kind='uso_equipo' then new.loan_snapshot:=public.equipment_loan_snapshot(new.equipment_ids[1],new.created_by); end if;
 if tg_op='UPDATE' and new.loan_snapshot is distinct from old.loan_snapshot then raise exception 'Los datos del vale no pueden modificarse'; end if;
 return new;
end $$;
create trigger capture_equipment_loan before insert or update on public.calendar_bookings for each row execute function public.capture_equipment_loan();
create function public.get_equipment_loan(target_booking_id bigint) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare booking public.calendar_bookings;snapshot jsonb;
begin
 if not public.has_active_profile() then raise exception 'Perfil habilitado requerido'; end if;
 select * into booking from public.calendar_bookings where id=target_booking_id and kind='uso_equipo';
 if booking.id is null or not (booking.created_by=auth.uid() or public.is_technician_or_manager()) then raise exception 'Vale no disponible o sin permiso de consulta'; end if;
 snapshot:=coalesce(booking.loan_snapshot,public.equipment_loan_snapshot(booking.equipment_ids[1],booking.created_by));
 return jsonb_build_object('id',booking.id,'created_at',booking.created_at,'starts_at',booking.starts_at,'ends_at',booking.ends_at,'destination',booking.usage_location,'status',booking.status,'snapshot',snapshot,'legacy',booking.loan_snapshot is null);
end $$;
revoke all on function public.equipment_loan_snapshot(uuid,uuid),public.capture_equipment_loan() from public,anon,authenticated;
revoke all on function public.get_equipment_loan(bigint) from public,anon;
grant execute on function public.get_equipment_loan(bigint) to authenticated;
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
 )select coalesce(jsonb_agg(to_jsonb(v)||jsonb_build_object('can_view_loan',case when v.kind='uso_equipo' then exists(select 1 from public.calendar_bookings b where v.event_key='reserva:'||b.id and (b.created_by=auth.uid() or viewer in ('jefe','tecnico'))) else false end,'can_cancel',case when v.kind='uso_equipo' then exists(select 1 from public.calendar_bookings b where v.event_key='reserva:'||b.id and (b.created_by=auth.uid() or viewer='jefe') and b.status='programado' and b.ends_at>now()) else false end) order by v.starts_at),'[]'::jsonb) into result from visible v
 where v.starts_at<to_time and (coalesce(v.ends_at,'infinity'::timestamptz)>from_time);
 return result;
end $$;


commit;
