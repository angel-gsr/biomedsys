"""Checks enrichment imports only in the disposable restored database."""
import json
from pathlib import Path
import psycopg2

c=psycopg2.connect(host="127.0.0.1",port=55441,user="postgres",dbname="biomedgest_enrichment_restore")
q=c.cursor()
root=Path(__file__).resolve().parents[2]/"data/inventory/enrichment"
manifest=json.loads((root/"manifest.json").read_text(encoding="utf-8"))
rows=json.loads((root/"enrichment.json").read_text(encoding="utf-8"))
try:
    q.execute("select current_database(),host(inet_server_addr())")
    assert q.fetchone()==("biomedgest_enrichment_restore","127.0.0.1")
    q.execute("select count(*),count(suggested_interval_months),count(*) filter(where periodicity_needs_review),count(decommission_notes),count(warranty_notes),count(regulatory_notes) from public.equipment_inventory_extensions")
    assert q.fetchone()==(100,56,44,11,46,46)
    fields=["maintenance_periodicity","suggested_interval_months","periodicity_needs_review","possible_problems","decommission_notes","warranty_notes","regulatory_notes","source_row"]
    q.execute("select a.inventory_code,to_jsonb(e) from public.equipment_inventory_extensions e join public.equipment_assets a on a.id=e.equipment_id")
    actual=dict(q.fetchall())
    for row in rows:
        assert all(actual[row["inventory_code"]][field]==row[field] for field in fields),row["inventory_code"]
    q.execute("select public.import_inventory_enrichment(%s,%s,%s::jsonb)",(manifest["source_file"],manifest["source_sha256"],json.dumps(rows)))
    assert q.fetchone()[0]["already_imported"]
    q.execute("select count(*) from public.inventory_enrichment_versions");assert q.fetchone()[0]==100
    print("PASS all 100 rows preserve exact source text, blanks and interval classifications; repeat import is idempotent")
    q.execute("savepoint bad_source")
    tampered=json.loads(json.dumps(rows));tampered[-1]["expected_identity"]["model"]="Incorrect identity"
    try:q.execute("select public.import_inventory_enrichment('invalid.xlsx',%s,%s::jsonb)",("f"*64,json.dumps(tampered)))
    except psycopg2.Error as e:
        assert "identidad no coincide" in str(e)
        q.execute("rollback to savepoint bad_source")
    else:raise AssertionError("Identity mismatch accepted")
    q.execute("select count(*) from public.inventory_enrichment_batches");assert q.fetchone()[0]==1
    print("PASS an identity mismatch rejects the whole new batch")
    q.execute("select id,role from public.profiles where institutional_id in ('00123456','01123456','02123456')")
    profiles=q.fetchall()
    for uid,role in profiles:
        q.execute("set local role authenticated")
        q.execute("select set_config('request.jwt.claim.sub',%s,true)",(str(uid),))
        q.execute("select count(*) from public.equipment_inventory_extensions")
        assert q.fetchone()[0]==(0 if role=="usuario" else 100)
        q.execute("select has_function_privilege('authenticated','public.import_inventory_enrichment(text,text,jsonb)','EXECUTE')")
        assert not q.fetchone()[0]
        q.execute("savepoint forbidden_write")
        try:q.execute("update public.equipment_inventory_extensions set decommission_notes='Tampered'")
        except psycopg2.Error:q.execute("rollback to savepoint forbidden_write")
        else:raise AssertionError("Direct writes accepted")
        q.execute("reset role")
    print("PASS chief/technician access, user isolation and server-only import")
finally:c.rollback();q.close();c.close()
