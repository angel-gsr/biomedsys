begin;
set local lock_timeout = '10s';

alter table public.hospital_alerts add column emitter_snapshot jsonb not null default '{}'::jsonb;
update public.hospital_alerts h set emitter_snapshot=jsonb_build_object(
  'full_name',p.full_name,'institutional_id',p.institutional_id,'role',p.role,'department',p.department)
from public.profiles p where p.id=h.emitted_by;

create or replace function public.stamp_hospital_alert_emitter()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare emitter public.profiles;
begin
  if TG_OP='INSERT' then
    if not public.has_active_profile() then raise exception 'Perfil activo requerido'; end if;
    select * into emitter from public.profiles where id=auth.uid() and active;
    new.emitted_by:=emitter.id;
    new.emitter_snapshot:=jsonb_build_object('full_name',emitter.full_name,'institutional_id',emitter.institutional_id,'role',emitter.role,'department',emitter.department);
  elsif row(new.emitted_by,new.emitter_snapshot) is distinct from row(old.emitted_by,old.emitter_snapshot) then
    raise exception 'La identidad del emisor está bloqueada';
  end if;
  return new;
end $$;
create trigger stamp_hospital_alert_emitter before insert or update on public.hospital_alerts
for each row execute function public.stamp_hospital_alert_emitter();

create or replace function public.include_hospital_alert_emitter()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare identity_data jsonb;
begin
  if new.entity_type='hospital_alert' then
    select h.emitter_snapshot into identity_data from public.hospital_alerts h where h.id::text=new.entity_id;
    if identity_data->>'full_name' is not null then
      new.message:=new.message||' · Emitida por: '||(identity_data->>'full_name')||' (ID '||(identity_data->>'institutional_id')||')';
    end if;
  end if;
  return new;
end $$;
create trigger include_hospital_alert_emitter before insert on public.notifications
for each row execute function public.include_hospital_alert_emitter();

create or replace function public.list_hospital_alerts(include_closed boolean default false)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if not public.has_active_profile() then raise exception 'Perfil activo requerido'; end if;
  return coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (
    select h.*,c.name as code_name,c.description as code_description,c.color,c.audience,c.audible,
      coalesce(h.emitter_snapshot->>'full_name',emitter.full_name) as emitter_name,
      coalesce(h.emitter_snapshot->>'institutional_id',emitter.institutional_id) as emitter_institutional_id,
      coalesce(h.emitter_snapshot->>'role',emitter.role::text) as emitter_role,
      h.emitter_snapshot->>'department' as emitter_department,
      responder.full_name as responder_name
    from public.hospital_alerts h join public.hospital_codes c on c.code=h.code
    join public.profiles emitter on emitter.id=h.emitted_by left join public.profiles responder on responder.id=h.taken_by
    where (include_closed or h.status<>'cerrada')
      and (h.emitted_by=auth.uid() or public.is_technician_or_manager() or c.audience='todos')
    order by h.created_at desc limit 100
  ) a),'[]'::jsonb);
end $$;
update public.hospital_codes set audible=true where not audible;
revoke all on function public.stamp_hospital_alert_emitter(), public.include_hospital_alert_emitter() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
