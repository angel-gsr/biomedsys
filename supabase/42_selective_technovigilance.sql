-- Special safety report derived only from qualifying incident reports.
begin;
set local lock_timeout='10s';
alter table public.reports add column operator_outcome text not null default 'No aplica',add column potential_harm boolean not null default false;
alter table public.reports add constraint reports_operator_outcome_valid check(operator_outcome in ('No aplica','Sin lesión','Lesión temporal','Lesión moderada','Lesión grave','Fallecimiento'));
alter table public.technovigilance_reviews add column event_classification text check(event_classification in ('incidente_adverso','incidente_adverso_potencial')),
 add column affected_person text check(affected_person in ('paciente','operador','ambos')),
 add column impact_description text,add column safety_actions text;

create function public.technovigilance_eligible(r public.reports) returns boolean
language sql immutable set search_path=public,pg_temp as $$
 select coalesce(r.priority in ('Alta','Crítica'),false) or coalesce(r.potential_harm,false)
 or lower(translate(btrim(coalesce(r.patient_outcome,'')),'ÁÉÍÓÚáéíóú','AEIOUaeiou')) in ('lesion temporal','lesion moderada','lesion grave','fallecimiento')
 or lower(translate(btrim(coalesce(r.operator_outcome,'')),'ÁÉÍÓÚáéíóú','AEIOUaeiou')) in ('lesion temporal','lesion moderada','lesion grave','fallecimiento')
 or lower(translate(btrim(coalesce(r.event_type,'')),'ÁÉÍÓÚáéíóú','AEIOUaeiou')) in ('incidente adverso','incidente adverso potencial');
$$;
create function public.list_technovigilance_candidates() returns setof public.reports
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.has_active_profile() or not public.is_technician_or_manager() then raise exception 'Solo personal biomédico activo';end if;
 return query select r.* from public.reports r where public.technovigilance_eligible(r) order by r.created_at desc;
end $$;
create or replace function public.protect_report_identity()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare identity_data jsonb;
begin
  if TG_OP = 'INSERT' then
    if not public.has_active_profile() or new.reporter_id <> auth.uid() then raise exception 'Autor no autorizado'; end if;
    if new.equipment_id is null then raise exception 'Selecciona un equipo registrado'; end if;
    identity_data := public.get_report_equipment_identity(new.equipment_id);
    new.equipment_snapshot := identity_data;
    new.equipment_identifier := identity_data->>'inventory_code';
    new.service := identity_data->>'hospital_area';
    new.location := concat_ws(' · ', identity_data->>'hospital_area', identity_data->>'location');
    new.manufacturer := identity_data->>'manufacturer';
    new.model_serial := concat_ws(' / ', identity_data->>'model', identity_data->>'serial_number');
    new.created_at := clock_timestamp();
    new.edited_at := null;
    new.priority := coalesce(nullif(btrim(new.priority), ''), 'Ordinaria');
    new.patient_outcome := coalesce(nullif(btrim(new.patient_outcome), ''), 'No aplica');
    new.action_taken := coalesce(nullif(btrim(new.action_taken), ''), 'No aplica');
    new.status := 'Recibido'; new.maintenance_id := null;
  else
    if row(new.reporter_id, new.equipment_id, new.equipment_identifier, new.service,
      new.location, new.manufacturer, new.model_serial, new.equipment_snapshot, new.created_at)
      is distinct from row(old.reporter_id, old.equipment_id, old.equipment_identifier, old.service,
      old.location, old.manufacturer, old.model_serial, old.equipment_snapshot, old.created_at) then
      raise exception 'Los datos del equipo y del autor están bloqueados';
    end if;
    if row(new.event_date, new.event_type, new.description, new.patient_outcome, new.action_taken,new.operator_outcome,new.potential_harm)
       is distinct from row(old.event_date, old.event_type, old.description, old.patient_outcome, old.action_taken,old.operator_outcome,old.potential_harm) then
      if not public.has_active_profile() or old.reporter_id <> auth.uid()
         or clock_timestamp() >= old.created_at + interval '10 minutes' then
        raise exception 'La edición del incidente está cerrada: solo el autor dispone de 10 minutos';
      end if;
      new.edited_at := clock_timestamp();
    elsif new.edited_at is distinct from old.edited_at then
      raise exception 'No se permite alterar la fecha de edición';
    end if;
  end if;
  return new;
end $$;

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
  if exists (select 1 from jsonb_object_keys(changes) k where k not in ('event_date','event_type','description','patient_outcome','action_taken','incident_option_id','incident_label','observations','operator_outcome','potential_harm')) then
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
  , operator_outcome=case when changes ? 'operator_outcome' then coalesce(nullif(changes->>'operator_outcome',''),'No aplica') else old_row.operator_outcome end,
    potential_harm=case when changes ? 'potential_harm' then coalesce((changes->>'potential_harm')::boolean,false) else old_row.potential_harm end
  where id = target_report_id returning * into result;
  return result;
end $$;

alter function public.save_technovigilance_review(bigint,jsonb) rename to save_technovigilance_review_legacy;
revoke all on function public.save_technovigilance_review_legacy(bigint,jsonb) from public,anon,authenticated;
create function public.save_technovigilance_review(target_report_id bigint,data jsonb) returns public.technovigilance_reviews
language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.reports;result public.technovigilance_reviews;
begin
 if not public.has_active_profile() or not public.is_technician_or_manager() then raise exception 'Solo personal biomédico activo';end if;
 select * into r from public.reports where id=target_report_id for share;
 if r.id is null or not public.technovigilance_eligible(r) then raise exception 'El reporte no cumple los criterios de tecnovigilancia';end if;
 if data is null or jsonb_typeof(data)<>'object' then raise exception 'Formulario inválido';end if;
 if coalesce(data->>'event_classification','') not in ('incidente_adverso','incidente_adverso_potencial') or coalesce(data->>'affected_person','') not in ('paciente','operador','ambos') then raise exception 'Clasifica el incidente adverso y la persona afectada o en riesgo';end if;
 if nullif(trim(data->>'impact_description'),'') is null or nullif(trim(data->>'safety_actions'),'') is null then raise exception 'Completa las consecuencias o riesgo y las medidas de seguridad';end if;
 if length(data->>'impact_description')>8000 or length(data->>'safety_actions')>8000 or length(data->>'notes')>8000 or length(data->>'failure_type')>500 then raise exception 'El texto supera el límite permitido';end if;
 result:=public.save_technovigilance_review_legacy(target_report_id,data);
 update public.technovigilance_reviews set event_classification=data->>'event_classification',affected_person=data->>'affected_person',
  impact_description=trim(data->>'impact_description'),safety_actions=trim(data->>'safety_actions') where report_id=target_report_id returning * into result;
 return result;
end $$;
-- Recalculate dates of preserved historical records without reclassifying them.
create or replace function public.refresh_technovigilance_calendar() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare incident public.technovigilance_reviews;
begin
 for incident in select * from public.technovigilance_reviews where regulatory_case='amenaza_publica' loop
  perform public.save_technovigilance_review_legacy(incident.report_id,to_jsonb(incident));
 end loop;
 return null;
end $$;
create function public.get_technovigilance_document(target_report_id bigint) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare r public.reports;review public.technovigilance_reviews;author jsonb;
begin
 if not public.has_active_profile() or not public.is_technician_or_manager() then raise exception 'Solo personal biomédico activo';end if;
 select * into r from public.reports where id=target_report_id;
 if r.id is null or not public.technovigilance_eligible(r) then raise exception 'El reporte no cumple los criterios de tecnovigilancia';end if;
 select * into review from public.technovigilance_reviews where report_id=r.id;
 if review.report_id is null or review.event_classification is null or review.affected_person is null or nullif(trim(review.impact_description),'') is null or nullif(trim(review.safety_actions),'') is null then raise exception 'Completa y guarda el formulario especial antes de generar el PDF';end if;
 select jsonb_build_object('full_name',full_name,'institutional_id',institutional_id,'department',department) into author from public.profiles where id=review.reviewed_by;
 return jsonb_build_object('report',to_jsonb(r),'review',to_jsonb(review),'reviewer',author,'generated_at',statement_timestamp());
end $$;
revoke all on function public.technovigilance_eligible(public.reports),public.list_technovigilance_candidates(),public.save_technovigilance_review(bigint,jsonb),public.get_technovigilance_document(bigint) from public,anon;
grant execute on function public.list_technovigilance_candidates(),public.save_technovigilance_review(bigint,jsonb),public.get_technovigilance_document(bigint) to authenticated;
notify pgrst,'reload schema';
commit;
