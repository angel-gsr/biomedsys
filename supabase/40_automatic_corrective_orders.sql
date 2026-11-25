-- Reports create a corrective service order, then a technician claims it or a manager assigns it.
begin;
set local lock_timeout='10s';
create or replace function public.can_access_attachment(target_attachment_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.file_attachments fa
    where fa.id = target_attachment_id and fa.deleted_at is null
      and public.has_active_profile()
      and (
        public.is_manager() or fa.uploaded_by = auth.uid()
        or (fa.equipment_id is not null and public.is_technician_or_manager())
        or (fa.equipment_id is not null and fa.report_id is null and fa.maintenance_id is null and fa.training_id is null and fa.quote_id is null
          and exists(select 1 from public.equipment_assets a where a.id=fa.equipment_id and a.active))
        or exists (select 1 from public.reports r where r.id = fa.report_id and r.reporter_id = auth.uid())
        or (public.is_technician_or_manager() and exists (select 1 from public.maintenances m where m.id = fa.maintenance_id and (m.assigned_to = auth.uid() or m.created_by = auth.uid())))
        or exists (select 1 from public.trainings t where t.id = fa.training_id and (t.instructor_id = auth.uid() or exists (
          select 1 from public.training_participants tp where tp.training_id = t.id and tp.participant_id = auth.uid()
        )))
        or exists (select 1 from public.quotes q where q.id = fa.quote_id and q.requested_by = auth.uid())
      )
  )
$$;

create or replace function public.guard_calendar_schedule()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare eq uuid[]; room bigint; start_time timestamptz; end_time timestamptz; key text; enabled boolean;
begin
  if tg_table_name='calendar_bookings' then
    eq:=new.equipment_ids;room:=new.location_id;start_time:=new.starts_at;end_time:=new.ends_at;
    key:='reserva:'||new.id;enabled:=new.status='programado';new.updated_at:=clock_timestamp();
    if exists (select 1 from unnest(eq) requested(equipment_id) where not exists (select 1 from public.equipment_assets a where a.id=requested.equipment_id and a.active)) then raise exception 'Equipo no disponible'; end if;
  elsif tg_table_name='maintenances' then
    eq:=case when new.equipment_id is null then '{}'::uuid[] else array[new.equipment_id] end;
    room:=new.calendar_location_id;start_time:=new.scheduled_at;end_time:=new.scheduled_end_at;
    key:='mantenimiento:'||new.id;enabled:=new.status in ('programado','en_proceso');
    if enabled and new.maintenance_program_id is not null then
      perform pg_advisory_xact_lock(20261122,20);
      if exists(select 1 from public.maintenances m where m.id<>new.id and m.equipment_id=new.equipment_id
        and m.maintenance_program_id=new.maintenance_program_id and m.status in ('programado','en_proceso')) then
        raise exception 'Ya existe una orden preventiva activa para este equipo y rutina';
      end if;
    end if;
  else
    eq:=case when new.equipment_id is null then '{}'::uuid[] else array[new.equipment_id] end;
    room:=new.calendar_location_id;start_time:=new.scheduled_at;end_time:=new.scheduled_end_at;
    key:='capacitacion:'||new.id;enabled:=new.status in ('programada','en_curso');
  end if;
  -- A fault is unplanned: recording/assigning its corrective order must not be rejected by an existing reservation.
  if tg_table_name='maintenances' then
    if new.maintenance_code='MC' then return new; end if;
  end if;
  if enabled then perform public.assert_calendar_availability(key,start_time,end_time,room,eq); end if;
  return new;
end $$;
create or replace function public.calendar_resource_events()
returns table(event_key text,kind text,title text,starts_at timestamptz,ends_at timestamptz,
  location_id bigint,equipment_ids uuid[],status text,blocks_resources boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select 'reserva:'||b.id,b.kind,b.title,b.starts_at,b.ends_at,b.location_id,b.equipment_ids,b.status,b.status='programado'
  from public.calendar_bookings b
  union all
  select 'mantenimiento:'||m.id,'mantenimiento',m.maintenance_number||coalesce(' · '||m.equipment_identifier,''),
    m.scheduled_at,m.scheduled_end_at,m.calendar_location_id,
    case when m.equipment_id is null then '{}'::uuid[] else array[m.equipment_id] end,m.status,(m.status in ('programado','en_proceso') and (m.maintenance_code<>'MC' or m.assigned_to is not null))
  from public.maintenances m
  union all
  select 'capacitacion:'||t.id,'capacitacion',t.title,t.scheduled_at,t.scheduled_end_at,t.calendar_location_id,
    case when t.equipment_id is null then '{}'::uuid[] else array[t.equipment_id] end,t.status,t.status in ('programada','en_curso')
  from public.trainings t
$$;


create function public.queue_corrective_report(target_report_id bigint) returns public.maintenances language plpgsql security definer set search_path=public,pg_temp as $$
declare report_row public.reports;result public.maintenances;code text;
begin
 perform pg_advisory_xact_lock(20261122,20);
 select * into report_row from public.reports where id=target_report_id for update;
 if report_row.id is null or report_row.status in ('Resuelto','Cerrado') then return null; end if;
 if report_row.maintenance_id is not null then select * into result from public.maintenances where id=report_row.maintenance_id;return result;end if;
 select inventory_code into code from public.equipment_assets where id=report_row.equipment_id and active;
 if code is null then raise exception 'El reporte requiere un equipo activo'; end if;
 select * into result from public.maintenances where source_report_id=report_row.id and status in ('programado','en_proceso') for update;
 if result.id is null then
  insert into public.maintenances(maintenance_number,maintenance_code,equipment_identifier,equipment_id,source_report_id,status,scheduled_at,assigned_to,created_by,priority)
  values('','MC',code,report_row.equipment_id,report_row.id,'programado',now(),null,report_row.reporter_id,case report_row.priority when 'Crítica' then 'critica' when 'Alta' then 'alta' else 'ordinaria' end) returning * into result;
 end if;
 update public.reports set maintenance_id=result.id where id=report_row.id;
 update public.equipment_assets set status='fuera_de_servicio' where id=report_row.equipment_id and active and status<>'fuera_de_servicio';
 return result;
end $$;
create function public.queue_new_report_corrective() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin perform public.queue_corrective_report(new.id);return new;end $$;
create trigger zz_queue_new_report_corrective after insert on public.reports for each row execute function public.queue_new_report_corrective();

create function public.list_available_corrective_orders() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.is_technician_or_manager() then raise exception 'Solo personal biomédico habilitado'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(item) order by item.rank,item.created_at),'[]'::jsonb) from (
  select m.id,m.maintenance_number,m.equipment_identifier,m.equipment_id,m.source_report_id,r.report_number,r.description,r.service,r.location,m.priority,m.created_at,case m.priority when 'critica' then 0 when 'alta' then 1 else 2 end rank
  from public.maintenances m join public.reports r on r.id=m.source_report_id where m.maintenance_code='MC' and m.assigned_to is null and m.status='programado' and r.status not in ('Resuelto','Cerrado')
 ) item);
end $$;
create function public.claim_corrective_order(target_maintenance_id bigint) returns public.maintenances language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.maintenances;
begin
 if not public.is_active_technician() then raise exception 'Solo un ingeniero biomédico habilitado puede tomar la orden'; end if;
 perform pg_advisory_xact_lock(20261122,20);
 select * into result from public.maintenances where id=target_maintenance_id for update;
 if result.id is null or result.maintenance_code<>'MC' or result.source_report_id is null or result.status not in ('programado','en_proceso') then raise exception 'Orden correctiva no disponible'; end if;
 if result.assigned_to=auth.uid() then return result; end if;
 if result.assigned_to is not null then raise exception 'Otro ingeniero ya tomó esta orden. Actualiza la lista.'; end if;
 if not exists(select 1 from public.reports where id=result.source_report_id and status not in ('Resuelto','Cerrado')) then raise exception 'El reporte ya está finalizado'; end if;
 update public.maintenances set assigned_to=auth.uid(),scheduled_at=now() where id=result.id returning * into result;
 update public.reports set status='Asignado' where id=result.source_report_id;
 return result;
end $$;

create or replace function public.create_corrective_order_from_report(target_report_id bigint,target_assigned_to uuid,target_priority text,target_scheduled_at timestamptz)
returns public.maintenances language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.maintenances;report_row public.reports;priority_value text:=lower(btrim(target_priority));
begin
 if not public.is_manager() then raise exception 'Operación reservada para el rol jefe'; end if;
 if priority_value is null or priority_value not in ('critica','alta','ordinaria') then raise exception 'Prioridad no válida';end if;
 if target_scheduled_at is null then raise exception 'La fecha de atención es obligatoria';end if;
 if not exists(select 1 from public.profiles where id=target_assigned_to and role='tecnico' and active and deleted_at is null) then raise exception 'Selecciona un ingeniero biomédico habilitado';end if;
 perform pg_advisory_xact_lock(20261122,20);
 select * into report_row from public.reports where id=target_report_id for update;
 if report_row.id is null or report_row.status in ('Resuelto','Cerrado') then raise exception 'Reporte no disponible';end if;
 result:=public.queue_corrective_report(target_report_id);
 select * into result from public.maintenances where id=result.id for update;
 if result.id is null or result.assigned_to is not null or result.status<>'programado' then raise exception 'La orden ya fue asignada o no está disponible';end if;
 update public.maintenances set assigned_to=target_assigned_to,priority=priority_value,scheduled_at=target_scheduled_at where id=result.id returning * into result;
 update public.reports set status='Asignado',priority=case priority_value when 'critica' then 'Crítica' when 'alta' then 'Alta' else 'Ordinaria' end where id=target_report_id;
 return result;
end $$;
revoke all on function public.queue_corrective_report(bigint),public.queue_new_report_corrective() from public,anon,authenticated;
revoke all on function public.list_available_corrective_orders(),public.claim_corrective_order(bigint) from public,anon;
grant execute on function public.list_available_corrective_orders(),public.claim_corrective_order(bigint) to authenticated;
-- Automatic creation applies to new reports only. Existing records are unchanged.
create or replace function public.get_report_preview(target_report_id bigint)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result public.reports;author_data jsonb;order_number text;
begin
 if not public.has_active_profile() then raise exception 'Perfil activo requerido';end if;
 select * into result from public.reports where id=target_report_id and (reporter_id=auth.uid() or public.is_technician_or_manager());
 if result.id is null then raise exception 'Reporte no disponible';end if;
 select jsonb_build_object('full_name',full_name,'institutional_id',institutional_id,'department',department) into author_data from public.profiles where id=result.reporter_id;
 select maintenance_number into order_number from public.maintenances where id=result.maintenance_id;
 return jsonb_build_object('report',to_jsonb(result)||jsonb_build_object('reporter_snapshot',author_data,'maintenance_number',order_number),'server_now',statement_timestamp(),'can_edit',result.reporter_id=auth.uid() and statement_timestamp()<result.created_at+interval '10 minutes','editable_until',result.created_at+interval '10 minutes');
end $$;

commit;
