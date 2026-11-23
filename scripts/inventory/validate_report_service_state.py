"""Only the disposable report-state restoration; fixture writes roll back."""
import json
import psycopg2
c=psycopg2.connect(host="127.0.0.1",port=55443,user="postgres",dbname="biomedgest_report_state_restore")
q=c.cursor()
def role(uid):
    q.execute("reset role;set local role authenticated")
    q.execute("select set_config('request.jwt.claim.sub',%s,true)",(str(uid),))
def blocked(action,message):
    q.execute('savepoint forbidden')
    try:action()
    except psycopg2.Error as e:
        assert message in str(e),str(e)
        q.execute('rollback to savepoint forbidden')
    else:raise AssertionError('Expected rejection: '+message)
try:
    q.execute("select current_database(),host(inet_server_addr())");assert q.fetchone()==('biomedgest_report_state_restore','127.0.0.1')
    q.execute("select count(*),count(*) filter(where status='operativo') from public.equipment_assets where active");total,operational=q.fetchone();assert total==operational
    q.execute("select id,role from public.profiles where institutional_id in ('00123456','01123456','02123456')");users={r:u for u,r in q.fetchall()}
    q.execute("""select a.id,ep.maintenance_program_id from public.equipment_assets a join public.equipment_maintenance_programs ep on ep.equipment_id=a.id
      where a.active and not exists(select 1 from public.maintenances m where m.equipment_id=a.id and m.status in ('programado','en_proceso'))
      and not exists(select 1 from public.trainings t where t.equipment_id=a.id and t.status in ('programada','en_curso')) limit 1""")
    eq,program=q.fetchone()
    role(users['usuario'])
    q.execute('select public.get_equipment_incident_options(%s)',(eq,));option=q.fetchone()[0][0]
    q.execute("""insert into public.reports(equipment_id,equipment_identifier,event_date,event_type,service,description,incident_option_id,observations)
      values(%s,'IGNORED',current_date,'Falla','IGNORED',%s,%s,null) returning id,description,observations""",(eq,option['label'],option['id']))
    report_id,description,observations=q.fetchone();assert description==option['label'] and observations is None
    q.execute('reset role');q.execute('select status from public.equipment_assets where id=%s',(eq,));assert q.fetchone()[0]=='fuera_de_servicio'
    role(users['usuario'])
    changes=dict(event_date='2026-11-23',event_type='Falla',description=description,patient_outcome='',action_taken='',observations='Detalle opcional')
    q.execute('select (public.edit_report_incident(%s,%s::jsonb,null)).observations',(report_id,json.dumps(changes)));assert q.fetchone()[0]=='Detalle opcional'
    q.execute('reset role');q.execute('select status from public.equipment_assets where id=%s',(eq,));assert q.fetchone()[0]=='fuera_de_servicio'
    print('PASS operational baseline, selected incident without observations and atomic out-of-service state')
    role(users['jefe'])
    blocked(lambda:q.execute("select public.save_general_calendar_event(null,'uso_equipo','Local clinical use','2030-01-05T10:00Z','2030-01-05T11:00Z',null,%s::uuid[],null,null)",([str(eq)],)),'no está operativo')
    q.execute("select public.save_general_calendar_event(null,'mantenimiento','Local review','2030-01-05T08:00Z','2030-01-05T09:00Z',null,%s::uuid[],%s,null)",([str(eq)],program));assert q.fetchone()[0]
    q.execute('select public.equipment_admin_context(%s)',(eq,));asset=q.fetchone()[0]['asset'];asset['status']='operativo'
    q.execute("select public.save_equipment_asset(%s,%s::jsonb,'Revisión biomédica confirmada')",(eq,json.dumps(asset)))
    q.execute("select public.save_general_calendar_event(null,'uso_equipo','Local clinical use','2030-01-05T10:00Z','2030-01-05T11:00Z',null,%s::uuid[],null,null)",([str(eq)],));assert q.fetchone()[0]
    print('PASS clinical use blocked until authorized review; maintenance remains schedulable')
    q.execute('reset role;alter table public.reports disable trigger protect_report_identity')
    q.execute("update public.reports set created_at=clock_timestamp()-interval '10 minutes' where id=%s",(report_id,))
    q.execute('alter table public.reports enable trigger protect_report_identity')
    role(users['usuario'])
    q.execute('select edited_at from public.reports where id=%s',(report_id,));edited=q.fetchone()[0]
    blocked(lambda:q.execute('select public.edit_report_incident(%s,%s::jsonb,%s)',(report_id,json.dumps({**changes,'observations':'Corrección tardía'}),edited)),'10 minutos ha terminado')
    print('PASS optional observations preserve the ten-minute deadline')
finally:c.rollback();q.close();c.close()
