begin transaction read only;
do $$
begin
  if (select count(*) from public.equipment_inventory_extensions)<>100 then raise exception 'Expected all 100 equipment extensions'; end if;
  if (select count(*) from public.inventory_enrichment_versions)<100
     or exists(select 1 from public.equipment_inventory_extensions e where not exists(select 1 from public.inventory_enrichment_versions v where v.equipment_id=e.equipment_id and v.source_sha256=e.source_sha256)) then raise exception 'Import history is incomplete'; end if;
  if has_function_privilege('authenticated','public.import_inventory_enrichment(text,text,jsonb)','EXECUTE')
     or has_function_privilege('anon','public.import_inventory_enrichment(text,text,jsonb)','EXECUTE')
     or has_table_privilege('authenticated','public.equipment_inventory_extensions','UPDATE') then raise exception 'Unexpected enrichment privileges'; end if;
  if exists(select 1 from pg_tables where schemaname='public' and tablename in ('inventory_enrichment_batches','equipment_inventory_extensions','inventory_enrichment_versions') and not rowsecurity) then raise exception 'Enrichment RLS disabled'; end if;
end $$;
select 'INVENTORY_ENRICHMENT_POSTFLIGHT_COMPLETE';
rollback;
