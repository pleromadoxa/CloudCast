-- Temporary: Regal Cloud WHIP/WHEP handshake is not production-ready — all sessions use Regal Mesh.

CREATE OR REPLACE FUNCTION resolve_session_connection_mode(
  p_plan_id plan_tier,
  p_product text
)
RETURNS connection_mode
LANGUAGE sql
STABLE
AS $$
  SELECT 'mesh'::connection_mode;
$$;

UPDATE mixer_sessions
SET connection_mode = 'mesh'::connection_mode, updated_at = now()
WHERE is_active = true
  AND connection_mode IS DISTINCT FROM 'mesh'::connection_mode;

UPDATE subscription_plans
SET connection_mode = 'mesh'::connection_mode
WHERE connection_mode IS DISTINCT FROM 'mesh'::connection_mode;
