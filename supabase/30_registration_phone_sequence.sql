begin;
lock table public.user_access_requests,public.profiles,public.user_departments in share row exclusive mode;
delete from public.user_departments where lower(name) in ('bcknd','backend');
-- Existing login identifiers are preserved. New registrations start at 181000.
alter sequence public.user_registration_number restart with 181000;
create or replace function public.prepare_user_registration() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='INSERT' then
    if not public.is_manager() then raise exception 'Solo el jefe puede registrar usuarios'; end if;
    loop
    new.institutional_id := case new.role when 'jefe' then '00' when 'tecnico' then '01' when 'usuario' then '02' else null end || lpad(nextval('public.user_registration_number')::text,6,'0');
      exit when not exists(select 1 from public.profiles where institutional_id=new.institutional_id) and not exists(select 1 from public.user_access_requests where institutional_id=new.institutional_id);
    end loop;
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

create function public.validate_user_phone() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if tg_op='INSERT' or new.phone is distinct from old.phone then
    new.phone:=nullif(btrim(new.phone),'');
    if new.phone is not null and new.phone !~ '^[0-9]{10}$' then raise exception 'El teléfono debe contener exactamente 10 dígitos'; end if;
  end if;
  return new;
end $$;
create trigger validate_user_phone before insert or update on public.profiles for each row execute function public.validate_user_phone();
create trigger validate_user_phone before insert or update on public.user_access_requests for each row execute function public.validate_user_phone();
revoke all on function public.validate_user_phone() from public,anon,authenticated;
commit;
