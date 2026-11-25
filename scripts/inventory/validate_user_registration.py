"""Registration security checks against the disposable local PostgreSQL restore."""
from pathlib import Path
import psycopg2

def validate(c):
    q = c.cursor()
    q.execute("select current_database(),host(inet_server_addr())")
    assert q.fetchone() == ('biomedgest_report_state_restore', '127.0.0.1')
    q.execute(Path('supabase/28_user_registration.sql').read_text(encoding='utf-8').replace('begin;', '', 1).rsplit('commit;', 1)[0])
    q.execute("select id,role from profiles where active")
    users = {role: str(uid) for uid, role in q.fetchall()}
    def role(name):
        q.execute("reset role;set local role authenticated")
        q.execute("select set_config('request.jwt.claim.sub',%s,true)", (users[name],))
    def insert(**changes):
        data = dict(first_name='Ángel José', last_name="García O'Neil", age=28, phone='+525512345678', department='Urgencias', role='usuario')
        data.update(changes)
        q.execute('insert into user_access_requests(first_name,last_name,age,phone,department,role,institutional_id,full_name) values(%s,%s,%s,%s,%s,%s,\'00999999\',\'Ignored\') returning institutional_id,full_name', tuple(data.values()))
        return q.fetchone()
    def reject(fn):
        q.execute('savepoint invalid')
        try: fn()
        except psycopg2.Error: q.execute('rollback to savepoint invalid')
        else: raise AssertionError('Invalid registration accepted')
    role('jefe')
    ids = []
    for name,prefix in [('jefe','00'),('tecnico','01'),('usuario','02')]:
        identifier,full_name = insert(role=name)
        assert identifier.startswith(prefix) and int(identifier[2:]) >= 181000
        assert full_name == "Ángel José García O'Neil"
        ids.append(identifier[2:])
    assert len(set(ids)) == 3
    for bad in [dict(first_name='<script>'),dict(last_name="';DROP TABLE profiles;--"),dict(age=17),dict(age=101),dict(age=None),dict(phone='abc123'),dict(department='Inventado'),dict(first_name='1'),dict(first_name=None)]:
        reject(lambda: insert(**bad))
    role('usuario');reject(insert)
    role('tecnico');reject(insert)
    q.execute('reset role')
    q.execute("select has_function_privilege('anon','public.prepare_user_registration()','execute')")
    assert q.fetchone()[0] is False
    print('Registration: all roles, automatic IDs, accents, invalid data, SQL payloads and permissions verified; changes rolled back')

if __name__ == '__main__':
    c = psycopg2.connect(host='127.0.0.1',port=55443,user='postgres',dbname='biomedgest_report_state_restore')
    try: validate(c)
    finally: c.rollback();c.close()
