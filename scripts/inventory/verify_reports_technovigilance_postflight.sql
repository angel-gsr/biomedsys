begin transaction read only;
do $$
begin
  if to_regprocedure('public.get_report_equipment_identity(uuid)') is null
     or to_regprocedure('public.get_report_preview(bigint)') is null
     or to_regprocedure('public.edit_report_incident(bigint,jsonb,timestamptz)') is null
     or to_regprocedure('public.save_technovigilance_review(bigint,jsonb)') is null
     or to_regprocedure('public.move_technovigilance_equipment(uuid,bigint,bigint,text)') is null then
    raise exception 'Migration 19 functions are incomplete';
  end if;
  if has_function_privilege('anon','public.get_report_preview(bigint)','EXECUTE')
     or has_function_privilege('anon','public.edit_report_incident(bigint,jsonb,timestamptz)','EXECUTE')
     or has_function_privilege('anon','public.move_technovigilance_equipment(uuid,bigint,bigint,text)','EXECUTE') then
    raise exception 'Anonymous access to report functions';
  end if;
  if has_table_privilege('authenticated','public.reports','UPDATE')
     or has_table_privilege('authenticated','public.technovigilance_reviews','UPDATE') then
    raise exception 'Direct report/review updates are unexpectedly granted';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid='public.reports'::regclass and tgname='protect_report_identity' and tgenabled <> 'D') then
    raise exception 'Equipment identity/freeze trigger is missing';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='reports'
    and policyname='active users read authorized reports' and qual like '%is_technician_or_manager%') then
    raise exception 'Technician inbox RLS is incomplete';
  end if;
  if exists (select 1 from pg_tables where schemaname='public'
    and tablename in ('technovigilance_reviews','technovigilance_holidays') and not rowsecurity) then
    raise exception 'Tecnovigilance RLS is disabled';
  end if;
end $$;
select 'REPORTS_TECHNOVIGILANCE_POSTFLIGHT_COMPLETE';
rollback;
