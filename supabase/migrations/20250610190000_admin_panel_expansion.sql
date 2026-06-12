-- Admin panel expansion: devices, recordings, admins, system health, session detail

CREATE OR REPLACE FUNCTION public.admin_list_admins()
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

  RETURN COALESCE(
    (
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.granted_at DESC)
      FROM (
        SELECT
          au.user_id,
          u.email,
          p.full_name,
          au.role,
          au.granted_at,
          au.revoked_at,
          gb.email AS granted_by_email
        FROM public.admin_users au
        JOIN auth.users u ON u.id = au.user_id
        LEFT JOIN public.profiles p ON p.id = au.user_id
        LEFT JOIN auth.users gb ON gb.id = au.granted_by
        WHERE au.revoked_at IS NULL
        ORDER BY au.granted_at DESC
      ) t
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_session_detail(p_session_id uuid)
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
    'session', (
      SELECT row_to_json(s)
      FROM (
        SELECT
          ms.*,
          u.email AS owner_email,
          p.full_name AS owner_name
        FROM public.mixer_sessions ms
        LEFT JOIN auth.users u ON u.id = ms.owner_id
        LEFT JOIN public.profiles p ON p.id = ms.owner_id
        WHERE ms.id = p_session_id
      ) s
    ),
    'devices', (
      SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY d.slot_number), '[]'::jsonb)
      FROM (
        SELECT
          id,
          device_id,
          slot_number,
          label,
          device_type,
          device_role,
          platform,
          status,
          audio_source,
          battery_level,
          network_type,
          paired_at,
          last_seen_at,
          updated_at
        FROM public.paired_devices
        WHERE session_id = p_session_id
        ORDER BY slot_number
      ) d
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_paired_devices(
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0,
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL
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
  v_search text := NULLIF(trim(p_search), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN jsonb_build_object(
    'total', (
      SELECT count(*)
      FROM public.paired_devices pd
      JOIN public.mixer_sessions ms ON ms.id = pd.session_id
      LEFT JOIN auth.users u ON u.id = ms.owner_id
      WHERE (p_status IS NULL OR pd.status = p_status)
        AND (
          v_search IS NULL
          OR pd.label ILIKE '%' || v_search || '%'
          OR pd.device_id ILIKE '%' || v_search || '%'
          OR ms.access_code ILIKE '%' || v_search || '%'
          OR u.email ILIKE '%' || v_search || '%'
        )
    ),
    'devices', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT
          pd.id,
          pd.device_id,
          pd.slot_number,
          pd.label,
          pd.device_type,
          pd.platform,
          pd.status,
          pd.battery_level,
          pd.network_type,
          pd.paired_at,
          pd.last_seen_at,
          ms.id AS session_id,
          ms.access_code,
          ms.owner_id,
          u.email AS owner_email,
          p.full_name AS owner_name
        FROM public.paired_devices pd
        JOIN public.mixer_sessions ms ON ms.id = pd.session_id
        LEFT JOIN auth.users u ON u.id = ms.owner_id
        LEFT JOIN public.profiles p ON p.id = ms.owner_id
        WHERE (p_status IS NULL OR pd.status = p_status)
          AND (
            v_search IS NULL
            OR pd.label ILIKE '%' || v_search || '%'
            OR pd.device_id ILIKE '%' || v_search || '%'
            OR ms.access_code ILIKE '%' || v_search || '%'
            OR u.email ILIKE '%' || v_search || '%'
          )
        ORDER BY pd.last_seen_at DESC NULLS LAST, pd.paired_at DESC
        LIMIT v_limit OFFSET v_offset
      ) t
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_all_recordings(
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_search text DEFAULT NULL
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
      FROM public.mixer_recordings mr
      LEFT JOIN auth.users u ON u.id = mr.user_id
      WHERE v_search IS NULL
        OR mr.file_name ILIKE '%' || v_search || '%'
        OR u.email ILIKE '%' || v_search || '%'
    ),
    'recordings', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT
          mr.id,
          mr.user_id,
          u.email AS user_email,
          p.full_name AS user_name,
          mr.file_name,
          mr.size_bytes,
          mr.mime_type,
          mr.storage_path,
          mr.created_at,
          mr.session_id
        FROM public.mixer_recordings mr
        LEFT JOIN auth.users u ON u.id = mr.user_id
        LEFT JOIN public.profiles p ON p.id = mr.user_id
        WHERE v_search IS NULL
          OR mr.file_name ILIKE '%' || v_search || '%'
          OR u.email ILIKE '%' || v_search || '%'
        ORDER BY mr.created_at DESC
        LIMIT v_limit OFFSET v_offset
      ) t
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_error_log(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  DELETE FROM public.error_logs WHERE id = p_id;

  PERFORM public.log_activity('admin.error.delete', 'error_log', p_id::text, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_clear_old_error_logs(p_days int DEFAULT 30)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Super admin access required';
  END IF;

  DELETE FROM public.error_logs
  WHERE created_at < now() - make_interval(days => GREATEST(p_days, 1))
  RETURNING count(*) INTO v_count;

  PERFORM public.log_activity(
    'admin.errors.clear',
    'error_log',
    NULL,
    jsonb_build_object('deleted', v_count, 'older_than_days', p_days)
  );

  RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_deactivate_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE public.mixer_sessions
  SET is_active = false, updated_at = now()
  WHERE id = p_session_id;

  PERFORM public.log_activity('admin.session.deactivate', 'mixer_session', p_session_id::text, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_system_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_heartbeat record;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_heartbeat FROM public.system_heartbeat WHERE id = 1;

  RETURN jsonb_build_object(
    'heartbeat', row_to_json(v_heartbeat),
    'stream_destinations', (SELECT count(*) FROM public.stream_destinations),
    'enabled_destinations', (SELECT count(*) FROM public.stream_destinations WHERE is_enabled = true),
    'admin_count', (SELECT count(*) FROM public.admin_users WHERE revoked_at IS NULL),
    'activity_7d', (
      SELECT count(*) FROM public.activity_logs
      WHERE created_at >= now() - interval '7 days'
    ),
    'errors_7d', (
      SELECT count(*) FROM public.error_logs
      WHERE created_at >= now() - interval '7 days'
    ),
    'new_users_7d', (
      SELECT count(*) FROM auth.users
      WHERE created_at >= now() - interval '7 days'
    ),
    'recent_activity', (
      SELECT COALESCE(jsonb_agg(row_to_json(a) ORDER BY a.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT id, actor_email, action, resource_type, created_at
        FROM public.activity_logs
        ORDER BY created_at DESC
        LIMIT 10
      ) a
    ),
    'recent_errors', (
      SELECT COALESCE(jsonb_agg(row_to_json(e) ORDER BY e.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT id, severity, message, source, created_at
        FROM public.error_logs
        ORDER BY created_at DESC
        LIMIT 10
      ) e
    )
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
    'stream_destinations', (SELECT count(*) FROM public.stream_destinations),
    'activity_24h', (
      SELECT count(*) FROM public.activity_logs
      WHERE created_at >= now() - interval '24 hours'
    ),
    'errors_24h', (
      SELECT count(*) FROM public.error_logs
      WHERE created_at >= now() - interval '24 hours'
    ),
    'errors_open', (SELECT count(*) FROM public.error_logs WHERE severity IN ('error', 'fatal')),
    'admin_count', (SELECT count(*) FROM public.admin_users WHERE revoked_at IS NULL)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_admins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_session_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_paired_devices(int, int, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_all_recordings(int, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_error_log(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_old_error_logs(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_deactivate_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_system_health() TO authenticated;
