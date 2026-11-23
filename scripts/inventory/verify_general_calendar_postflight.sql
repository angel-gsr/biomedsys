begin transaction read only;
do $$
begin
  if to_regclass('public.calendar_bookings') is null
     or to_regprocedure('public.list_general_calendar(timestamptz,timestamptz)') is null
     or to_regprocedure('public.save_general_calendar_event(text,text,text,timestamptz,timestamptz,bigint,uuid[],bigint,uuid)') is null then
    raise exception 'General calendar schema is incomplete';
  end if;
  if has_function_privilege('anon','public.list_general_calendar(timestamptz,timestamptz)','EXECUTE')
     or has_function_privilege('authenticated','public.calendar_resource_events()','EXECUTE')
     or has_table_privilege('authenticated','public.calendar_bookings','INSERT') then
    raise exception 'Unexpected direct calendar access';
  end if;
  if (select count(*) from pg_trigger where tgname in ('guard_calendar_bookings','guard_maintenance_calendar','guard_training_calendar') and not tgisinternal and tgenabled<>'D')<>3 then
    raise exception 'Calendar collision triggers are incomplete';
  end if;
  if not exists(select 1 from pg_class where oid='public.calendar_bookings'::regclass and relrowsecurity) then raise exception 'Calendar RLS is missing'; end if;
end $$;
select 'GENERAL_CALENDAR_POSTFLIGHT_COMPLETE';
rollback;
