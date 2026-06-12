-- Profile dashboard: account summary RPC for authenticated users

CREATE OR REPLACE FUNCTION public.get_user_account_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_grant jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  PERFORM public.sync_expired_plan_grants(v_user_id);

  SELECT jsonb_build_object(
    'id', pg.id,
    'plan_id', pg.plan_id,
    'previous_plan_id', pg.previous_plan_id,
    'reason', pg.reason,
    'expires_at', pg.expires_at,
    'created_at', pg.created_at
  )
  INTO v_grant
  FROM public.plan_grants pg
  WHERE pg.user_id = v_user_id
    AND pg.revoked_at IS NULL
    AND (pg.expires_at IS NULL OR pg.expires_at > now())
  ORDER BY pg.created_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'member_since', (SELECT u.created_at FROM auth.users u WHERE u.id = v_user_id),
    'active_plan_grant', v_grant,
    'mixer_sessions', (
      SELECT COALESCE(
        jsonb_agg(row_to_json(t) ORDER BY t.is_active DESC, t.updated_at DESC NULLS LAST),
        '[]'::jsonb
      )
      FROM (
        SELECT
          ms.id AS session_id,
          ms.access_code,
          ms.plan_id,
          ms.is_active,
          ms.expires_at,
          ms.created_at,
          ms.updated_at,
          (
            SELECT count(*)::int
            FROM public.paired_devices pd
            WHERE pd.session_id = ms.id
          ) AS device_count,
          (
            SELECT count(*)::int
            FROM public.paired_devices pd
            WHERE pd.session_id = ms.id AND pd.status = 'live'
          ) AS live_device_count
        FROM public.mixer_sessions ms
        WHERE ms.owner_id = v_user_id
        ORDER BY ms.is_active DESC, ms.updated_at DESC NULLS LAST
        LIMIT 10
      ) t
    ),
    'session_count', (
      SELECT count(*)::int FROM public.mixer_sessions WHERE owner_id = v_user_id
    ),
    'active_session_count', (
      SELECT count(*)::int
      FROM public.mixer_sessions
      WHERE owner_id = v_user_id AND is_active = true
    ),
    'stream_destinations_count', (
      SELECT count(*)::int FROM public.stream_destinations WHERE user_id = v_user_id
    ),
    'enabled_stream_destinations_count', (
      SELECT count(*)::int
      FROM public.stream_destinations WHERE user_id = v_user_id AND is_enabled = true
    ),
    'coupon_redemptions_count', (
      SELECT count(*)::int FROM public.coupon_redemptions WHERE user_id = v_user_id
    ),
    'recent_activity', (
      SELECT COALESCE(jsonb_agg(row_to_json(a) ORDER BY a.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          al.id,
          al.action,
          al.resource_type,
          al.resource_id,
          al.metadata,
          al.created_at
        FROM public.activity_logs al
        WHERE al.actor_id = v_user_id
        ORDER BY al.created_at DESC
        LIMIT 15
      ) a
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_account_dashboard() TO authenticated;
