"""Validate only in the disposable local restore; all fixture changes roll back."""
from pathlib import Path
import json
import uuid
import psycopg2

c = psycopg2.connect(host="127.0.0.1", port=55443, user="postgres", dbname="biomedgest_report_state_restore")
q = c.cursor()

def role(uid):
    q.execute("reset role; set local role authenticated")
    q.execute("select set_config('request.jwt.claim.sub',%s,true)", (str(uid),))

def denied(action, text):
    q.execute("savepoint denied")
    try:
        action()
    except psycopg2.Error as error:
        assert text in str(error), str(error)
        q.execute("rollback to savepoint denied")
    else:
        raise AssertionError("Expected rejection: " + text)

try:
    q.execute("select current_database(),host(inet_server_addr())")
    assert q.fetchone() == ("biomedgest_report_state_restore", "127.0.0.1")
    for name in ["24_report_priority_defaults.sql", "25_hospital_alerts.sql"]:
        body = (Path("supabase") / name).read_text(encoding="utf-8").replace("begin;", "", 1).rsplit("commit;", 1)[0]
        q.execute(body)
    q.execute("select count(*) from hospital_codes")
    assert q.fetchone()[0] == 14
    q.execute("select id,role from profiles where active")
    users = {role_name: uid for uid, role_name in q.fetchall()}
    peer, inactive = uuid.uuid4(), uuid.uuid4()
    for uid, identifier, active in [(peer, "02123457", True), (inactive, "02123458", False)]:
        q.execute("insert into auth.users(id,email) values(%s,%s)", (str(uid), identifier + "@qa.invalid"))
        q.execute("insert into profiles(id,institutional_id,full_name,role,active) values(%s,%s,'Local QA','usuario',%s)", (str(uid), identifier, active))
    q.execute("select id from profiles where active")
    active_ids = {str(row[0]) for row in q.fetchall()}
    q.execute("select id from profiles where active and role in ('jefe','tecnico')")
    staff_ids = {str(row[0]) for row in q.fetchall()}
    role(users["usuario"])
    request = str(uuid.uuid4())
    args = ("magenta", "CEYE, sala de equipos", "Revisión técnica", request)
    q.execute("select emit_hospital_alert(%s,%s,%s,%s)", args)
    targeted = q.fetchone()[0]
    q.execute("select emit_hospital_alert(%s,%s,%s,%s)", args)
    assert q.fetchone()[0] == targeted
    denied(lambda: q.execute("select emit_hospital_alert('magenta','Otra sala','Cambio',%s)", (request,)), "otra alerta")
    denied(lambda: q.execute("select update_hospital_alert(%s,'cerrada','Cierre no autorizado')", (targeted,)), "Solo jefe")
    denied(lambda: q.execute("select emit_hospital_alert('inexistente','Sala 1','',%s)", (str(uuid.uuid4()),)), "no válido")
    denied(lambda: q.execute("update hospital_alerts set status='cerrada' where id=%s", (targeted,)), "permission denied")
    q.execute("reset role")
    q.execute("select recipient_id from notifications where entity_type='hospital_alert' and entity_id=%s", (str(targeted),))
    assert {str(row[0]) for row in q.fetchall()} == staff_ids | {str(users["usuario"])}
    role(peer)
    q.execute("select list_hospital_alerts(false)")
    assert not any(row["id"] == targeted for row in q.fetchone()[0])
    q.execute("select id from hospital_alerts where id=%s", (targeted,))
    assert q.fetchone() is None
    print("PASS targeted recipients, RLS isolation, privileged transitions and idempotent emission", flush=True)
    role(users["usuario"])
    q.execute("select emit_hospital_alert('negro','Acceso principal','Prueba local',%s)", (str(uuid.uuid4()),))
    general = q.fetchone()[0]
    q.execute("reset role")
    q.execute("select recipient_id from notifications where entity_type='hospital_alert' and entity_id=%s", (str(general),))
    assert {str(row[0]) for row in q.fetchall()} == active_ids
    for uid in active_ids:
        role(uid)
        q.execute("select list_hospital_alerts(false)")
        assert any(row["id"] == general and row["audible"] for row in q.fetchone()[0])
    role(inactive)
    denied(lambda: q.execute("select emit_hospital_alert('rojo','Sala 1','',%s)", (str(uuid.uuid4()),)), "Perfil activo")
    print("PASS general alert reaches all active profiles, excludes inactive profiles and carries audible flag", flush=True)
    role(users["tecnico"])
    q.execute("select update_hospital_alert(%s,'en_atencion',null)", (general,))
    denied(lambda: q.execute("select update_hospital_alert(%s,'en_atencion',null)", (general,)), "ya está en atención")
    denied(lambda: q.execute("select update_hospital_alert(%s,'cerrada','')", (general,)), "motivo del cierre")
    q.execute("select update_hospital_alert(%s,'cerrada','Cierre de prueba autorizado')", (general,))
    q.execute("select list_hospital_alerts(false)")
    assert not any(row["id"] == general for row in q.fetchone()[0])
    q.execute("select list_hospital_alerts(true)")
    assert any(row["id"] == general and row["status"] == "cerrada" for row in q.fetchone()[0])
    q.execute("reset role")
    q.execute("select count(*) from notifications where entity_type='hospital_alert' and entity_id=%s", (str(general),))
    assert q.fetchone()[0] == len(active_ids) * 3
    q.execute("select actor_id from audit_log where action='hospital_alert_cerrada' and entity_id=%s", (str(general),))
    assert str(q.fetchone()[0]) == str(users["tecnico"])
    q.execute("select has_function_privilege('anon','public.emit_hospital_alert(text,text,text,uuid)','execute')")
    assert q.fetchone()[0] is False
    print("PASS attribution, closure history, status notifications, audit and anonymous RPC denial", flush=True)
finally:
    c.rollback()
    q.close()
    c.close()
