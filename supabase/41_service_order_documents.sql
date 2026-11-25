-- Immutable technical PDF snapshots; only the assigned biomedical engineer can issue/sign.
begin;
set local lock_timeout='10s';
create table public.service_order_documents (
 id bigint generated always as identity primary key,
 maintenance_id bigint not null references public.maintenances(id),
 issued_by uuid not null references public.profiles(id),
 issued_at timestamptz not null default now(),
 record_updated_at timestamptz not null,
 snapshot jsonb not null,
 signature_png text,
 fingerprint text not null,
 unique(maintenance_id,fingerprint),
 check(signature_png is null or (length(signature_png)<=120000 and signature_png ~ '^data:image/png;base64,[A-Za-z0-9+/=]+$'))
);
alter table public.service_order_documents enable row level security;
revoke all on public.service_order_documents from anon,authenticated;

create function public.get_service_order_document(target_maintenance_id bigint) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not public.has_active_profile() or not public.is_technician_or_manager() then raise exception 'Acceso no autorizado';end if;
 if not exists(select 1 from public.maintenances where id=target_maintenance_id and (public.is_manager() or assigned_to=auth.uid())) then raise exception 'Orden no disponible';end if;
 select to_jsonb(d) into result from public.service_order_documents d where maintenance_id=target_maintenance_id order by id desc limit 1;
 return result;
end $$;

create function public.issue_service_order_document(target_maintenance_id bigint,signature_data text default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.maintenances;r public.maintenance_records;doc public.service_order_documents;
 report_data jsonb;equipment_data jsonb;payload jsonb;engineer_name text;digest text;
begin
 if not public.has_active_profile() or not exists(select 1 from public.profiles where id=auth.uid() and role='tecnico') then raise exception 'Solo el ingeniero asignado puede emitir el documento final';end if;
 select * into m from public.maintenances where id=target_maintenance_id for update;
 if m.id is null or m.assigned_to is distinct from auth.uid() or m.status not in ('en_proceso','completado') then raise exception 'Orden no disponible para este ingeniero';end if;
 select * into r from public.maintenance_records where maintenance_id=m.id for update;
 if r.id is null or r.performed_by is distinct from auth.uid() or r.completed_at is null
  or nullif(trim(r.diagnosis),'') is null or nullif(trim(r.work_performed),'') is null or nullif(trim(r.test_results),'') is null or r.equipment_condition is null then
  raise exception 'Completa y guarda el seguimiento antes de generar el documento final';
 end if;
 if signature_data is not null then
  if length(signature_data)>120000 or signature_data !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$' then raise exception 'Firma no válida';end if;
  if encode(substring(decode(split_part(signature_data,',',2),'base64') from 1 for 8),'hex')<>'89504e470d0a1a0a' then raise exception 'Firma no válida';end if;
 end if;
 select full_name into engineer_name from public.profiles where id=auth.uid();
 select to_jsonb(e) into equipment_data from public.equipment_inventory_detail e where e.id=m.equipment_id;
 if m.source_report_id is not null then select to_jsonb(p) into report_data from public.reports p where id=m.source_report_id;end if;
 payload:=jsonb_build_object('item',to_jsonb(m)||jsonb_build_object('record',to_jsonb(r),'equipment',equipment_data,'assigned_to_name',engineer_name,
  'report_number',report_data->>'report_number','activities',coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.maintenance_activities a where a.maintenance_id=m.id),'[]'::jsonb)),
  'report',report_data);
 digest:=md5(payload::text||coalesce(signature_data,''));
 insert into public.service_order_documents(maintenance_id,issued_by,record_updated_at,snapshot,signature_png,fingerprint)
 values(m.id,auth.uid(),r.updated_at,payload,signature_data,digest)
 on conflict(maintenance_id,fingerprint) do nothing returning * into doc;
 if doc.id is null then select * into doc from public.service_order_documents where maintenance_id=m.id and fingerprint=digest;end if;
 return to_jsonb(doc);
end $$;
revoke all on function public.get_service_order_document(bigint),public.issue_service_order_document(bigint,text) from public,anon;
grant execute on function public.get_service_order_document(bigint),public.issue_service_order_document(bigint,text) to authenticated;
commit;
