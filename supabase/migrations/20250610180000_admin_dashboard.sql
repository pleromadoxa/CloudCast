-- Admin dashboard: roles, activity logs, error logs, and management RPCs

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin', 'support')),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_users_self_read ON public.admin_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL,
  resource_type text,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx
  ON public.activity_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS activity_logs_actor_idx
  ON public.activity_logs (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS activity_logs_action_idx
  ON public.activity_logs (action, created_at DESC);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.mixer_sessions(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'client',
  severity text NOT NULL DEFAULT 'error' CHECK (severity IN ('warn', 'error', 'fatal')),
  message text NOT NULL,
  stack text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS error_logs_created_at_idx
  ON public.error_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS error_logs_severity_idx
  ON public.error_logs (severity, created_at DESC);

CREATE INDEX IF NOT EXISTS error_logs_user_idx
  ON public.error_logs (user_id, created_at DESC);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
      AND revoked_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND revoked_at IS NULL
  );
$$;

CREATE POLICY activity_logs_admin_select ON public.activity_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY error_logs_admin_select ON public.error_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.log_activity(
  p_action text,
  p_resource_type text DEFAULT NULL,
  p_resource_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_actor_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := COALESCE(p_actor_id, auth.uid());
  v_email text;
  v_id uuid;
BEGIN
  IF v_actor IS NOT NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_actor;
  END IF;

  INSERT INTO public.activity_logs (actor_id, actor_email, action, resource_type, resource_id, metadata)
  VALUES (v_actor, v_email, p_action, p_resource_type, p_resource_id, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_client_error(
  p_message text,
  p_stack text DEFAULT NULL,
  p_context jsonb DEFAULT '{}'::jsonb,
  p_severity text DEFAULT 'error',
  p_source text DEFAULT 'client',
  p_session_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_severity text := COALESCE(NULLIF(p_severity, ''), 'error');
BEGIN
  IF v_severity NOT IN ('warn', 'error', 'fatal') THEN
    v_severity := 'error';
  END IF;

  INSERT INTO public.error_logs (user_id, session_id, source, severity, message, stack, context)
  VALUES (
    auth.uid(),
    p_session_id,
    COALESCE(NULLIF(p_source, ''), 'client'),
    v_severity,
    left(COALESCE(p_message, 'Unknown error'), 4000),
    left(p_stack, 8000),
    COALESCE(p_context, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_bootstrap_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM public.admin_users WHERE revoked_at IS NULL) THEN
    RETURN false;
  END IF;

  INSERT INTO public.admin_users (user_id, role, granted_by)
  VALUES (auth.uid(), 'super_admin', auth.uid())
  ON CONFLICT (user_id) DO UPDATE
    SET role = 'super_admin', revoked_at = NULL, granted_at = now();

  PERFORM public.log_activity('admin.bootstrap', 'admin_user', auth.uid()::text, '{}'::jsonb);

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_access()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('is_admin', false, 'role', null);
  END IF;

  SELECT role INTO v_role
  FROM public.admin_users
  WHERE user_id = auth.uid() AND revoked_at IS NULL;

  RETURN jsonb_build_object(
    'is_admin', v_role IS NOT NULL,
    'role', v_role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'users_by_plan', (
      SELECT COALESCE(jsonb_object_agg(plan_id, cnt), '{}'::jsonb)
      FROM (
        SELECT plan_id, count(*)::int AS cnt
        FROM public.profiles
        GROUP BY plan_id
      ) s
    ),
    'active_sessions', (SELECT count(*) FROM public.mixer_sessions WHERE is_active = true),
    'total_sessions', (SELECT count(*) FROM public.mixer_sessions),
    'paired_devices', (SELECT count(*) FROM public.paired_devices),
    'live_devices', (SELECT count(*) FROM public.paired_devices WHERE status = 'live'),
    'recordings_count', (SELECT count(*) FROM public.mixer_recordings),
    'recordings_bytes', (SELECT COALESCE(sum(size_bytes), 0) FROM public.mixer_recordings),
    'activity_24h', (
      SELECT count(*) FROM public.activity_logs
      WHERE created_at >= now() - interval '24 hours'
    ),
    'errors_24h', (
      SELECT count(*) FROM public.error_logs
      WHERE created_at >= now() - interval '24 hours'
    ),
    'errors_open', (SELECT count(*) FROM public.error_logs WHERE severity IN ('error', 'fatal'))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
  v_search text := NULLIF(trim(p_search), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN jsonb_build_object(
    'total', (
      SELECT count(*)
      FROM public.profiles p
      JOIN auth.users u ON u.id = p.id
      WHERE v_search IS NULL
        OR u.email ILIKE '%' || v_search || '%'
        OR p.full_name ILIKE '%' || v_search || '%'
    ),
    'users', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT
          p.id,
          u.email,
          p.full_name,
          p.plan_id,
          sp.name AS plan_name,
          p.updated_at,
          u.created_at AS signed_up_at,
          EXISTS (
            SELECT 1 FROM public.admin_users au
            WHERE au.user_id = p.id AND au.revoked_at IS NULL
          ) AS is_admin,
          (SELECT count(*) FROM public.mixer_sessions ms WHERE ms.owner_id = p.id) AS session_count,
          (SELECT count(*) FROM public.mixer_recordings mr WHERE mr.user_id = p.id) AS recording_count
        FROM public.profiles p
        JOIN auth.users u ON u.id = p.id
        JOIN public.subscription_plans sp ON sp.id = p.plan_id
        WHERE v_search IS NULL
          OR u.email ILIKE '%' || v_search || '%'
          OR p.full_name ILIKE '%' || v_search || '%'
        ORDER BY u.created_at DESC
        LIMIT v_limit OFFSET v_offset
      ) t
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_user_detail(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN jsonb_build_object(
    'profile', (
      SELECT row_to_json(t)
      FROM (
        SELECT
          p.id,
          u.email,
          p.full_name,
          p.plan_id,
          sp.name AS plan_name,
          p.updated_at,
          u.created_at AS signed_up_at,
          EXISTS (
            SELECT 1 FROM public.admin_users au
            WHERE au.user_id = p.id AND au.revoked_at IS NULL
          ) AS is_admin
        FROM public.profiles p
        JOIN auth.users u ON u.id = p.id
        JOIN public.subscription_plans sp ON sp.id = p.plan_id
        WHERE p.id = p_user_id
      ) t
    ),
    'sessions', (
      SELECT COALESCE(jsonb_agg(row_to_json(s) ORDER BY s.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT id, access_code, plan_id, connection_mode, max_devices, is_active, expires_at, created_at, updated_at
        FROM public.mixer_sessions
        WHERE owner_id = p_user_id
        ORDER BY created_at DESC
        LIMIT 20
      ) s
    ),
    'recordings', (
      SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT id, file_name, size_bytes, mime_type, created_at
        FROM public.mixer_recordings
        WHERE user_id = p_user_id
        ORDER BY created_at DESC
        LIMIT 20
      ) r
    ),
    'destinations', (
      SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY d.sort_order), '[]'::jsonb)
      FROM (
        SELECT id, name, platform, is_enabled, sort_order, created_at
        FROM public.stream_destinations
        WHERE user_id = p_user_id
        ORDER BY sort_order
      ) d
    ),
    'recent_activity', (
      SELECT COALESCE(jsonb_agg(row_to_json(a) ORDER BY a.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT id, action, resource_type, resource_id, metadata, created_at
        FROM public.activity_logs
        WHERE actor_id = p_user_id
        ORDER BY created_at DESC
        LIMIT 30
      ) a
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_plan(p_user_id uuid, p_plan_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE id = p_plan_id) THEN
    RAISE EXCEPTION 'Unknown plan: %', p_plan_id;
  END IF;

  SELECT plan_id INTO v_old FROM public.profiles WHERE id = p_user_id;
  IF v_old IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  UPDATE public.profiles SET plan_id = p_plan_id, updated_at = now() WHERE id = p_user_id;

  PERFORM public.log_activity(
    'admin.user.plan_change',
    'profile',
    p_user_id::text,
    jsonb_build_object('from', v_old, 'to', p_plan_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_plans()
RETURNS SETOF public.subscription_plans
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.subscription_plans
  WHERE public.is_admin()
  ORDER BY price_monthly_cents;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_plan(
  p_plan_id text,
  p_name text DEFAULT NULL,
  p_max_mobile_devices int DEFAULT NULL,
  p_max_usb_devices int DEFAULT NULL,
  p_max_total_channels int DEFAULT NULL,
  p_connection_mode text DEFAULT NULL,
  p_price_monthly_cents int DEFAULT NULL,
  p_features jsonb DEFAULT NULL
)
RETURNS public.subscription_plans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.subscription_plans;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Super admin access required';
  END IF;

  UPDATE public.subscription_plans
  SET
    name = COALESCE(p_name, name),
    max_mobile_devices = COALESCE(p_max_mobile_devices, max_mobile_devices),
    max_usb_devices = COALESCE(p_max_usb_devices, max_usb_devices),
    max_total_channels = COALESCE(p_max_total_channels, max_total_channels),
    connection_mode = COALESCE(p_connection_mode, connection_mode),
    price_monthly_cents = COALESCE(p_price_monthly_cents, price_monthly_cents),
    features = COALESCE(p_features, features)
  WHERE id = p_plan_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Plan not found';
  END IF;

  PERFORM public.log_activity(
    'admin.plan.update',
    'subscription_plan',
    p_plan_id,
    jsonb_build_object(
      'name', v_row.name,
      'max_total_channels', v_row.max_total_channels,
      'price_monthly_cents', v_row.price_monthly_cents
    )
  );

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_activity_logs(
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0,
  p_action text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN jsonb_build_object(
    'total', (
      SELECT count(*) FROM public.activity_logs al
      WHERE p_action IS NULL OR al.action ILIKE '%' || p_action || '%'
    ),
    'logs', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT id, actor_id, actor_email, action, resource_type, resource_id, metadata, created_at
        FROM public.activity_logs al
        WHERE p_action IS NULL OR al.action ILIKE '%' || p_action || '%'
        ORDER BY created_at DESC
        LIMIT v_limit OFFSET v_offset
      ) t
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_error_logs(
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0,
  p_severity text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN jsonb_build_object(
    'total', (
      SELECT count(*) FROM public.error_logs el
      WHERE p_severity IS NULL OR el.severity = p_severity
    ),
    'logs', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT
          el.id,
          el.user_id,
          u.email AS user_email,
          el.session_id,
          el.source,
          el.severity,
          el.message,
          el.stack,
          el.context,
          el.created_at
        FROM public.error_logs el
        LEFT JOIN auth.users u ON u.id = el.user_id
        WHERE p_severity IS NULL OR el.severity = p_severity
        ORDER BY el.created_at DESC
        LIMIT v_limit OFFSET v_offset
      ) t
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_mixer_sessions(
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_active_only boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN jsonb_build_object(
    'total', (
      SELECT count(*) FROM public.mixer_sessions ms
      WHERE NOT p_active_only OR ms.is_active = true
    ),
    'sessions', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT
          ms.id,
          ms.access_code,
          ms.owner_id,
          u.email AS owner_email,
          p.full_name AS owner_name,
          ms.plan_id,
          ms.connection_mode,
          ms.max_devices,
          ms.is_active,
          ms.expires_at,
          ms.created_at,
          ms.updated_at,
          (SELECT count(*) FROM public.paired_devices pd WHERE pd.session_id = ms.id) AS device_count,
          (SELECT count(*) FROM public.paired_devices pd WHERE pd.session_id = ms.id AND pd.status = 'live') AS live_device_count
        FROM public.mixer_sessions ms
        LEFT JOIN auth.users u ON u.id = ms.owner_id
        LEFT JOIN public.profiles p ON p.id = ms.owner_id
        WHERE NOT p_active_only OR ms.is_active = true
        ORDER BY ms.updated_at DESC NULLS LAST, ms.created_at DESC
        LIMIT v_limit OFFSET v_offset
      ) t
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_grant_role(
  p_user_id uuid,
  p_role text DEFAULT 'admin'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Super admin access required';
  END IF;

  IF p_role NOT IN ('admin', 'super_admin', 'support') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  INSERT INTO public.admin_users (user_id, role, granted_by)
  VALUES (p_user_id, p_role, auth.uid())
  ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role, granted_by = auth.uid(), granted_at = now(), revoked_at = NULL;

  PERFORM public.log_activity('admin.user.grant_role', 'admin_user', p_user_id::text, jsonb_build_object('role', p_role));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_role(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Super admin access required';
  END IF;

  UPDATE public.admin_users
  SET revoked_at = now()
  WHERE user_id = p_user_id AND revoked_at IS NULL;

  PERFORM public.log_activity('admin.user.revoke_role', 'admin_user', p_user_id::text, '{}'::jsonb);
END;
$$;

-- Activity triggers for key tables
CREATE OR REPLACE FUNCTION public.trg_log_profile_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.plan_id IS DISTINCT FROM NEW.plan_id THEN
    PERFORM public.log_activity(
      'profile.plan_change',
      'profile',
      NEW.id::text,
      jsonb_build_object('from', OLD.plan_id, 'to', NEW.plan_id),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_plan_change_log ON public.profiles;
CREATE TRIGGER profiles_plan_change_log
  AFTER UPDATE OF plan_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_log_profile_plan_change();

CREATE OR REPLACE FUNCTION public.trg_log_mixer_recording()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity(
      'recording.upload',
      'mixer_recording',
      NEW.id::text,
      jsonb_build_object('file_name', NEW.file_name, 'size_bytes', NEW.size_bytes),
      NEW.user_id
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_activity(
      'recording.delete',
      'mixer_recording',
      OLD.id::text,
      jsonb_build_object('file_name', OLD.file_name, 'size_bytes', OLD.size_bytes),
      OLD.user_id
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS mixer_recordings_activity_log ON public.mixer_recordings;
CREATE TRIGGER mixer_recordings_activity_log
  AFTER INSERT OR DELETE ON public.mixer_recordings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_log_mixer_recording();

GRANT EXECUTE ON FUNCTION public.log_client_error(text, text, jsonb, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_bootstrap_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_user_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_plan(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_plans() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_plan(text, text, int, int, int, text, int, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_activity_logs(int, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_error_logs(int, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_mixer_sessions(int, int, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_role(uuid) TO authenticated;
