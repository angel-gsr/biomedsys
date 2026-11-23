-- Allow reporter-selected initial priority and explicit non-applicable defaults.
begin;
set local lock_timeout = '10s';
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

alter table public.reports alter column patient_outcome set default 'No aplica';
alter table public.reports alter column action_taken set default 'No aplica';
notify pgrst, 'reload schema';
commit;
