create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  institutional_id text not null unique check (institutional_id ~ '^(00|01|02)[0-9]{6}$'),
  full_name text not null,
  role public.app_role not null,
  department text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint profile_role_matches_id check (
    (role = 'jefe' and left(institutional_id, 2) = '00') or
    (role = 'tecnico' and left(institutional_id, 2) = '01') or
    (role = 'usuario' and left(institutional_id, 2) = '02')
  )
);

-- After creating the three accounts in Supabase Authentication, run this
-- block to link them to their application profiles.
insert into public.profiles (
  id,
  institutional_id,
  full_name,
  role,
  department
)
select
  id,
  '00123456',
  'Administrador Biomédico',
  'jefe'::public.app_role,
  'Ingeniería Clínica'
from auth.users
where email = '00123456@biomedgest.local'
on conflict (institutional_id) do update set
  id = excluded.id,
  full_name = excluded.full_name,
  role = excluded.role,
  department = excluded.department;

insert into public.profiles (
  id,
  institutional_id,
  full_name,
  role,
  department
)
select
  id,
  '01123456',
  'Ingeniero Biomédico',
  'tecnico'::public.app_role,
  'Ingeniería Clínica'
from auth.users
where email = '01123456@biomedgest.local'
on conflict (institutional_id) do update set
  id = excluded.id,
  full_name = excluded.full_name,
  role = excluded.role,
  department = excluded.department;

insert into public.profiles (
  id,
  institutional_id,
  full_name,
  role,
  department
)
select
  id,
  '02123456',
  'Usuario Clínico',
  'usuario'::public.app_role,
  'Área Clínica'
from auth.users
where email = '02123456@biomedgest.local'
on conflict (institutional_id) do update set
  id = excluded.id,
  full_name = excluded.full_name,
  role = excluded.role,
  department = excluded.department;
