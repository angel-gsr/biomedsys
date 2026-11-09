"""Run against the disposable restored database only; all fixtures roll back."""
import json
import psycopg2

connection = psycopg2.connect(host="127.0.0.1", port=55439, user="postgres", dbname="biomedgest_restore")
q = connection.cursor()


def role(profile_id):
    q.execute("reset role")
    q.execute("set local role authenticated")
    q.execute("select set_config('request.jwt.claim.sub',%s,true)", (str(profile_id),))


def blocked(statement, params, message):
    q.execute("savepoint denied_action")
    try:
        q.execute(statement, params)
    except psycopg2.Error as error:
        assert message in str(error), str(error)
        q.execute("rollback to savepoint denied_action")
    else:
        raise AssertionError("An unauthorized change was accepted: " + message)


try:
    q.execute("select current_database(),host(inet_server_addr())")
    assert q.fetchone() == ("biomedgest_restore", "127.0.0.1")
    q.execute("select id,role from public.profiles where institutional_id in ('00123456','01123456','02123456')")
    profiles = {kind: uid for uid, kind in q.fetchall()}
    assert len(profiles) == 3
    q.execute("select id from public.equipment_assets order by inventory_code limit 1")
    equipment_id = q.fetchone()[0]
    role(profiles["usuario"])
    q.execute("select public.get_report_equipment_identity(%s)", (equipment_id,))
    identity = q.fetchone()[0]
    assert "serial_number" in identity
    q.execute("""insert into public.reports(equipment_id,equipment_identifier,event_date,event_type,service,
                 location,manufacturer,model_serial,description,created_at,priority,status)
                 values (%s,'FAKE',current_date,'Falla','FAKE','FAKE','FAKE','FAKE',
                 'Local rollback verification',now()+interval '1 day','Crítica','Cerrado')
                 returning id,equipment_identifier,service,equipment_snapshot,priority,status,created_at""", (equipment_id,))
    report_id, code, area, snapshot, priority, status, created = q.fetchone()
    assert code == identity["inventory_code"] and area == identity["hospital_area"]
    assert snapshot == identity and priority == "Ordinaria" and status == "Recibido"
    q.execute("select public.get_report_preview(%s)", (report_id,))
    assert q.fetchone()[0]["can_edit"]
    changes = {"event_date": "2026-11-08", "event_type": "Incidente", "description": "Corrected incident", "patient_outcome": "Sin lesión", "action_taken": "Equipo aislado"}
    q.execute("select (public.edit_report_incident(%s,%s::jsonb,null)).description", (report_id, json.dumps(changes)))
    assert q.fetchone()[0] == changes["description"]
    blocked("select public.edit_report_incident(%s,%s::jsonb,null)", (report_id, json.dumps(changes)), "El reporte cambió")
    q.execute("select edited_at from public.reports where id=%s", (report_id,))
    edited = q.fetchone()[0]
    blocked("select public.edit_report_incident(%s,%s::jsonb,%s)", (report_id, json.dumps({**changes, "location": "FAKE"}), edited), "Solo pueden corregirse")
    blocked("update public.reports set location='FAKE' where id=%s", (report_id,), "permission denied")
    print("PASS canonical identity, author correction, optimistic concurrency and direct-write denial")

    role(profiles["tecnico"])
    q.execute("select count(*) from public.reports where id=%s", (report_id,))
    assert q.fetchone()[0] == 1
    q.execute("select public.get_report_preview(%s)", (report_id,))
    assert not q.fetchone()[0]["can_edit"]
    blocked("select public.edit_report_incident(%s,%s::jsonb,%s)", (report_id, json.dumps(changes), edited), "Solo el autor")
    review = {"internal_risk": "medio", "failure_type": "Falla eléctrica", "regulatory_case": "muerte_deterioro_grave", "confirmed_on": "2026-11-01"}
    q.execute("select to_jsonb(public.save_technovigilance_review(%s,%s::jsonb))", (report_id, json.dumps(review)))
    result = q.fetchone()[0]
    assert result["regulatory_due_on"] == "2026-11-11"
    q.execute("select (%s::timestamptz at time zone 'America/Mexico_City')::date + 15", (created,))
    assert result["internal_due_on"] == str(q.fetchone()[0])
    q.execute("select to_jsonb(public.save_technovigilance_review(%s,%s::jsonb))", (report_id, json.dumps({**review, "regulatory_case": "amenaza_publica", "confirmed_on": "2026-11-06"})))
    assert q.fetchone()[0]["regulatory_due_on"] == "2026-11-10"
    role(profiles["jefe"])
    q.execute("insert into public.technovigilance_holidays(holiday,description) values ('2026-11-09','Local calendar verification') on conflict (holiday) do update set description=excluded.description")
    q.execute("select regulatory_due_on from public.technovigilance_reviews where report_id=%s", (report_id,))
    assert str(q.fetchone()[0]) == "2026-11-11"
    role(profiles["tecnico"])
    q.execute("select id from public.hospital_areas where active order by id limit 1")
    area_id = q.fetchone()[0]
    q.execute("select public.move_technovigilance_equipment(%s,%s,null,'Local rollback test')", (equipment_id, area_id))
    q.execute("select equipment_snapshot from public.reports where id=%s", (report_id,))
    assert q.fetchone()[0] == snapshot
    print("PASS technician inbox, distinct internal/regulatory deadlines and immutable snapshot after relocation")

    role(profiles["usuario"])
    q.execute("select count(*) from public.reports where reporter_id <> auth.uid()")
    assert q.fetchone()[0] == 0
    q.execute("select count(*) from public.technovigilance_reviews where report_id=%s", (report_id,))
    assert q.fetchone()[0] == 0
    blocked("select public.save_technovigilance_review(%s,%s::jsonb)", (report_id, json.dumps(review)), "Solo personal biomédico")
    blocked("select public.move_technovigilance_equipment(%s,%s,null,'forbidden')", (equipment_id, area_id), "Solo personal biomédico")

    # Backdate a fixture as local superuser, never on the official database.
    q.execute("reset role")
    q.execute("alter table public.reports disable trigger protect_report_identity")
    q.execute("update public.reports set created_at=clock_timestamp()-interval '10 minutes' where id=%s", (report_id,))
    q.execute("alter table public.reports enable trigger protect_report_identity")
    role(profiles["usuario"])
    blocked("select public.edit_report_incident(%s,%s::jsonb,%s)", (report_id, json.dumps(changes), edited), "10 minutos ha terminado")
    q.execute("select public.get_report_preview(%s)", (report_id,))
    assert not q.fetchone()[0]["can_edit"]
    role(profiles["jefe"])
    q.execute("select (public.create_corrective_order_from_report(%s,%s,'alta',now())).id", (report_id, profiles["tecnico"]))
    assert q.fetchone()[0]
    print("PASS expiration at 10 minutes; manager workflow remains available after the original incident freezes")
finally:
    connection.rollback()
    q.close()
    connection.close()
