"""Calendar integration scenarios. Only the disposable local restoration is allowed."""
import psycopg2

c = psycopg2.connect(host="127.0.0.1", port=55440, user="postgres", dbname="biomedgest_calendar_restore")
q = c.cursor()
def role(uid):
    q.execute("reset role; set local role authenticated")
    q.execute("select set_config('request.jwt.claim.sub',%s,true)", (str(uid),))
def save(kind, start, end, room, equipment, key=None, program=None):
    q.execute("select public.save_general_calendar_event(%s,%s,%s,%s,%s,%s,%s::uuid[],%s,null)", (key,kind,"Local calendar verification",start,end,room,equipment,program))
    return q.fetchone()[0]
def blocked(action, message):
    q.execute("savepoint forbidden")
    try: action()
    except psycopg2.Error as error:
        assert message in str(error), str(error)
        q.execute("rollback to savepoint forbidden")
    else: raise AssertionError("Expected rejection: " + message)
try:
    q.execute("select current_database(),host(inet_server_addr())")
    assert q.fetchone() == ("biomedgest_calendar_restore","127.0.0.1")
    q.execute("select id,role from public.profiles where institutional_id in ('00123456','01123456','02123456')")
    users = {role: uid for uid,role in q.fetchall()}
    q.execute("""select ep.equipment_id::text,ep.maintenance_program_id from public.equipment_maintenance_programs ep
        where not exists(select 1 from public.maintenances m where m.equipment_id=ep.equipment_id and m.status in ('programado','en_proceso'))
        and not exists(select 1 from public.trainings t where t.equipment_id=ep.equipment_id and t.status in ('programada','en_curso')) limit 1""")
    eq,program = q.fetchone()
    q.execute("select id from public.equipment_locations where active order by id limit 2")
    room1,room2 = [row[0] for row in q.fetchall()]
    role(users["jefe"])
    surgery = save("cirugia","2030-01-05T10:00:00Z","2030-01-05T12:00:00Z",room1,[eq])
    blocked(lambda: save("cirugia","2030-01-05T11:00:00Z","2030-01-05T13:00:00Z",room1,[]),"Conflicto de horario")
    blocked(lambda: save("uso_equipo","2030-01-05T11:00:00Z","2030-01-05T13:00:00Z",room2,[eq]),"Conflicto de horario")
    blocked(lambda: save("mantenimiento","2030-01-05T11:00:00Z","2030-01-05T13:00:00Z",room2,[eq],program=program),"Conflicto de horario")
    blocked(lambda: save("capacitacion","2030-01-05T11:00:00Z","2030-01-05T13:00:00Z",room1,[]),"Conflicto de horario")
    blocked(lambda: q.execute("select public.schedule_preventive_maintenance(%s,%s,'2030-01-05T11:00:00Z',null,'ordinaria')",(eq,program)),"Conflicto de horario")
    adjacent = save("cirugia","2030-01-05T12:00:00Z","2030-01-05T13:00:00Z",room1,[eq])
    print("PASS room/equipment overlap, existing maintenance API and adjacent intervals")
    q.execute("select public.cancel_general_calendar_event(%s)",(surgery,))
    maintenance = save("mantenimiento","2030-01-05T10:00:00Z","2030-01-05T12:00:00Z",room2,[eq],program=program)
    training = save("capacitacion","2030-01-05T14:00:00Z","2030-01-05T15:00:00Z",room1,[eq])
    blocked(lambda: save("cirugia","2030-01-05T10:30:00Z","2030-01-05T11:30:00Z",room2,[eq],key=adjacent),"Conflicto de horario")
    q.execute("select count(*) from public.maintenances where 'mantenimiento:'||id=%s",(maintenance,));assert q.fetchone()[0]==1
    q.execute("select count(*) from public.trainings where 'capacitacion:'||id=%s",(training,));assert q.fetchone()[0]==1
    q.execute("select public.list_general_calendar('2030-01-01','2030-02-01')")
    events = q.fetchone()[0]
    assert {"cirugia","mantenimiento","capacitacion"}.issubset({e["kind"] for e in events})
    assert surgery not in {e["event_key"] for e in events}
    print("PASS one calendar over real source records, cancellation and rescheduling conflicts")
    q.execute("select public.cancel_general_calendar_event(%s)",(maintenance,))
    q.execute("select (public.schedule_preventive_maintenance(%s,%s,'2032-01-01T10:00:00Z',null,'ordinaria')).id",(eq,program));incomplete=q.fetchone()[0]
    blocked(lambda: save("uso_equipo","2032-01-03T10:00:00Z","2032-01-03T12:00:00Z",None,[eq]),"Conflicto de horario")
    save("mantenimiento","2032-01-01T10:00:00Z","2032-01-01T12:00:00Z",None,[eq],key="mantenimiento:"+str(incomplete))
    save("uso_equipo","2032-01-03T10:00:00Z","2032-01-03T12:00:00Z",None,[eq])
    print("PASS unknown duration remains reserved until the chief records an end")
    role(users["tecnico"])
    q.execute("select public.list_general_calendar('2030-01-01','2030-02-01')");assert q.fetchone()[0]
    blocked(lambda: save("cirugia","2030-02-01T10:00:00Z","2030-02-01T12:00:00Z",room1,[]),"Solo el jefe")
    blocked(lambda: q.execute("select public.cancel_general_calendar_event(%s)",(adjacent,)),"Solo el jefe")
    role(users["usuario"])
    blocked(lambda: q.execute("select public.list_general_calendar('2030-01-01','2030-02-01')"),"Solo personal biomédico")
    q.execute("select count(*) from public.calendar_bookings");assert q.fetchone()[0]==0
    print("PASS staff calendar visibility, chief-only mutation and user isolation")
finally:
    c.rollback();q.close();c.close()
