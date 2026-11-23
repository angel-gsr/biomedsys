begin;
set local lock_timeout='10s';
alter table public.reports add column observations text;

create or replace function public.complete_selective_report()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare original_description text:=nullif(btrim(new.description),''); selected_incident text:=coalesce(nullif(btrim(new.incident_label),''),nullif(btrim(new.event_type),''));
begin
  if tg_op='INSERT' then
    if selected_incident is null then raise exception 'Selecciona un incidente'; end if;
    new.observations:=coalesce(nullif(btrim(new.observations),''),case when original_description is distinct from selected_incident then original_description end);
    new.description:=selected_incident;
  else
    if new.observations is distinct from old.observations then
      if not public.has_active_profile() or old.reporter_id<>auth.uid() or clock_timestamp()>=old.created_at+interval '10 minutes' then raise exception 'La edición de observaciones está cerrada'; end if;
      new.observations:=nullif(btrim(new.observations),'');new.edited_at:=clock_timestamp();
    end if;
    if new.incident_label is distinct from old.incident_label and new.incident_label is not null then new.description:=new.incident_label; end if;
  end if;
  return new;
end $$;
create trigger zz_complete_selective_report before insert or update on public.reports for each row execute function public.complete_selective_report();

create or replace function public.stop_equipment_after_report()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform pg_advisory_xact_lock(20261122,20);
  update public.equipment_assets set status='fuera_de_servicio' where id=new.equipment_id and active;
  if not found then raise exception 'El equipo no está disponible para reportar'; end if;
  return new;
end $$;
create trigger stop_equipment_after_report after insert on public.reports for each row execute function public.stop_equipment_after_report();

create or replace function public.ensure_clinical_equipment_operational()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.status='programado' and new.kind in ('cirugia','uso_equipo') then
    perform pg_advisory_xact_lock(20261122,20);
    if exists(select 1 from public.equipment_assets where id=any(new.equipment_ids) and (not active or status<>'operativo')) then raise exception 'El equipo no está operativo; requiere revisión biomédica antes de reservarlo para uso clínico'; end if;
  end if;
  return new;
end $$;
create trigger ensure_clinical_equipment_operational before insert or update on public.calendar_bookings for each row execute function public.ensure_clinical_equipment_operational();

-- User-authorized baseline: active equipment starts operational. Archived assets stay archived.
update public.equipment_assets set status='operativo' where active and status<>'operativo';
insert into public.audit_log(actor_id,action,entity_type,metadata)
values(null,'operational_baseline','equipment_assets',jsonb_build_object('reason','Estado inicial operativo solicitado por el propietario; futuros reportes retiran el equipo de servicio'));
revoke all on function public.complete_selective_report(),public.stop_equipment_after_report(),public.ensure_clinical_equipment_operational() from public,anon,authenticated;
create or replace function public.edit_report_incident(target_report_id bigint, changes jsonb, expected_edited_at timestamptz)
returns public.reports language plpgsql security definer set search_path = public, pg_temp as $$
declare old_row public.reports; result public.reports;
begin
  if not public.has_active_profile() then raise exception 'Perfil activo requerido'; end if;
  select * into old_row from public.reports where id = target_report_id and reporter_id = auth.uid() for update;
  if old_row.id is null then raise exception 'Solo el autor puede editar su reporte'; end if;
  if clock_timestamp() >= old_row.created_at + interval '10 minutes' then raise exception 'El margen de 10 minutos ha terminado'; end if;
  if old_row.edited_at is distinct from expected_edited_at then raise exception 'El reporte cambió. Recarga la vista previa'; end if;
  if changes is null or jsonb_typeof(changes) <> 'object' then raise exception 'Cambios inválidos'; end if;
  if exists (select 1 from jsonb_object_keys(changes) k where k not in ('event_date','event_type','description','patient_outcome','action_taken','incident_option_id','incident_label','observations')) then
    raise exception 'Solo pueden corregirse los datos del incidente';
  end if;
  if nullif(btrim(changes->>'description'),'') is null or nullif(btrim(changes->>'event_type'),'') is null
     or nullif(changes->>'event_date','') is null then raise exception 'Completa fecha, tipo y descripción'; end if;
  update public.reports set event_date = (changes->>'event_date')::date,
    event_type = btrim(changes->>'event_type'), description = btrim(changes->>'description'),
    patient_outcome = nullif(changes->>'patient_outcome',''), action_taken = nullif(changes->>'action_taken',''),
    incident_option_id = case when changes ? 'incident_option_id' then nullif(changes->>'incident_option_id','')::bigint else old_row.incident_option_id end,
    incident_label = case when changes ? 'incident_label' then nullif(changes->>'incident_label','') else old_row.incident_label end,
    observations = case when changes ? 'observations' then nullif(changes->>'observations','') else old_row.observations end
  where id = target_report_id returning * into result;
  return result;
end $$;
notify pgrst,'reload schema';
commit;
