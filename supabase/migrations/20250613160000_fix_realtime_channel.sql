-- realtime_channel is derived from session id (cloudcast-{uuid}), not a table column.

CREATE OR REPLACE FUNCTION mixer_session_realtime_channel(p_session_id uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'cloudcast-' || p_session_id::text;
$$;

CREATE OR REPLACE FUNCTION mixer_session_to_jsonb(p_row mixer_sessions)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN jsonb_build_object(
    'session_id', p_row.id,
    'access_code', p_row.access_code,
    'max_devices', p_row.max_devices,
    'max_mobile_devices', p_row.max_mobile_devices,
    'max_usb_devices', p_row.max_usb_devices,
    'plan_id', p_row.plan_id,
    'plan_name', (SELECT name FROM subscription_plans WHERE id = p_row.plan_id),
    'connection_mode', resolve_session_connection_mode(p_row.plan_id, coalesce(p_row.product_type, 'video')),
    'realtime_channel', mixer_session_realtime_channel(p_row.id),
    'device_count', (SELECT count(*) FROM paired_devices pd WHERE pd.session_id = p_row.id),
    'product_type', p_row.product_type,
    'bridge_code', p_row.bridge_code
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_mixer_session(p_access_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF row.expires_at IS NOT NULL AND row.expires_at < now() THEN
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
$$;

CREATE OR REPLACE FUNCTION resolve_mixer_bridge(p_bridge_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row mixer_sessions%ROWTYPE;
BEGIN
  SELECT * INTO row
  FROM mixer_sessions
  WHERE bridge_code = upper(trim(p_bridge_code))
    AND is_active = true
  LIMIT 1;

  IF row.id IS NULL THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'audio_session_id', row.id,
    'audio_access_code', row.access_code,
    'audio_realtime_channel', mixer_session_realtime_channel(row.id),
    'owner_id', row.owner_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION link_video_to_audio_bridge(
  p_video_session_id uuid,
  p_bridge_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  audio_row mixer_sessions%ROWTYPE;
  video_row mixer_sessions%ROWTYPE;
BEGIN
  SELECT * INTO video_row
  FROM mixer_sessions
  WHERE id = p_video_session_id AND owner_id = auth.uid() AND is_active = true;

  IF video_row.id IS NULL THEN RAISE EXCEPTION 'Video session not found'; END IF;

  SELECT * INTO audio_row
  FROM mixer_sessions
  WHERE bridge_code = upper(trim(p_bridge_code)) AND is_active = true;

  IF audio_row.id IS NULL THEN RAISE EXCEPTION 'Bridge code not found'; END IF;

  IF audio_row.owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'Bridge code not found';
  END IF;

  UPDATE mixer_sessions SET linked_session_id = audio_row.id WHERE id = video_row.id;

  RETURN jsonb_build_object(
    'audio_session_id', audio_row.id,
    'audio_access_code', audio_row.access_code,
    'audio_realtime_channel', mixer_session_realtime_channel(audio_row.id),
    'bridge_code', audio_row.bridge_code
  );
END;
$$;

GRANT EXECUTE ON FUNCTION mixer_session_realtime_channel(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mixer_session_to_jsonb(mixer_sessions) TO authenticated;
GRANT EXECUTE ON FUNCTION get_mixer_session(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION resolve_mixer_bridge(text) TO authenticated;
GRANT EXECUTE ON FUNCTION link_video_to_audio_bridge(uuid, text) TO authenticated;
