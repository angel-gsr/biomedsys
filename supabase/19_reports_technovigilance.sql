-- Report identity snapshots, author corrections and biomedical incident review.
begin;
set local lock_timeout = '10s';

alter table public.reports
  add column equipment_snapshot jsonb not null default '{}'::jsonb,
  add column edited_at timestamptz;

create or replace function public.get_report_equipment_identity(target_equipment_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  if not public.has_active_profile() then raise exception 'Perfil activo requerido'; end if;
  select jsonb_build_object('id', ea.id, 'inventory_code', ea.inventory_code,
    'equipment_type', et.name, 'manufacturer', mf.name, 'model', em.name,
    'serial_number', ea.serial_number, 'hospital_area', ha.name,
    'location', el.name, 'hospital_area_id', ea.hospital_area_id, 'location_id', ea.location_id)
  into result
  from public.equipment_assets ea
  join public.equipment_models em on em.id = ea.equipment_model_id
  join public.equipment_types et on et.id = em.equipment_type_id
  join public.manufacturers mf on mf.id = em.manufacturer_id
  join public.hospital_areas ha on ha.id = ea.hospital_area_id
  left join public.equipment_locations el on el.id = ea.location_id
  where ea.id = target_equipment_id;
  if result is null then raise exception 'Equipo no encontrado'; end if;
  return result;
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
    new.priority := 'Ordinaria'; new.status := 'Recibido'; new.maintenance_id := null;
  else
    if row(new.reporter_id, new.equipment_id, new.equipment_identifier, new.service,
      new.location, new.manufacturer, new.model_serial, new.equipment_snapshot, new.created_at)
      is distinct from row(old.reporter_id, old.equipment_id, old.equipment_identifier, old.service,
      old.location, old.manufacturer, old.model_serial, old.equipment_snapshot, old.created_at) then
      raise exception 'Los datos del equipo y del autor están bloqueados';
    end if;
    if row(new.event_date, new.event_type, new.description, new.patient_outcome, new.action_taken)
       is distinct from row(old.event_date, old.event_type, old.description, old.patient_outcome, old.action_taken) then
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
create trigger protect_report_identity before insert or update on public.reports
for each row execute function public.protect_report_identity();

-- Biomedical staff receive the incident inbox; users retain only their own reports.
drop policy if exists "active users read authorized reports" on public.reports;
create policy "active users read authorized reports" on public.reports for select to authenticated
using (public.has_active_profile() and (reporter_id = auth.uid() or public.is_technician_or_manager()));

create or replace function public.get_report_preview(target_report_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare result public.reports;
begin
  if not public.has_active_profile() then raise exception 'Perfil activo requerido'; end if;
  select * into result from public.reports where id = target_report_id
    and (reporter_id = auth.uid() or public.is_technician_or_manager());
  if result.id is null then raise exception 'Reporte no disponible'; end if;
  return jsonb_build_object('report', to_jsonb(result), 'server_now', statement_timestamp(),
    'can_edit', result.reporter_id = auth.uid() and statement_timestamp() < result.created_at + interval '10 minutes',
    'editable_until', result.created_at + interval '10 minutes');
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
  if exists (select 1 from jsonb_object_keys(changes) k where k not in ('event_date','event_type','description','patient_outcome','action_taken')) then
    raise exception 'Solo pueden corregirse los datos del incidente';
  end if;
  if nullif(btrim(changes->>'description'),'') is null or nullif(btrim(changes->>'event_type'),'') is null
     or nullif(changes->>'event_date','') is null then raise exception 'Completa fecha, tipo y descripción'; end if;
  update public.reports set event_date = (changes->>'event_date')::date,
    event_type = btrim(changes->>'event_type'), description = btrim(changes->>'description'),
    patient_outcome = nullif(changes->>'patient_outcome',''), action_taken = nullif(changes->>'action_taken','')
  where id = target_report_id returning * into result;
  return result;
end $$;

create table public.technovigilance_reviews (
  id bigint generated by default as identity unique,
  report_id bigint primary key references public.reports(id),
  internal_risk text not null check (internal_risk in ('catastrofico','alto','medio','bajo')),
  failure_type text not null check (nullif(btrim(failure_type),'') is not null),
  confirmed_on date,
  regulatory_case text not null check (regulatory_case in ('pendiente','amenaza_publica','muerte_deterioro_grave','otro_notificable','no_notificable')),
  internal_due_on date not null,
  regulatory_due_on date,
  legal_record_reference text,
  legal_record_completed_on date,
  notification_reference text,
  notified_on date,
  notes text,
  reviewed_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  check ((regulatory_case in ('pendiente','no_notificable') and regulatory_due_on is null)
    or (regulatory_case not in ('pendiente','no_notificable') and confirmed_on is not null and regulatory_due_on is not null)),
  check (legal_record_completed_on is null or nullif(btrim(legal_record_reference),'') is not null),
  check (notified_on is null or nullif(btrim(notification_reference),'') is not null)
);
alter table public.technovigilance_reviews enable row level security;
create policy "biomedical staff read incident reviews" on public.technovigilance_reviews for select to authenticated
using (public.is_technician_or_manager());
grant select on public.technovigilance_reviews to authenticated;
revoke insert,update,delete on public.technovigilance_reviews from authenticated,anon;
create trigger audit_technovigilance_reviews after insert or update on public.technovigilance_reviews
for each row execute function public.write_inventory_audit_log();

-- Weekends plus the official non-working dates entered by the institution.
create table public.technovigilance_holidays (holiday date primary key, description text not null);
alter table public.technovigilance_holidays enable row level security;
create policy "staff read regulatory holidays" on public.technovigilance_holidays for select to authenticated
using (public.is_technician_or_manager());
grant select on public.technovigilance_holidays to authenticated;
create policy "managers maintain regulatory holidays" on public.technovigilance_holidays for all to authenticated
using (public.is_manager()) with check (public.is_manager());
grant insert,update,delete on public.technovigilance_holidays to authenticated;

create or replace function public.save_technovigilance_review(target_report_id bigint, data jsonb)
returns public.technovigilance_reviews language plpgsql security definer set search_path = public, pg_temp as $$
declare source public.reports; result public.technovigilance_reviews; confirmed date;
  category text; risk text; due date; remaining integer;
begin
  if not public.is_technician_or_manager() then raise exception 'Solo personal biomédico activo'; end if;
  select * into source from public.reports where id = target_report_id;
  if source.id is null then raise exception 'Reporte no encontrado'; end if;
  category := data->>'regulatory_case'; risk := data->>'internal_risk';
  confirmed := nullif(data->>'confirmed_on','')::date;
  if confirmed > (now() at time zone 'America/Mexico_City')::date then raise exception 'La confirmación no puede estar en el futuro'; end if;
  if category not in ('pendiente','no_notificable') then
    if confirmed is null then raise exception 'Registra la fecha de confirmación para calcular el plazo normativo'; end if;
    if category = 'amenaza_publica' then
      due := confirmed; remaining := 2;
      while remaining > 0 loop
        due := due + 1;
        if extract(isodow from due) < 6 and not exists (select 1 from public.technovigilance_holidays h where h.holiday = due) then remaining := remaining - 1; end if;
      end loop;
    elsif category = 'muerte_deterioro_grave' then due := confirmed + 10;
    elsif category = 'otro_notificable' then due := confirmed + 30;
    else raise exception 'Clasificación normativa inválida'; end if;
  end if;
  if category = 'no_notificable' and nullif(btrim(data->>'notes'),'') is null then
    raise exception 'Justifica por qué el incidente no es notificable';
  end if;
  if nullif(data->>'legal_record_completed_on','')::date > (now() at time zone 'America/Mexico_City')::date
     or nullif(data->>'notified_on','')::date > (now() at time zone 'America/Mexico_City')::date then
    raise exception 'No se pueden registrar actuaciones en fechas futuras';
  end if;
  insert into public.technovigilance_reviews (report_id, internal_risk, failure_type, confirmed_on, regulatory_case,
    internal_due_on, regulatory_due_on, legal_record_reference, legal_record_completed_on, notification_reference, notified_on, notes, reviewed_by)
  values (target_report_id, risk, btrim(data->>'failure_type'), confirmed, category,
    (source.created_at at time zone 'America/Mexico_City')::date + case risk when 'catastrofico' then 10 when 'alto' then 10 when 'medio' then 15 when 'bajo' then 30 else null end,
    due, nullif(btrim(data->>'legal_record_reference'),''), nullif(data->>'legal_record_completed_on','')::date,
    nullif(btrim(data->>'notification_reference'),''), nullif(data->>'notified_on','')::date, nullif(data->>'notes',''), auth.uid())
  on conflict (report_id) do update set internal_risk = excluded.internal_risk, failure_type = excluded.failure_type,
    confirmed_on = excluded.confirmed_on, regulatory_case = excluded.regulatory_case, internal_due_on = excluded.internal_due_on,
    regulatory_due_on = excluded.regulatory_due_on, legal_record_reference = excluded.legal_record_reference,
    legal_record_completed_on = excluded.legal_record_completed_on, notification_reference = excluded.notification_reference,
    notified_on = excluded.notified_on, notes = excluded.notes, reviewed_by = auth.uid(), updated_at = clock_timestamp()
  returning * into result;
  return result;
end $$;

create or replace function public.refresh_technovigilance_calendar()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare incident public.technovigilance_reviews;
begin
  if not public.is_manager() then raise exception 'Solo el jefe puede cambiar el calendario'; end if;
  for incident in select * from public.technovigilance_reviews where regulatory_case = 'amenaza_publica' loop
    perform public.save_technovigilance_review(incident.report_id, to_jsonb(incident));
  end loop;
  return coalesce(new,old);
end $$;
create trigger refresh_technovigilance_calendar after insert or update or delete on public.technovigilance_holidays
for each row execute function public.refresh_technovigilance_calendar();
create trigger audit_technovigilance_holidays after insert or update or delete on public.technovigilance_holidays
for each row execute function public.write_inventory_audit_log();

create or replace function public.move_technovigilance_equipment(target_equipment_id uuid, target_area_id bigint, target_location_id bigint, reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_technician_or_manager() then raise exception 'Solo personal biomédico activo'; end if;
  if nullif(btrim(reason),'') is null then raise exception 'Indica el motivo del traslado'; end if;
  if not exists (select 1 from public.hospital_areas where id = target_area_id and active) then raise exception 'Área no disponible'; end if;
  if target_location_id is not null and not exists (select 1 from public.equipment_locations where id = target_location_id and hospital_area_id = target_area_id and active) then raise exception 'Ubicación incompatible con el área'; end if;
  update public.equipment_assets set hospital_area_id = target_area_id, location_id = target_location_id where id = target_equipment_id;
  if not found then raise exception 'Equipo no encontrado'; end if;
  insert into public.audit_log(actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'technovigilance_move', 'equipment_assets', target_equipment_id::text,
    jsonb_build_object('reason',btrim(reason),'area_id',target_area_id,'location_id',target_location_id));
end $$;

revoke all on function public.get_report_equipment_identity(uuid), public.protect_report_identity(),
  public.refresh_technovigilance_calendar(),
  public.get_report_preview(bigint), public.edit_report_incident(bigint,jsonb,timestamptz),
  public.save_technovigilance_review(bigint,jsonb), public.move_technovigilance_equipment(uuid,bigint,bigint,text) from public,anon;
grant execute on function public.get_report_equipment_identity(uuid), public.get_report_preview(bigint),
  public.edit_report_incident(bigint,jsonb,timestamptz), public.save_technovigilance_review(bigint,jsonb),
  public.move_technovigilance_equipment(uuid,bigint,bigint,text) to authenticated;
notify pgrst, 'reload schema';
commit;
