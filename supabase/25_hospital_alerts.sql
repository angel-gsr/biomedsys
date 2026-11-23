-- Hospital code catalogue, recipient-scoped live alerts and durable notifications.
begin;
set local lock_timeout = '10s';

create table public.hospital_codes (
  code text primary key,
  name text not null,
  description text not null,
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  audience text not null check (audience in ('todos','biomedicos')),
  audible boolean not null default false,
  sort_order smallint not null
);
insert into public.hospital_codes values
('ambar','Ámbar','Paciente perdido','#d97706','biomedicos',false,1),
('azul','Azul','Paro cardiorrespiratorio','#1565c0','biomedicos',false,2),
('cafe','Café','Desastre natural','#795548','todos',true,3),
('negro','Negro','Amenaza de bomba','#171717','todos',true,4),
('rojo','Rojo','Alerta de fuego','#c62828','todos',true,5),
('rosa','Rosa','Robo de recién nacido o pediátrico','#d15493','biomedicos',false,6),
('verde','Verde','Evacuación de instalaciones','#198754','todos',true,7),
('amarillo','Amarillo','Derrame de material peligroso','#f2cf00','todos',true,8),
('blanco','Blanco','Asistencia por caída de paciente','#ffffff','biomedicos',false,9),
('magenta','Magenta','Falla o daño en el sistema','#c21887','biomedicos',false,10),
('morado','Morado','Persona violenta','#7b3fb3','biomedicos',false,11),
('naranja','Naranja','Arribo masivo de pacientes','#ef6c00','biomedicos',false,12),
('oro','Oro','Emergencia obstétrica','#b08d28','biomedicos',false,13),
('plata','Plata','Agresión de persona con arma','#a5abb3','todos',true,14);

create table public.hospital_alerts (
  id bigint generated always as identity primary key,
  request_id uuid not null unique,
  code text not null references public.hospital_codes(code),
  emitted_by uuid not null references public.profiles(id),
  location text not null check (length(btrim(location)) between 2 and 160),
  details text check (length(details) <= 1000),
  status text not null default 'activa' check (status in ('activa','en_atencion','cerrada')),
  created_at timestamptz not null default clock_timestamp(),
  taken_by uuid references public.profiles(id),
  taken_at timestamptz,
  closed_by uuid references public.profiles(id),
  closed_at timestamptz,
  closure_notes text
);
create index hospital_alerts_active_idx on public.hospital_alerts(created_at desc) where status <> 'cerrada';
alter table public.hospital_codes enable row level security;
alter table public.hospital_alerts enable row level security;
revoke all on public.hospital_codes, public.hospital_alerts from anon, authenticated;
grant select on public.hospital_codes, public.hospital_alerts to authenticated;
create policy "active profiles read hospital codes" on public.hospital_codes for select to authenticated
using (public.has_active_profile());
create policy "recipients read hospital alerts" on public.hospital_alerts for select to authenticated
using (public.has_active_profile() and (emitted_by=auth.uid() or public.is_technician_or_manager()
  or exists(select 1 from public.hospital_codes c where c.code=hospital_alerts.code and c.audience='todos')));

create or replace function public.emit_hospital_alert(target_code text, target_location text, alert_details text, client_request_id uuid)
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare selected public.hospital_codes; existing public.hospital_alerts; alert_id bigint;
begin
  if not public.has_active_profile() then raise exception 'Perfil activo requerido'; end if;
  if client_request_id is null then raise exception 'Identificador de envío requerido'; end if;
  perform pg_advisory_xact_lock(hashtextextended(client_request_id::text,25));
  select * into existing from public.hospital_alerts where request_id=client_request_id;
  if existing.id is not null then
    if existing.emitted_by<>auth.uid() then raise exception 'Envío no autorizado'; end if;
    if row(existing.code,existing.location,existing.details) is distinct from row(target_code,btrim(target_location),nullif(btrim(alert_details),'')) then raise exception 'El envío ya contiene otra alerta'; end if;
    return existing.id;
  end if;
  select * into selected from public.hospital_codes where code=target_code;
  if selected.code is null then raise exception 'Código hospitalario no válido'; end if;
  if target_location is null or length(btrim(target_location)) not between 2 and 160 then raise exception 'Indica el área y la ubicación de la emergencia'; end if;
  if length(alert_details)>1000 then raise exception 'Las observaciones exceden el límite'; end if;
  insert into public.hospital_alerts(request_id,code,emitted_by,location,details)
  values(client_request_id,selected.code,auth.uid(),btrim(target_location),nullif(btrim(alert_details),'')) returning id into alert_id;
  insert into public.notifications(recipient_id,event_type,title,message,entity_type,entity_id,deduplication_key)
  select p.id,'hospital_alert','Código '||selected.name||' · '||selected.description,
    'Ubicación: '||btrim(target_location)||coalesce(' · '||nullif(btrim(alert_details),''),''),
    'hospital_alert',alert_id::text,'hospital:'||alert_id||':emit:'||p.id
  from public.profiles p where p.active and (selected.audience='todos' or p.role in ('jefe','tecnico') or p.id=auth.uid());
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'hospital_alert_emitted','hospital_alert',alert_id::text,jsonb_build_object('code',selected.code,'audience',selected.audience));
  return alert_id;
end $$;

create or replace function public.list_hospital_alerts(include_closed boolean default false)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if not public.has_active_profile() then raise exception 'Perfil activo requerido'; end if;
  return coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (
    select h.*,c.name as code_name,c.description as code_description,c.color,c.audience,c.audible,
      emitter.full_name as emitter_name,responder.full_name as responder_name
    from public.hospital_alerts h join public.hospital_codes c on c.code=h.code
    join public.profiles emitter on emitter.id=h.emitted_by left join public.profiles responder on responder.id=h.taken_by
    where (include_closed or h.status<>'cerrada')
      and (h.emitted_by=auth.uid() or public.is_technician_or_manager() or c.audience='todos')
    order by h.created_at desc limit 100
  ) a),'[]'::jsonb);
end $$;

create or replace function public.update_hospital_alert(target_alert_id bigint, target_status text, resolution text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare current_alert public.hospital_alerts; selected public.hospital_codes;
begin
  if not public.has_active_profile() or not public.is_technician_or_manager() then raise exception 'Solo jefe o biomédico puede atender o cerrar alertas'; end if;
  if target_status not in ('en_atencion','cerrada') or target_status is null then raise exception 'Estado no válido'; end if;
  select * into current_alert from public.hospital_alerts where id=target_alert_id for update;
  if current_alert.id is null then raise exception 'Alerta no encontrada'; end if;
  if current_alert.status='cerrada' then raise exception 'La alerta ya está cerrada'; end if;
  if target_status='en_atencion' and current_alert.status<>'activa' then raise exception 'La alerta ya está en atención'; end if;
  if target_status='cerrada' and (resolution is null or length(btrim(resolution)) not between 5 and 1000) then raise exception 'Indica el motivo del cierre (5 a 1000 caracteres)'; end if;
  update public.hospital_alerts set status=target_status,
    taken_by=case when target_status='en_atencion' then auth.uid() else taken_by end,
    taken_at=case when target_status='en_atencion' then clock_timestamp() else taken_at end,
    closed_by=case when target_status='cerrada' then auth.uid() else null end,
    closed_at=case when target_status='cerrada' then clock_timestamp() else null end,
    closure_notes=case when target_status='cerrada' then btrim(resolution) else null end where id=target_alert_id;
  select * into selected from public.hospital_codes where code=current_alert.code;
  insert into public.notifications(recipient_id,event_type,title,message,entity_type,entity_id,deduplication_key)
  select p.id,'hospital_alert_status','Código '||selected.name||case when target_status='cerrada' then ' · Cerrado' else ' · En atención' end,
    'Ubicación: '||current_alert.location||coalesce(' · '||nullif(btrim(resolution),''),''),'hospital_alert',target_alert_id::text,
    'hospital:'||target_alert_id||':'||target_status||':'||p.id from public.profiles p where p.active
    and (selected.audience='todos' or p.role in ('jefe','tecnico') or p.id=current_alert.emitted_by);
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'hospital_alert_'||target_status,'hospital_alert',target_alert_id::text,jsonb_build_object('resolution',resolution));
end $$;

revoke all on function public.emit_hospital_alert(text,text,text,uuid), public.list_hospital_alerts(boolean), public.update_hospital_alert(bigint,text,text) from public,anon;
grant execute on function public.emit_hospital_alert(text,text,text,uuid), public.list_hospital_alerts(boolean), public.update_hospital_alert(bigint,text,text) to authenticated;
do $$
declare tbl text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach tbl in array array['notifications','hospital_alerts'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=tbl) then
        execute format('alter publication supabase_realtime add table public.%I',tbl);
      end if;
    end loop;
  end if;
end $$;
notify pgrst,'reload schema';
commit;
