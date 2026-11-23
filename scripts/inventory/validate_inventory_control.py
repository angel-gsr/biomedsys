"""Reversible fixtures for the disposable inventory-control restoration only."""
import json
import psycopg2

c=psycopg2.connect(host="127.0.0.1",port=55442,user="postgres",dbname="biomedgest_inventory_control_restore")
q=c.cursor()
def role(uid):
    q.execute("reset role; set local role authenticated")
    q.execute("select set_config('request.jwt.claim.sub',%s,true)",(str(uid),))
def blocked(action,message):
    q.execute("savepoint denied")
    try:action()
    except psycopg2.Error as e:
        assert message in str(e),str(e)
        q.execute("rollback to savepoint denied")
    else:raise AssertionError("Expected rejection: "+message)
def save(uid,data):
    q.execute("select public.save_equipment_asset(%s,%s::jsonb,'Local verification')",(uid,json.dumps(data)))
    return q.fetchone()[0]
def report(eq,label,option=None):
    q.execute("""insert into public.reports(equipment_id,equipment_identifier,event_date,event_type,service,description,incident_option_id,incident_label)
        values(%s,'IGNORED',current_date,'Falla','IGNORED','PRIVATE_NARRATIVE_SENTINEL',%s,%s) returning id,equipment_snapshot""",(eq,option,label))
    return q.fetchone()
try:
    q.execute("select current_database(),host(inet_server_addr())");assert q.fetchone()==("biomedgest_inventory_control_restore","127.0.0.1")
    q.execute("select id,role from public.profiles where institutional_id in ('00123456','01123456','02123456')");users={r:u for u,r in q.fetchall()}
    q.execute("select id from public.hospital_areas where active order by id limit 1");area=q.fetchone()[0]
    role(users['jefe'])
    data=dict(equipment_type="Equipo QA",manufacturer="Marca QA",model="Modelo compartido QA",serial_number="SER-QA-1",manufacture_year=2020,acquisition_year=2021,hospital_area_id=area,location_id=None,status="operativo")
    first=save(None,data);second=save(None,{**data,'serial_number':'SER-QA-2'})
    q.execute('select count(distinct inventory_code) from public.equipment_assets where id in (%s,%s)',(first,second));assert q.fetchone()[0]==2
    role(users['usuario'])
    report_id,snapshot=report(first,'No enciende')
    q.execute('select public.get_equipment_incident_options(%s)',(first,));options=q.fetchone()[0]
    no_power=next(o for o in options if o['label']=='No enciende');assert no_power['report_count']==1
    assert 'PRIVATE_NARRATIVE_SENTINEL' not in json.dumps(options)
    q.execute('select public.get_equipment_incident_options(%s)',(second,));assert q.fetchone()[0]==[]
    blocked(lambda: report(second,'No enciende',no_power['id']),'no pertenece al equipo')
    changes=dict(event_date='2026-11-23',event_type='Falla',description='PRIVATE_NARRATIVE_SENTINEL',patient_outcome='',action_taken='',incident_option_id=None,incident_label='Batería no carga')
    q.execute('select public.edit_report_incident(%s,%s::jsonb,null)',(report_id,json.dumps(changes)))
    q.execute('select public.get_equipment_incident_options(%s)',(first,));assert any(o['label']=='Batería no carga' and o['report_count']==1 for o in q.fetchone()[0])
    print('PASS scoped incident options, report-derived labels, correction and narrative privacy')
    role(users['jefe'])
    save(first,{**data,'model':'Modelo actualizado QA','equipment_type':'Equipo actualizado QA'})
    q.execute('select model from public.equipment_inventory_detail where id=%s',(second,));assert q.fetchone()[0]=='Modelo compartido QA'
    q.execute('select equipment_snapshot from public.reports where id=%s',(report_id,));assert q.fetchone()[0]==snapshot
    q.execute("select public.archive_equipment_asset(%s,'Retiro de prueba')",(first,))
    q.execute('select count(*) from public.search_equipment_directory(null) where id=%s',(first,));assert q.fetchone()[0]==0
    q.execute('select count(*) from public.reports where id=%s',(report_id,));assert q.fetchone()[0]==1
    q.execute('select public.list_archived_equipment()');assert any(a['id']==str(first) for a in q.fetchone()[0])
    role(users['usuario']);blocked(lambda: report(first,'No enciende'),'retirado')
    role(users['jefe']);q.execute("select public.restore_equipment_asset(%s,'Reingreso de prueba')",(first,))
    q.execute('select active,status from public.equipment_assets where id=%s',(first,));assert q.fetchone()==(True,'desconocido')
    print('PASS complete create/edit, model isolation, retirement, preserved history and restore')
    q.execute("select public.save_general_calendar_event(null,'uso_equipo','Local reservation','2030-05-01T10:00Z','2030-05-01T12:00Z',null,%s::uuid[],null,null)",([str(first)],));reservation=q.fetchone()[0]
    blocked(lambda:q.execute("select public.archive_equipment_asset(%s,'Retiro pendiente')",(first,)),'reservas pendientes')
    q.execute('select public.cancel_general_calendar_event(%s)',(reservation,))
    q.execute("select public.archive_equipment_asset(%s,'Retiro confirmado')",(first,))
    print('PASS pending resource reservations prevent retirement')
    for kind in ['tecnico','usuario']:
        role(users[kind])
        blocked(lambda:save(None,data),'Solo el jefe')
        blocked(lambda:q.execute("select public.archive_equipment_asset(%s,'Prohibido')",(second,)),'Solo el jefe')
        blocked(lambda:q.execute("select public.restore_equipment_asset(%s,'Prohibido')",(first,)),'Solo el jefe')
    print('PASS chief-only writes enforced for all inventory operations')
    q.execute('reset role;alter table public.reports disable trigger protect_report_identity')
    q.execute("update public.reports set created_at=clock_timestamp()-interval '10 minutes' where id=%s",(report_id,))
    q.execute('alter table public.reports enable trigger protect_report_identity')
    role(users['usuario'])
    q.execute('select edited_at from public.reports where id=%s',(report_id,));edited=q.fetchone()[0]
    blocked(lambda:q.execute('select public.edit_report_incident(%s,%s::jsonb,%s)',(report_id,json.dumps({**changes,'incident_label':'Otro incidente tardío'}),edited)),'10 minutos ha terminado')
    print('PASS specific incident corrections retain the ten-minute server deadline')
finally:c.rollback();q.close();c.close()
