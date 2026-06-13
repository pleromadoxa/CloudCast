-- Bridge codes live on the shared owner session (product_type = 'video'), not a separate audio session.

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
    AND is_active = true;
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
    'audio_realtime_channel', audio_row.realtime_channel,
    'bridge_code', audio_row.bridge_code
  );
END;
$$;

GRANT EXECUTE ON FUNCTION register_mixer_bridge(text, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_mixer_bridge(text) TO authenticated;
GRANT EXECUTE ON FUNCTION link_video_to_audio_bridge(uuid, text) TO authenticated;
