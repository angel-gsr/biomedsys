begin;

create table public.user_departments (name text primary key check (length(name) between 2 and 100));
insert into public.user_departments(name)
select distinct btrim(department) from public.profiles where nullif(btrim(department),'') is not null
on conflict do nothing;
insert into public.user_departments(name) select name from public.hospital_areas where active on conflict do nothing;
insert into public.user_departments(name) values
('Administración'),('Ingeniería Biomédica'),('Quirófano'),('CEYE'),('Urgencias'),('Hospitalización'),('Consulta externa'),('Enfermería'),('Imagenología'),('Laboratorio'),('Terapia intensiva'),('Pediatría'),('Ginecología y Obstetricia'),('Mantenimiento') on conflict do nothing;
alter table public.user_departments enable row level security;
grant select on public.user_departments to authenticated;
create policy user_departments_read on public.user_departments for select to authenticated using (public.has_active_profile());

alter table public.profiles add column first_name text, add column last_name text, add column age smallint check (age between 18 and 100), add column phone text check (phone ~ '^\+?[0-9]{10,15}$');
alter table public.user_access_requests add column first_name text, add column last_name text, add column age smallint check (age between 18 and 100), add column phone text check (phone ~ '^\+?[0-9]{10,15}$');

create sequence public.user_registration_number minvalue 181000 maxvalue 999999 start 181000;
-- Skip existing suffixes to avoid reusing an already assigned identifier.
select setval('public.user_registration_number', greatest(181000, coalesce((select max(right(institutional_id,6)::bigint)+1 from (select institutional_id from public.profiles union all select institutional_id from public.user_access_requests) p where right(institutional_id,6)::bigint >= 181000),181000)),false);

create function public.prepare_user_registration() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='INSERT' then
    if not public.is_manager() then raise exception 'Solo el jefe puede registrar usuarios'; end if;
    new.institutional_id := case new.role when 'jefe' then '00' when 'tecnico' then '01' when 'usuario' then '02' else null end || lpad(nextval('public.user_registration_number')::text,6,'0');
    new.requested_by := auth.uid(); new.status := 'pendiente';
  elsif (new.institutional_id,new.role,new.first_name,new.last_name,new.age,new.phone,new.department) is distinct from (old.institutional_id,old.role,old.first_name,old.last_name,old.age,old.phone,old.department) then
    raise exception 'Los datos de la solicitud no se pueden modificar';
  else return new;
  end if;
  new.first_name:=regexp_replace(btrim(new.first_name),'\s+',' ','g');
  new.last_name:=regexp_replace(btrim(new.last_name),'\s+',' ','g');
  if new.first_name is null or new.last_name is null or length(new.first_name) not between 2 and 80 or length(new.last_name) not between 2 and 100
    or new.first_name !~ '^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ ''’.-]*[A-Za-zÀ-ÖØ-öø-ÿ]$' or new.last_name !~ '^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ ''’.-]*[A-Za-zÀ-ÖØ-öø-ÿ]$' then raise exception 'Nombres y apellidos inválidos'; end if;
  if new.age is null or new.age not between 18 and 100 then raise exception 'Edad requerida: 18 a 100 años'; end if;
  if not exists(select 1 from public.user_departments where name=new.department) then raise exception 'Selecciona un departamento del catálogo'; end if;
  new.phone:=nullif(btrim(new.phone),'');
  new.full_name:=new.first_name||' '||new.last_name;
  return new;
end $$;
create trigger prepare_user_registration before insert or update on public.user_access_requests for each row execute function public.prepare_user_registration();
revoke all on function public.prepare_user_registration() from public,anon,authenticated;

create function public.validate_profile_registration() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if tg_op='INSERT' or new.department is distinct from old.department then
    if not exists(select 1 from public.user_departments where name=new.department) then raise exception 'Selecciona un departamento del catálogo'; end if;
  end if;
  if tg_op='INSERT' or new.full_name is distinct from old.full_name then
    if length(new.full_name) not between 3 and 181 or new.full_name !~ '^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ ''’.-]*[A-Za-zÀ-ÖØ-öø-ÿ]$' then raise exception 'Nombre inválido'; end if;
  end if;
  return new;
end $$;
create trigger validate_profile_registration before insert or update on public.profiles for each row execute function public.validate_profile_registration();
revoke all on function public.validate_profile_registration() from public,anon,authenticated;
commit;
