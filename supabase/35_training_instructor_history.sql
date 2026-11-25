begin;
create or replace function public.list_training_instructors() returns table(id uuid,full_name text,role public.app_role,active boolean)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.has_active_profile() then raise exception 'Perfil activo requerido'; end if;
 return query select p.id,p.full_name,p.role,(p.active and p.deleted_at is null) from public.profiles p
 where p.role in ('jefe','tecnico') or exists(select 1 from public.trainings t where t.instructor_id=p.id) order by p.role,p.full_name;
end $$;
create or replace function public.validate_training_instructor() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_technician_or_manager() then raise exception 'Perfil autorizado requerido'; end if;
 if public.is_active_technician() then
  if tg_op='UPDATE' and old.instructor_id<>auth.uid() then raise exception 'Solo puedes gestionar tu capacitación'; end if;
  new.instructor_id:=auth.uid();
 end if;
 if tg_op='INSERT' or new.instructor_id is distinct from old.instructor_id then
  if not exists(select 1 from public.profiles where id=new.instructor_id and active and deleted_at is null and role in ('jefe','tecnico')) then raise exception 'Selecciona un jefe o biomédico habilitado'; end if;
 end if;
 return new;
end $$;
commit;
