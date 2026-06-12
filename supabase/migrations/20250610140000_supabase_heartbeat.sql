-- Keeps the free-tier project active by recording lightweight periodic pings.
-- Called from the CloudCast app and optional external cron (npm run heartbeat).

CREATE TABLE IF NOT EXISTS public.system_heartbeat (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_ping_at timestamptz NOT NULL DEFAULT now(),
  last_source text NOT NULL DEFAULT 'unknown',
  ping_count bigint NOT NULL DEFAULT 0
);

ALTER TABLE public.system_heartbeat ENABLE ROW LEVEL SECURITY;

INSERT INTO public.system_heartbeat (id, last_ping_at, last_source, ping_count)
VALUES (1, now(), 'migration', 0)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.cloudcast_heartbeat(p_source text DEFAULT 'client')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_at timestamptz := now();
  v_count bigint;
BEGIN
  UPDATE public.system_heartbeat
  SET
    last_ping_at = v_at,
    last_source = COALESCE(NULLIF(trim(p_source), ''), 'client'),
    ping_count = ping_count + 1
  WHERE id = 1
  RETURNING ping_count INTO v_count;

  IF v_count IS NULL THEN
    INSERT INTO public.system_heartbeat (id, last_ping_at, last_source, ping_count)
    VALUES (1, v_at, COALESCE(NULLIF(trim(p_source), ''), 'client'), 1)
    RETURNING ping_count INTO v_count;
  END IF;

  PERFORM 1 FROM public.subscription_plans LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'at', v_at,
    'ping_count', v_count,
    'source', COALESCE(NULLIF(trim(p_source), ''), 'client')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cloudcast_heartbeat(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cloudcast_heartbeat(text) TO anon, authenticated, service_role;
