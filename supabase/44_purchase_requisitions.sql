begin;
set local lock_timeout='10s';
alter table public.quotes add column has_purchase_requisition boolean not null default false;
create table public.purchase_requisitions (
 id bigint generated always as identity primary key,
 quote_id bigint not null unique references public.quotes(id),
 requisition_number text generated always as ('REQ-'||lpad(quote_id::text,6,'0')) stored unique,
 data jsonb not null,
 subtotal numeric(12,2) not null check(subtotal>=0),
 tax_percent numeric(5,2) not null check(tax_percent between 0 and 100),
 tax_amount numeric(12,2) not null check(tax_amount>=0),
 total numeric(12,2) not null check(total>=0),
 created_by uuid not null references public.profiles(id),
 updated_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.purchase_requisitions enable row level security;
revoke all on public.purchase_requisitions from anon,authenticated;
create trigger audit_purchase_requisitions after insert or update on public.purchase_requisitions for each row execute function public.write_inventory_audit_log();

create function public.save_purchase_requisition(target_quote_id bigint,data jsonb,expected_updated_at timestamptz default null,new_status text default 'pendiente') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.quotes;existing public.purchase_requisitions;r public.purchase_requisitions;
 item jsonb;normalized_items jsonb:='[]'::jsonb;payload jsonb;requester jsonb;
 qty numeric;cost numeric;discount numeric;gross numeric;discount_amount numeric;net numeric;
 subtotal_value numeric:=0;tax_rate numeric;tax_value numeric;total_value numeric;field text;new_request boolean;previous_status text;
begin
 if not public.has_active_profile() or not public.is_manager() then raise exception 'Solo el jefe puede administrar requisiciones';end if;
 if data is null or jsonb_typeof(data)<>'object' then raise exception 'Formulario inválido';end if;
 if target_quote_id is not null then
  select * into q from public.quotes where id=target_quote_id for update;
  if q.id is null then raise exception 'Cotización no disponible';end if;
  if q.status in ('aprobada','rechazada') then raise exception 'La cotización final solo permite consulta e impresión';end if;
  select * into existing from public.purchase_requisitions where quote_id=q.id for update;
  if existing.id is not null and existing.updated_at is distinct from expected_updated_at then raise exception 'La requisición cambió. Vuelve a abrirla antes de editar';end if;
 end if;
 new_request:=q.id is null;
 if coalesce(new_status,'') not in ('pendiente','en_revision','aprobada','rechazada')
 or (new_request and new_status<>'pendiente')
 or (q.status='pendiente' and new_status not in ('pendiente','en_revision','rechazada'))
 or (q.status='en_revision' and new_status not in ('en_revision','aprobada','rechazada')) then raise exception 'Transición de estado inválida';end if;
 foreach field in array array['hospital','department','supplier','purpose'] loop
  if nullif(btrim(data->>field),'') is null or length(data->>field)>200 then raise exception 'Completa hospital, departamento, proveedor y equipo o servicio (máximo 200 caracteres)';end if;
 end loop;
 if not exists(select 1 from public.user_departments where name=btrim(data->>'department')) then raise exception 'Selecciona un departamento del catálogo';end if;
 if coalesce(data->>'currency','') not in ('MXN','USD','EUR') then raise exception 'Moneda inválida';end if;
 if length(data->>'supplier_address')>500 or length(data->>'payment_terms')>300 or length(data->>'notes')>2000 then raise exception 'Revisa la longitud de la dirección, condiciones y observaciones';end if;
 if nullif(btrim(data->>'supplier_phone'),'') is not null and (length(data->>'supplier_phone')>25 or data->>'supplier_phone' !~ '^[0-9+() .-]{5,25}$') then raise exception 'Teléfono del proveedor inválido';end if;
 if nullif(btrim(data->>'supplier_email'),'') is not null and (length(data->>'supplier_email')>254 or data->>'supplier_email' !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then raise exception 'Correo del proveedor inválido';end if;
 if coalesce(data->>'tax_percent','') !~ '^[0-9]+(\.[0-9]{1,2})?$' then raise exception 'Indica el IVA aplicable, con un máximo de dos decimales';end if;
 tax_rate:=(data->>'tax_percent')::numeric;
 if tax_rate<0 or tax_rate>100 then raise exception 'El porcentaje de IVA debe estar entre 0 y 100';end if;
 if jsonb_typeof(data->'items') is distinct from 'array' then raise exception 'Agrega las partidas de compra';end if;
 if jsonb_array_length(data->'items') not between 1 and 50 then raise exception 'La requisición admite de 1 a 50 partidas';end if;
 for item in select value from jsonb_array_elements(data->'items') loop
  if nullif(btrim(item->>'description'),'') is null or length(item->>'description')>500 or nullif(btrim(item->>'unit'),'') is null or length(item->>'unit')>20 or length(item->>'supplier_catalog')>80 then raise exception 'Completa descripción y unidad de cada partida';end if;
  foreach field in array array['quantity','unit_cost','discount_percent'] loop
   if coalesce(item->>field,'') !~ '^[0-9]+(\.[0-9]{1,2})?$' then raise exception 'Las cantidades, precios y descuentos admiten hasta dos decimales';end if;
  end loop;
  qty:=(item->>'quantity')::numeric;cost:=(item->>'unit_cost')::numeric;discount:=(item->>'discount_percent')::numeric;
  if qty<=0 or qty>100000 or cost<0 or cost>9999999999.99 or discount<0 or discount>100 then raise exception 'Revisa cantidad, precio y descuento de cada partida';end if;
  gross:=round(qty*cost,2);discount_amount:=round(gross*discount/100,2);net:=gross-discount_amount;
  subtotal_value:=subtotal_value+net;
  normalized_items:=normalized_items||jsonb_build_array(jsonb_build_object('description',btrim(item->>'description'),'quantity',qty,'unit',btrim(item->>'unit'),'supplier_catalog',nullif(btrim(item->>'supplier_catalog'),''),'unit_cost',cost,'discount_percent',discount,'gross',gross,'discount_amount',discount_amount,'line_total',net));
 end loop;
 tax_value:=round(subtotal_value*tax_rate/100,2);total_value:=subtotal_value+tax_value;
 if total_value>9999999999.99 then raise exception 'El total supera el límite permitido';end if;
 if existing.id is not null then requester:=existing.data->'requester';else
  select jsonb_build_object('id',id,'full_name',full_name,'institutional_id',institutional_id,'department',department) into requester from public.profiles where id=coalesce(q.requested_by,auth.uid());
 end if;
 payload:=jsonb_build_object('hospital',btrim(data->>'hospital'),'department',btrim(data->>'department'),'purpose',btrim(data->>'purpose'),'supplier',btrim(data->>'supplier'),
 'supplier_phone',nullif(btrim(data->>'supplier_phone'),''),'supplier_email',nullif(btrim(data->>'supplier_email'),''),'supplier_address',nullif(btrim(data->>'supplier_address'),''),
 'payment_terms',nullif(btrim(data->>'payment_terms'),''),'required_on',nullif(data->>'required_on','')::date,'delivery_on',nullif(data->>'delivery_on','')::date,
 'fixed_asset',coalesce((data->>'fixed_asset')::boolean,false),'out_of_line',coalesce((data->>'out_of_line')::boolean,false),'currency',data->>'currency',
 'tax_percent',tax_rate,'notes',nullif(btrim(data->>'notes'),''),'items',normalized_items,'requester',requester);
 if new_request then
  insert into public.quotes(supplier,equipment_description,amount,currency,notes) values(payload->>'supplier',payload->>'purpose',total_value,payload->>'currency',payload->>'notes') returning * into q;
 end if;
 insert into public.purchase_requisitions(quote_id,data,subtotal,tax_percent,tax_amount,total,created_by,updated_by)
 values(q.id,payload,subtotal_value,tax_rate,tax_value,total_value,auth.uid(),auth.uid())
 on conflict(quote_id) do update set data=excluded.data,subtotal=excluded.subtotal,tax_percent=excluded.tax_percent,tax_amount=excluded.tax_amount,total=excluded.total,updated_by=auth.uid(),updated_at=clock_timestamp()
 returning * into r;
 previous_status:=q.status;
 update public.quotes set supplier=payload->>'supplier',equipment_description=payload->>'purpose',amount=total_value,currency=payload->>'currency',notes=payload->>'notes',has_purchase_requisition=true,status=new_status,updated_at=clock_timestamp() where id=q.id returning * into q;
 if previous_status<>new_status then insert into public.quote_status_history(quote_id,previous_status,new_status,changed_by) values(q.id,previous_status,new_status,auth.uid());end if;
 return jsonb_build_object('quote',to_jsonb(q),'requisition',to_jsonb(r));
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then raise exception 'Revisa las fechas y valores numéricos del formulario';
end $$;

create function public.get_purchase_requisition(target_quote_id bigint) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not public.has_active_profile() or not public.is_manager() then raise exception 'Solo el jefe puede consultar requisiciones';end if;
 if not exists(select 1 from public.quotes where id=target_quote_id) then raise exception 'Cotización no disponible';end if;
 select to_jsonb(r) into result from public.purchase_requisitions r where quote_id=target_quote_id;
 return result;
end $$;

create function public.guard_requisition_quote() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.purchase_requisitions;
begin
 select * into r from public.purchase_requisitions where quote_id=new.id;
 if r.id is not null and (not new.has_purchase_requisition or new.amount is distinct from r.total or new.supplier is distinct from r.data->>'supplier' or new.equipment_description is distinct from r.data->>'purpose' or new.currency is distinct from r.data->>'currency' or new.notes is distinct from r.data->>'notes') then raise exception 'Edita los datos y partidas desde la requisición de compra';end if;
 return new;
end $$;
create trigger guard_requisition_quote before update on public.quotes for each row execute function public.guard_requisition_quote();
revoke all on function public.guard_requisition_quote() from public,anon,authenticated;
revoke all on function public.save_purchase_requisition(bigint,jsonb,timestamptz,text),public.get_purchase_requisition(bigint) from public,anon;
grant execute on function public.save_purchase_requisition(bigint,jsonb,timestamptz,text),public.get_purchase_requisition(bigint) to authenticated;
notify pgrst,'reload schema';
commit;
