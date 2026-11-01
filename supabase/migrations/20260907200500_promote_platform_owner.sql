-- The project owner account is the primary super administrator of the platform console.
update public.platform_admins pa
set role = 'super_admin'
from auth.users u
where u.id = pa.user_id
  and lower(u.email) = 'admin@example.com';

notify pgrst, 'reload schema';
