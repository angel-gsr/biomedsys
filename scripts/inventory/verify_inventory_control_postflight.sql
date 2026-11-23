begin transaction read only;
do $$
begin
  if to_regprocedure('public.save_equipment_asset(uuid,jsonb,text)') is null
     or to_regprocedure('public.archive_equipment_asset(uuid,text)') is null
     or to_regprocedure('public.restore_equipment_asset(uuid,text)') is null
     or to_regprocedure('public.get_equipment_incident_options(uuid)') is null then raise exception 'Inventory control functions are incomplete'; end if;
  if has_function_privilege('anon','public.save_equipment_asset(uuid,jsonb,text)','EXECUTE')
     or has_function_privilege('anon','public.get_equipment_incident_options(uuid)','EXECUTE')
     or has_table_privilege('authenticated','public.equipment_incident_options','INSERT')
     or has_table_privilege('authenticated','public.equipment_assets','DELETE') then raise exception 'Unexpected inventory control permissions'; end if;
  if not exists(select 1 from pg_class where oid='public.equipment_incident_options'::regclass and relrowsecurity) then raise exception 'Incident taxonomy RLS missing'; end if;
  if (select count(*) from pg_trigger where tgname in ('validate_report_incident_option','remember_report_incident_option') and not tgisinternal and tgenabled<>'D')<>2 then raise exception 'Report incident validation incomplete'; end if;
  if (select count(*) from pg_trigger where tgname='ensure_active_equipment_schedule' and not tgisinternal and tgenabled<>'D')<>2 then raise exception 'Retired equipment scheduling guards missing'; end if;
end $$;
select 'INVENTORY_CONTROL_POSTFLIGHT_COMPLETE';
rollback;
