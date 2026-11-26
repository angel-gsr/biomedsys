"""Import an explicitly reviewed maintenance-date dataset within the caller's transaction."""
import json,re,unicodedata,datetime
from pathlib import Path

def normalized(value):
    return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',str(value)).encode('ascii','ignore').decode().lower())

def apply_dates(connection,dataset):
    from psycopg2.extras import execute_values
    rows=dataset['rows'];assert rows and len({r['inventory_code'] for r in rows})==len(rows)
    q=connection.cursor();changed=0;preserved=[]
    q.execute('select pg_advisory_xact_lock(20261126,45)')
    q.execute('select id,inventory_code,serial_number,source_row from public.equipment_assets where inventory_code=any(%s) and active order by inventory_code for update',([r['inventory_code'] for r in rows],))
    assets={a[1]:a for a in q.fetchall()}
    ids=[r['equipment_id'] for r in rows]
    q.execute('select equipment_id,maintenance_program_id,last_completed_on,next_due_on from public.equipment_maintenance_programs where equipment_id=any(%s::uuid[]) order by equipment_id,maintenance_program_id for update',(ids,))
    programs={(str(a[0]),a[1]):a[2:] for a in q.fetchall()}
    q.execute('select equipment_id,maintenance_schedule_sha256 from public.equipment_inventory_extensions where equipment_id=any(%s::uuid[]) order by equipment_id for update',(ids,))
    sources={str(a[0]):a[1] for a in q.fetchall()};extensions=[];updates=[]
    for row in rows:
        asset=assets.get(row['inventory_code'])
        if not asset or str(asset[0])!=row['equipment_id'] or asset[3]!=row['source_row'] or normalized(asset[2])!=normalized(row['serial_number']):
            raise ValueError('Equipment identity changed: '+row['inventory_code'])
        last=datetime.date.fromisoformat(row['last_on']);due=datetime.date.fromisoformat(row['next_on'])
        if due<=last:raise ValueError('Invalid maintenance dates: '+row['inventory_code'])
        current=programs.get((row['equipment_id'],row['program_id']))
        if current is None:raise ValueError('Program not linked: '+row['inventory_code'])
        newer=bool(current[0] and current[0]>last)
        if newer:preserved.append({'inventory_code':row['inventory_code'],'last_on':str(current[0]),'next_on':str(current[1])})
        if row['equipment_id'] not in sources:raise ValueError('Equipment information not found: '+row['inventory_code'])
        if sources[row['equipment_id']]==dataset['source_sha256']:continue
        extensions.append((row['equipment_id'],row['periodicity'],row['interval_months'],row['interval_months'] is None,last,due,row['date_note'],dataset['source_sha256'],row['source_row']))
        if not newer:updates.append((row['equipment_id'],row['program_id'],row['interval_months'],'Calendario de mantenimiento del inventario',row['date_note'],last,due))
    if extensions:
        execute_values(q,"""update public.equipment_inventory_extensions x set maintenance_periodicity=v.periodicity,suggested_interval_months=v.months::smallint,periodicity_needs_review=v.review,
        reported_last_maintenance_on=v.last_on,reported_next_maintenance_on=v.next_on,maintenance_date_notes=v.notes,maintenance_schedule_sha256=v.sha,maintenance_schedule_row=v.row_number,updated_at=clock_timestamp()
        from (values %s) v(equipment_id,periodicity,months,review,last_on,next_on,notes,sha,row_number) where x.equipment_id=v.equipment_id::uuid""",extensions,page_size=len(extensions));changed+=q.rowcount
    if updates:
        execute_values(q,"""update public.equipment_maintenance_programs p set interval_months=v.months::smallint,periodicity_basis=v.basis,periodicity_notes=v.notes,last_completed_on=v.last_on,next_due_on=v.next_on
        from (values %s) v(equipment_id,program_id,months,basis,notes,last_on,next_on) where p.equipment_id=v.equipment_id::uuid and p.maintenance_program_id=v.program_id""",updates,page_size=len(updates));changed+=q.rowcount
    if changed:
        q.execute("insert into public.audit_log(actor_id,action,entity_type,metadata) values(null,'import_maintenance_dates','equipment_maintenance_programs',%s::jsonb)",(json.dumps({'source_sha256':dataset['source_sha256'],'rows':len(rows),'preserved_newer':preserved}),))
    return {'rows':len(rows),'changed_records':changed,'preserved_newer':preserved}

if __name__=='__main__':
    import argparse,psycopg2
    from urllib.parse import urlsplit,unquote
    parser=argparse.ArgumentParser();parser.add_argument('dataset',type=Path);parser.add_argument('--apply',action='store_true');args=parser.parse_args()
    values={}
    for line in Path('.env.database.local').read_text(encoding='utf-8-sig').splitlines():
        if '=' in line and not line.startswith('#'):
            key,value=line.split('=',1);values[key.strip()]=value.strip().strip('"').strip("'")
    parsed=urlsplit(values['BIOMEDGEST_DATABASE_URL']);assert 'yvqccoavcwfzcxrfvsjs' in parsed.hostname+' '+unquote(parsed.username)
    with psycopg2.connect(host=parsed.hostname,port=parsed.port or 5432,user=unquote(parsed.username),password=unquote(parsed.password),dbname=parsed.path.lstrip('/'),sslmode='require',connect_timeout=15) as conn:
        print(json.dumps(apply_dates(conn,json.loads(args.dataset.read_text(encoding='utf8')))),flush=True)
        if not args.apply:conn.rollback();print('Dry run rolled back. Use --apply after backup and review.')
