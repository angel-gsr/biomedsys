begin;
set local lock_timeout='10s';
alter table public.equipment_document_links add column custom_title text;
create trigger audit_equipment_document_links after insert or update or delete on public.equipment_document_links for each row execute function public.write_inventory_audit_log();

create function public.save_equipment_document_link(target_equipment_id uuid,target_document_id bigint,document_title text,document_kind text,document_url text) returns bigint
language plpgsql security definer set search_path=public,pg_temp as $$
declare new_id bigint;clean_url text:=btrim(document_url);clean_title text:=btrim(document_title);
begin
 if not public.has_active_profile() or not public.is_manager() then raise exception 'Solo el jefe puede administrar enlaces del equipo';end if;
 perform 1 from public.equipment_assets where id=target_equipment_id and active for update;
 if not found then raise exception 'Equipo no disponible';end if;
 if target_document_id is not null and not exists(select 1 from public.equipment_document_links where equipment_id=target_equipment_id and document_id=target_document_id) then raise exception 'Documento no vinculado a este equipo';end if;
 if nullif(clean_title,'') is null or length(clean_title)>180 or coalesce(document_kind,'') not in ('manual_usuario','manual_servicio','otro') then raise exception 'Completa el título y tipo de documento';end if;
 if clean_url is null or length(clean_url)>2048 or clean_url !~ '^https?://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?([/?#][^[:space:]<>]*)?$' then raise exception 'Usa una URL http o https válida, sin credenciales ni espacios';end if;
 insert into public.equipment_documents(document_type,title,url,normalized_url) values(document_kind,clean_title,clean_url,clean_url)
 on conflict(document_type,normalized_url) do nothing returning id into new_id;
 if new_id is null then select id into new_id from public.equipment_documents where document_type=document_kind and normalized_url=clean_url;end if;
 insert into public.equipment_document_links(equipment_id,document_id,custom_title) values(target_equipment_id,new_id,clean_title)
 on conflict(equipment_id,document_id) do update set custom_title=excluded.custom_title;
 if target_document_id is not null and target_document_id<>new_id then delete from public.equipment_document_links where equipment_id=target_equipment_id and document_id=target_document_id;end if;
 return new_id;
end $$;

create function public.remove_equipment_document_link(target_equipment_id uuid,target_document_id bigint) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.has_active_profile() or not public.is_manager() then raise exception 'Solo el jefe puede quitar documentos del equipo';end if;
 delete from public.equipment_document_links where equipment_id=target_equipment_id and document_id=target_document_id;
 if not found then raise exception 'Documento no vinculado a este equipo';end if;
end $$;

create or replace function public.list_clinical_equipment_documents(target_equipment_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not public.has_active_profile() then raise exception 'Perfil habilitado requerido';end if;
 select coalesce(jsonb_agg(to_jsonb(d) order by d.title),'[]'::jsonb) into result from (
 select doc.id,doc.document_type,coalesce(l.custom_title,doc.title) as title,doc.url,doc.review_status,count(distinct a.id)::integer as "linkedEquipment",jsonb_agg(distinct a.id) as "equipmentIds"
 from public.equipment_documents doc join public.equipment_document_links l on l.document_id=doc.id join public.equipment_assets a on a.id=l.equipment_id
 where a.active and (target_equipment_id is null or a.id=target_equipment_id)
 group by doc.id,doc.document_type,coalesce(l.custom_title,doc.title),doc.url,doc.review_status
 ) d;
 return result;
end $$;

create function public.update_equipment_attachment_info(target_attachment_id uuid,file_title text,file_description text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.file_attachments;
begin
 if not public.has_active_profile() or not public.is_technician_or_manager() then raise exception 'Solo personal biomédico habilitado';end if;
 select * into f from public.file_attachments where id=target_attachment_id and deleted_at is null for update;
 if f.id is null or f.equipment_id is null or f.report_id is not null or f.maintenance_id is not null or f.training_id is not null or f.quote_id is not null
 or (not public.is_manager() and f.uploaded_by is distinct from auth.uid()) then raise exception 'Archivo del equipo no disponible para edición';end if;
 if nullif(btrim(file_title),'') is null or length(file_title)>180 or length(file_description)>2000 then raise exception 'Revisa el nombre y descripción del archivo';end if;
 update public.file_attachments set original_name=btrim(file_title),description=nullif(btrim(file_description),'') where id=f.id;
end $$;

create function public.get_equipment_incident_history(target_equipment_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not public.has_active_profile() then raise exception 'Perfil habilitado requerido';end if;
 if not exists(select 1 from public.equipment_assets where id=target_equipment_id and active) then raise exception 'Equipo no disponible';end if;
 select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at desc,h.id desc),'[]'::jsonb) into result from (
 select r.id,r.report_number,r.created_at,r.event_date,coalesce(r.incident_label,r.description) as incident,r.observations,r.status,r.priority,
 m.maintenance_number
 from public.reports r left join public.maintenances m on m.id=r.maintenance_id
 where r.equipment_id=target_equipment_id and (public.is_technician_or_manager() or r.reporter_id=auth.uid())
 ) h;
 return result;
end $$;
revoke all on function public.save_equipment_document_link(uuid,bigint,text,text,text),public.remove_equipment_document_link(uuid,bigint),public.update_equipment_attachment_info(uuid,text,text),public.get_equipment_incident_history(uuid) from public,anon;
grant execute on function public.save_equipment_document_link(uuid,bigint,text,text,text),public.remove_equipment_document_link(uuid,bigint),public.update_equipment_attachment_info(uuid,text,text),public.get_equipment_incident_history(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
