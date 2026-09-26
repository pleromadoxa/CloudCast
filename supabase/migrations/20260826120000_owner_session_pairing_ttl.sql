-- Owner mixer sessions are pairing hubs, not 7-day tickets.
-- Regenerating an access code must revive the session so mobile can pair.

ALTER TABLE public.mixer_sessions
  ALTER COLUMN expires_at SET DEFAULT NULL;

UPDATE public.mixer_sessions
SET expires_at = NULL
WHERE owner_id IS NOT NULL
  AND is_active = true
  AND expires_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_mixer_session(p_access_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  row mixer_sessions%ROWTYPE;
  product text;
BEGIN
  SELECT * INTO row
  FROM mixer_sessions
  WHERE upper(access_code) = upper(trim(p_access_code))
    AND is_active = true
  LIMIT 1;

  IF row.id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired access code';
  END IF;

  IF to_regclass('public.revoked_mixer_access_codes') IS NOT NULL AND EXISTS (
    SELECT 1
    FROM revoked_mixer_access_codes
    WHERE upper(access_code) = upper(trim(p_access_code))
  ) THEN
    RAISE EXCEPTION 'Access code has been revoked';
  END IF;

  -- Owner sessions stay pairable for the life of the dashboard.
  -- Stale 7-day TTLs from older creates are healed instead of blocking pairing.
  IF row.owner_id IS NOT NULL THEN
    IF row.expires_at IS NOT NULL THEN
      UPDATE mixer_sessions
      SET expires_at = NULL, updated_at = now()
      WHERE id = row.id;
      row.expires_at := NULL;
    END IF;
  ELSIF row.expires_at IS NOT NULL AND row.expires_at < now() THEN
    RAISE EXCEPTION 'Session expired';
  END IF;

  product := coalesce(row.product_type, 'video');

  RETURN jsonb_build_object(
    'session_id', row.id,
    'access_code', row.access_code,
    'max_devices', row.max_devices,
    'max_mobile_devices', row.max_mobile_devices,
    'max_usb_devices', row.max_usb_devices,
    'plan_id', row.plan_id,
    'plan_name', (SELECT name FROM subscription_plans WHERE id = row.plan_id),
    'connection_mode', resolve_session_connection_mode(row.plan_id, product),
    'realtime_channel', mixer_session_realtime_channel(row.id),
    'device_count', (SELECT count(*) FROM paired_devices pd WHERE pd.session_id = row.id),
    'product_type', product
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.regenerate_access_code(p_session_id uuid, p_current_access_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_session public.mixer_sessions;
  v_old_code text;
  v_new_code text;
  v_attempts int := 0;
BEGIN
  SELECT * INTO v_session
  FROM public.mixer_sessions
  WHERE id = p_session_id
    AND access_code = upper(trim(p_current_access_code))
    AND is_active = true;

  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found or invalid code'; END IF;

  IF v_session.owner_id IS NOT NULL AND v_session.owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to regenerate this access code';
  END IF;

  v_old_code := v_session.access_code;

  PERFORM public.revoke_mixer_access_code(v_old_code, p_session_id);

  DELETE FROM public.paired_devices WHERE session_id = p_session_id;

  LOOP
    v_new_code := public.generate_unique_access_code();
    IF v_new_code = v_old_code THEN
      CONTINUE;
    END IF;
    BEGIN
      UPDATE public.mixer_sessions
      SET access_code = v_new_code, expires_at = NULL, updated_at = now()
      WHERE id = p_session_id
      RETURNING * INTO v_session;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      v_attempts := v_attempts + 1;
      IF v_attempts > 20 THEN RAISE EXCEPTION 'Could not regenerate unique access code'; END IF;
    END;
  END LOOP;

  RETURN public.session_plan_payload(v_session);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_or_create_owner_session()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  row mixer_sessions%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO row
  FROM mixer_sessions
  WHERE owner_id = uid
    AND is_active = true
  ORDER BY
    CASE coalesce(product_type, 'video') WHEN 'video' THEN 0 ELSE 1 END,
    created_at DESC
  LIMIT 1;

  IF row.id IS NULL THEN
    RETURN get_or_create_owner_session_with_product('video');
  END IF;

  IF coalesce(row.product_type, 'video') = 'audio' THEN
    UPDATE mixer_sessions
    SET product_type = 'video', expires_at = NULL, updated_at = now()
    WHERE id = row.id
    RETURNING * INTO row;
  ELSIF row.expires_at IS NOT NULL THEN
    UPDATE mixer_sessions
    SET expires_at = NULL, updated_at = now()
    WHERE id = row.id
    RETURNING * INTO row;
  END IF;

  RETURN sync_mixer_session_plan(row.id, row.access_code);
END;
$function$;

CREATE OR REPLACE FUNCTION public.pair_device(
  p_access_code text,
  p_device_id text,
  p_label text DEFAULT 'Camera'::text,
  p_platform text DEFAULT 'unknown'::text,
  p_device_type text DEFAULT 'mobile'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_session public.mixer_sessions;
  v_device public.paired_devices;
  v_count int;
  v_mobile_count int;
  v_usb_count int;
  v_slot int;
  v_dtype public.device_type;
  v_code text := upper(trim(p_access_code));
BEGIN
  PERFORM public.assert_access_code_not_revoked(v_code);

  v_dtype := CASE WHEN lower(p_device_type) = 'usb' THEN 'usb'::public.device_type ELSE 'mobile'::public.device_type END;

  SELECT * INTO v_session FROM public.mixer_sessions
  WHERE access_code = v_code AND is_active = true
    AND (
      owner_id IS NOT NULL
      OR expires_at IS NULL
      OR expires_at > now()
    );
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or expired access code'; END IF;

  SELECT * INTO v_device FROM public.paired_devices
  WHERE session_id = v_session.id AND device_id = p_device_id;

  IF FOUND THEN
    UPDATE public.paired_devices SET
      label = COALESCE(nullif(trim(p_label), ''), label),
      platform = CASE WHEN p_platform IN ('ios','android','usb') THEN p_platform ELSE platform END,
      device_type = v_dtype,
      last_seen_at = now(),
      status = 'connecting'
    WHERE id = v_device.id RETURNING * INTO v_device;
  ELSE
    SELECT count(*)::int INTO v_count FROM public.paired_devices WHERE session_id = v_session.id;
    SELECT count(*)::int INTO v_mobile_count FROM public.paired_devices WHERE session_id = v_session.id AND device_type = 'mobile';
    SELECT count(*)::int INTO v_usb_count FROM public.paired_devices WHERE session_id = v_session.id AND device_type = 'usb';

    IF v_count >= v_session.max_devices THEN
      RAISE EXCEPTION 'Session has reached maximum devices (%)', v_session.max_devices;
    END IF;
    IF v_dtype = 'mobile' AND v_mobile_count >= v_session.max_mobile_devices THEN
      RAISE EXCEPTION 'Mobile device limit reached (%) for % plan', v_session.max_mobile_devices, v_session.plan_id;
    END IF;
    IF v_dtype = 'usb' AND v_usb_count >= v_session.max_usb_devices THEN
      RAISE EXCEPTION 'USB capture device limit reached (%) — upgrade to Pro Master', v_session.max_usb_devices;
    END IF;
    IF v_dtype = 'usb' AND v_session.max_usb_devices = 0 THEN
      RAISE EXCEPTION 'USB capture requires Pro Master plan';
    END IF;

    SELECT s.n INTO v_slot FROM generate_series(1, v_session.max_devices) AS s(n)
    LEFT JOIN public.paired_devices pd ON pd.session_id = v_session.id AND pd.slot_number = s.n
    WHERE pd.id IS NULL ORDER BY s.n LIMIT 1;
    IF v_slot IS NULL THEN RAISE EXCEPTION 'No available slot'; END IF;

    INSERT INTO public.paired_devices (session_id, device_id, slot_number, label, platform, device_type, status)
    VALUES (
      v_session.id, p_device_id, v_slot,
      COALESCE(nullif(trim(p_label), ''), CASE WHEN v_dtype = 'usb' THEN 'USB Capture' ELSE 'Camera' END),
      CASE WHEN p_platform IN ('ios','android','usb') THEN p_platform ELSE 'unknown' END,
      v_dtype, 'connecting'
    ) RETURNING * INTO v_device;
  END IF;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'access_code', v_session.access_code,
    'realtime_channel', mixer_session_realtime_channel(v_session.id),
    'plan_id', v_session.plan_id,
    'connection_mode', v_session.connection_mode,
    'max_devices', v_session.max_devices,
    'max_mobile_devices', v_session.max_mobile_devices,
    'max_usb_devices', v_session.max_usb_devices,
    'paired', true,
    'device', to_jsonb(v_device)
  );
END;
$function$;
