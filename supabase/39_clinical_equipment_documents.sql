-- Explicit clinical read access to identification and linked external manuals.
begin;
set local lock_timeout='10s';
create function public.search_clinical_equipment(search_term text default null)
returns table(id uuid,inventory_code text,equipment_type text,manufacturer text,model text,hospital_area text,location text,status public.equipment_status,serial_number text)
language sql stable security definer set search_path=public,pg_temp as $$
 select ea.id,ea.inventory_code,et.name,mf.name,em.name,ha.name,el.name,ea.status,case when ea.serial_is_placeholder then null else ea.serial_number end
 from public.equipment_assets ea join public.equipment_models em on em.id=ea.equipment_model_id join public.equipment_types et on et.id=em.equipment_type_id join public.manufacturers mf on mf.id=em.manufacturer_id join public.hospital_areas ha on ha.id=ea.hospital_area_id left join public.equipment_locations el on el.id=ea.location_id
 where ea.active and public.has_active_profile() and (nullif(btrim(search_term),'') is null or ea.inventory_code ilike '%'||btrim(search_term)||'%' or et.name ilike '%'||btrim(search_term)||'%' or mf.name ilike '%'||btrim(search_term)||'%' or em.name ilike '%'||btrim(search_term)||'%' or ha.name ilike '%'||btrim(search_term)||'%' or (not ea.serial_is_placeholder and ea.serial_number ilike '%'||btrim(search_term)||'%')) order by ea.inventory_code
$$;
create function public.list_clinical_equipment_documents(target_equipment_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not public.has_active_profile() then raise exception 'Perfil habilitado requerido'; end if;
 select coalesce(jsonb_agg(to_jsonb(d) order by d.title),'[]'::jsonb) into result from (
  select doc.id,doc.document_type,doc.title,doc.url,doc.review_status,count(distinct a.id)::integer as "linkedEquipment",jsonb_agg(distinct a.id) as "equipmentIds"
  from public.equipment_documents doc join public.equipment_document_links l on l.document_id=doc.id join public.equipment_assets a on a.id=l.equipment_id
  where a.active and (target_equipment_id is null or a.id=target_equipment_id)
  group by doc.id,doc.document_type,doc.title,doc.url,doc.review_status
 ) d;
 return result;
end $$;
revoke all on function public.search_clinical_equipment(text),public.list_clinical_equipment_documents(uuid) from public,anon;
grant execute on function public.search_clinical_equipment(text),public.list_clinical_equipment_documents(uuid) to authenticated;
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


commit;
