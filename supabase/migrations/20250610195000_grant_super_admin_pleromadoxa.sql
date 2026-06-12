-- Grant super_admin to the CloudCast owner account
INSERT INTO public.admin_users (user_id, role, granted_by)
SELECT u.id, 'super_admin', u.id
FROM auth.users u
WHERE lower(u.email) = lower('pleromadoxa@gmail.com')
ON CONFLICT (user_id) DO UPDATE
  SET role = 'super_admin', revoked_at = NULL, granted_at = now();
