-- Audio mixer sessions previously had max_usb_devices = 0, which blocked pairing
-- USB microphones and audio interfaces from CloudCast Mobile ("Failed to add audio input").

CREATE OR REPLACE FUNCTION resolve_session_max_usb(
  p_plan_id plan_tier,
  p_product text
)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_product, 'video') = 'audio' THEN
      CASE p_plan_id
        WHEN 'free'::plan_tier THEN 2
        WHEN 'pro'::plan_tier THEN 4
        ELSE 8
      END
    ELSE COALESCE(
      (SELECT max_usb_devices FROM subscription_plans WHERE id = p_plan_id),
      0
    )
  END;
$$;

-- Refresh existing audio mixer sessions so mobile pairing accepts USB devices immediately.
UPDATE mixer_sessions ms
SET max_usb_devices = resolve_session_max_usb(ms.plan_id, coalesce(ms.product_type, 'video'))
WHERE coalesce(ms.product_type, 'video') = 'audio';
