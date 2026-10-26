select
  p.institutional_id,
  p.full_name,
  p.role,
  p.active,
  u.email,
  u.email_confirmed_at is not null as email_confirmed
from public.profiles p
join auth.users u on u.id = p.id
where p.institutional_id in ('00123456', '01123456', '02123456')
order by p.institutional_id;
