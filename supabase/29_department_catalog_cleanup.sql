begin;
lock table public.user_departments, public.profiles, public.user_access_requests in share row exclusive mode;
create temporary table department_labels(old_name text primary key,new_name text not null) on commit drop;
insert into department_labels values
('Almacen de equipo medico','Almacén de Equipo Médico'),
('Consulta externa','Consulta Externa'),('Endoscopia','Endoscopía'),
('Epidemiologia','Epidemiología'),('Hospitalizacion','Hospitalización'),
('Imagenologia','Imagenología'),('mantenimiento','Mantenimiento'),
('Patologia','Patología'),('Quirofano','Quirófano'),
('Terapia intensiva','Terapia Intensiva'),('Tococirugia','Tococirugía');
insert into public.user_departments(name) select distinct new_name from department_labels on conflict do nothing;
update public.profiles p set department=m.new_name from department_labels m where p.department=m.old_name;
-- Historical requests retain their identity; only the department spelling changes.
alter table public.user_access_requests disable trigger prepare_user_registration;
update public.user_access_requests p set department=m.new_name from department_labels m where p.department=m.old_name;
alter table public.user_access_requests enable trigger prepare_user_registration;
delete from public.user_departments d using department_labels m where d.name=m.old_name;
create unique index user_departments_normalized_name on public.user_departments
 ((translate(lower(btrim(name)), 'áéíóúüñ', 'aeiouun')));
commit;
