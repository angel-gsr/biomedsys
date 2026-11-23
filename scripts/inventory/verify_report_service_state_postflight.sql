begin transaction read only;
do $$
begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='observations') then raise exception 'Report observations missing'; end if;
  if (select count(*) from pg_trigger where tgname in ('zz_complete_selective_report','stop_equipment_after_report','ensure_clinical_equipment_operational') and not tgisinternal and tgenabled<>'D')<>3 then raise exception 'Report service-state triggers incomplete'; end if;
  if has_function_privilege('anon','public.stop_equipment_after_report()','EXECUTE')
     or has_function_privilege('authenticated','public.complete_selective_report()','EXECUTE') then raise exception 'Unexpected report trigger privileges'; end if;
end $$;
select 'REPORT_SERVICE_STATE_POSTFLIGHT_COMPLETE';
rollback;
