-- Dashboard preferences repair + service-switch behavior fix.
--
-- Reported bug: the admin Services switch turns a product ON in
-- platform_product_services, but the product stays locked ("ENABLE IN SETUP")
-- and the setup toggle does nothing.
--
-- Root cause: product access requires BOTH the platform service flag and a
-- per-user dashboard preference, and Prism/Replay preferences defaulted to
-- OFF for every account — so enabling a service never resumed access. The
-- preferences pipeline is also hardened here so it cannot fail silently.
--
-- Behavior from here on (matches the admin expectations):
--   * admin switch ON  -> entitled accounts get the product (prefers resume),
--   * admin switch OFF -> product is off for everyone,
--   * users can still hide individual dashboards from Video Mixer Setup.
--
-- Fully idempotent: safe whether or not 20260716120000 ever applied.

-- ---------------------------------------------------------------------------
-- 1. Preference columns: exist, and default ON (opt-out, not opt-in)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS audio_dashboard_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS prism_dashboard_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS replay_dashboard_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles ALTER COLUMN audio_dashboard_enabled SET DEFAULT true;
ALTER TABLE public.profiles ALTER COLUMN prism_dashboard_enabled SET DEFAULT true;
ALTER TABLE public.profiles ALTER COLUMN replay_dashboard_enabled SET DEFAULT true;

-- ---------------------------------------------------------------------------
-- 2. Backfill: the old opt-in defaults left every account on OFF for
--    Prism/Replay and the toggle could not be exercised reliably. Re-enable
--    for all accounts so "turn the service on -> it resumes" always holds.
--    Accounts can opt out again from Video Mixer Setup.
-- ---------------------------------------------------------------------------
UPDATE public.profiles SET
  audio_dashboard_enabled = true,
  prism_dashboard_enabled = true,
  replay_dashboard_enabled = true;

COMMENT ON COLUMN public.profiles.audio_dashboard_enabled IS
  'When false, Audio Mixer dashboard is hidden and blocked for this account.';
COMMENT ON COLUMN public.profiles.prism_dashboard_enabled IS
  'When false, Regal Prism dashboard is hidden and blocked for this account.';
COMMENT ON COLUMN public.profiles.replay_dashboard_enabled IS
  'When false, Instant Replay dashboard is hidden and blocked for this account.';

-- ---------------------------------------------------------------------------
-- 3. Profile read RPC — always returns the preference keys (defaults ON)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
  v_plan public.subscription_plans;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = v_profile.plan_id;

  RETURN jsonb_build_object(
    'id', v_profile.id,
    'email', v_profile.email,
    'full_name', v_profile.full_name,
    'plan_id', v_profile.plan_id,
    'plan', to_jsonb(v_plan),
    'video_plan_id', v_profile.video_plan_id,
    'audio_plan_id', v_profile.audio_plan_id,
    'symphony_plan_id', v_profile.symphony_plan_id,
    'replay_plan_id', v_profile.replay_plan_id,
    'prism_plan_id', v_profile.prism_plan_id,
    'is_universal', public.is_universal_bundle(v_profile.plan_id),
    'audio_dashboard_enabled', COALESCE(v_profile.audio_dashboard_enabled, true),
    'prism_dashboard_enabled', COALESCE(v_profile.prism_dashboard_enabled, true),
    'replay_dashboard_enabled', COALESCE(v_profile.replay_dashboard_enabled, true)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Preference write RPC — the only write path (profiles DML is revoked)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_user_dashboard_preferences(
  p_audio_dashboard_enabled boolean DEFAULT NULL,
  p_prism_dashboard_enabled boolean DEFAULT NULL,
  p_replay_dashboard_enabled boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.profiles
  SET
    audio_dashboard_enabled = COALESCE(p_audio_dashboard_enabled, audio_dashboard_enabled),
    prism_dashboard_enabled = COALESCE(p_prism_dashboard_enabled, prism_dashboard_enabled),
    replay_dashboard_enabled = COALESCE(p_replay_dashboard_enabled, replay_dashboard_enabled),
    updated_at = now()
  WHERE id = auth.uid()
  RETURNING * INTO v_profile;

  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  RETURN jsonb_build_object(
    'audio_dashboard_enabled', v_profile.audio_dashboard_enabled,
    'prism_dashboard_enabled', v_profile.prism_dashboard_enabled,
    'replay_dashboard_enabled', v_profile.replay_dashboard_enabled
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_user_dashboard_preferences(boolean, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_user_dashboard_preferences(boolean, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_dashboard_preferences(boolean, boolean, boolean) TO service_role;

-- get_user_profile is invoked by every authenticated session.
REVOKE ALL ON FUNCTION public.get_user_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_profile() TO service_role;
