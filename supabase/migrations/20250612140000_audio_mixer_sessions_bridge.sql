-- Separate audio mixer sessions + bridge codes to link audio ↔ video mixers.

ALTER TABLE mixer_sessions
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'video',
  ADD COLUMN IF NOT EXISTS bridge_code text,
  ADD COLUMN IF NOT EXISTS linked_session_id uuid REFERENCES mixer_sessions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS mixer_sessions_bridge_code_idx
  ON mixer_sessions (bridge_code)
  WHERE bridge_code IS NOT NULL;

CREATE OR REPLACE FUNCTION get_or_create_audio_owner_session()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    AND product_type = 'audio'
  ORDER BY created_at DESC
  LIMIT 1;

  IF row.id IS NULL THEN
    RETURN get_or_create_owner_session_with_product('audio');
  END IF;

  RETURN jsonb_build_object(
    'session_id', row.id,
    'access_code', row.access_code,
    'max_devices', row.max_devices,
    'max_mobile_devices', row.max_mobile_devices,
    'max_usb_devices', row.max_usb_devices,
    'plan_id', row.plan_id,
    'connection_mode', row.connection_mode,
    'realtime_channel', row.realtime_channel,
    'device_count', (SELECT count(*) FROM paired_devices pd WHERE pd.session_id = row.id),
    'product_type', row.product_type,
    'bridge_code', row.bridge_code
  );
END;
$$;

-- Helper: extend session creation for product type (simplified — reuses owner plan limits).
CREATE OR REPLACE FUNCTION get_or_create_owner_session_with_product(p_product text DEFAULT 'video')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  prof profiles%ROWTYPE;
  new_code text;
  new_row mixer_sessions%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO prof FROM profiles WHERE id = uid;

  new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  INSERT INTO mixer_sessions (
    owner_id, access_code, plan_id, connection_mode,
    max_devices, max_mobile_devices, max_usb_devices, product_type, is_active
  )
  VALUES (
    uid,
    new_code,
    prof.plan_id,
    (SELECT connection_mode FROM subscription_plans WHERE id = prof.plan_id),
    (SELECT max_total_channels FROM subscription_plans WHERE id = prof.plan_id),
    (SELECT max_mobile_devices FROM subscription_plans WHERE id = prof.plan_id),
    (SELECT max_usb_devices FROM subscription_plans WHERE id = prof.plan_id),
    coalesce(p_product, 'video'),
    true
  )
  RETURNING * INTO new_row;

  RETURN jsonb_build_object(
    'session_id', new_row.id,
    'access_code', new_row.access_code,
    'max_devices', new_row.max_devices,
    'max_mobile_devices', new_row.max_mobile_devices,
    'max_usb_devices', new_row.max_usb_devices,
    'plan_id', new_row.plan_id,
    'connection_mode', new_row.connection_mode,
    'realtime_channel', new_row.realtime_channel,
    'device_count', 0,
    'product_type', new_row.product_type,
    'bridge_code', new_row.bridge_code
  );
END;
$$;

CREATE OR REPLACE FUNCTION register_mixer_bridge(
  p_bridge_code text,
  p_audio_session_id uuid,
  p_audio_access_code text,
  p_audio_realtime_channel text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE mixer_sessions
  SET bridge_code = upper(trim(p_bridge_code))
  WHERE id = p_audio_session_id
    AND owner_id = auth.uid()
    AND product_type = 'audio';
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
    AND product_type = 'audio'
    AND is_active = true
  LIMIT 1;

  IF row.id IS NULL THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'audio_session_id', row.id,
    'audio_access_code', row.access_code,
    'audio_realtime_channel', row.realtime_channel,
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
  WHERE id = p_video_session_id AND owner_id = auth.uid() AND product_type = 'video';

  IF video_row.id IS NULL THEN RAISE EXCEPTION 'Video session not found'; END IF;

  SELECT * INTO audio_row
  FROM mixer_sessions
  WHERE bridge_code = upper(trim(p_bridge_code)) AND product_type = 'audio' AND is_active = true;

  IF audio_row.id IS NULL THEN RAISE EXCEPTION 'Bridge code not found'; END IF;

  UPDATE mixer_sessions SET linked_session_id = audio_row.id WHERE id = video_row.id;

  RETURN jsonb_build_object(
    'audio_session_id', audio_row.id,
    'audio_access_code', audio_row.access_code,
    'audio_realtime_channel', audio_row.realtime_channel,
    'bridge_code', audio_row.bridge_code
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_or_create_audio_owner_session() TO authenticated;
GRANT EXECUTE ON FUNCTION register_mixer_bridge(text, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_mixer_bridge(text) TO authenticated;
GRANT EXECUTE ON FUNCTION link_video_to_audio_bridge(uuid, text) TO authenticated;
