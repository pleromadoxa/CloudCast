-- Transactional email queue, storage alerts, manual admin by email, dispatch hooks

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email_to text NOT NULL,
  template text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS email_queue_status_created_idx
  ON public.email_queue (status, created_at);

ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.storage_alert_sent (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  threshold int NOT NULL CHECK (threshold IN (50, 75, 90, 100)),
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, threshold)
);

ALTER TABLE public.storage_alert_sent ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.app_internal_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_internal_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_internal_settings (key, value)
VALUES
  ('functions_base_url', 'https://ixjydnkpnyxnckhkqhue.supabase.co/functions/v1'),
  ('email_webhook_secret', encode(extensions.gen_random_bytes(32), 'hex')),
  ('app_public_url', 'https://cloudcast.regal')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_app_setting(p_key text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM public.app_internal_settings WHERE key = p_key;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_transactional_email(
  p_user_id uuid,
  p_template text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_queue_id uuid;
  v_functions_url text;
  v_secret text;
BEGIN
  IF p_user_id IS NOT NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  END IF;

  v_email := COALESCE(v_email, p_payload->>'email');
  IF v_email IS NULL OR trim(v_email) = '' THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.email_queue (user_id, email_to, template, payload)
  VALUES (p_user_id, trim(v_email), p_template, COALESCE(p_payload, '{}'::jsonb))
  RETURNING id INTO v_queue_id;

  v_functions_url := public.get_app_setting('functions_base_url');
  v_secret := public.get_app_setting('email_webhook_secret');

  IF v_functions_url IS NOT NULL AND v_secret IS NOT NULL THEN
    PERFORM net.http_post(
      url := v_functions_url || '/send-transactional-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-email-webhook-secret', v_secret
      ),
      body := jsonb_build_object('queue_id', v_queue_id::text)
    );
  END IF;

  RETURN v_queue_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_storage_email_alerts(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used bigint;
  v_quota bigint;
  v_pct int;
  v_threshold int;
  v_template text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(size_bytes), 0)
  INTO v_used
  FROM public.mixer_recordings
  WHERE user_id = p_user_id;

  SELECT CASE p.plan_id
    WHEN 'pro' THEN 50::bigint * 1024 * 1024 * 1024
    WHEN 'pro_master' THEN 100::bigint * 1024 * 1024 * 1024
    ELSE 0::bigint
  END
  INTO v_quota
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF v_quota IS NULL OR v_quota <= 0 THEN
    RETURN;
  END IF;

  v_pct := floor((v_used::numeric / v_quota::numeric) * 100)::int;

  IF v_pct < 50 THEN
    DELETE FROM public.storage_alert_sent
    WHERE user_id = p_user_id AND threshold > v_pct;
    RETURN;
  END IF;

  FOR v_threshold, v_template IN
    SELECT * FROM (VALUES
      (100, 'storage_full'),
      (90, 'storage_warning_90'),
      (75, 'storage_warning_75'),
      (50, 'storage_warning_50')
    ) AS t(threshold, template)
    WHERE v_pct >= t.threshold
    ORDER BY t.threshold DESC
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.storage_alert_sent
      WHERE user_id = p_user_id AND threshold = v_threshold
    ) THEN
      INSERT INTO public.storage_alert_sent (user_id, threshold)
      VALUES (p_user_id, v_threshold)
      ON CONFLICT DO NOTHING;

      PERFORM public.enqueue_transactional_email(
        p_user_id,
        v_template,
        jsonb_build_object(
          'used_bytes', v_used,
          'quota_bytes', v_quota,
          'percent_used', v_pct
        )
      );
    END IF;
    EXIT;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_email_profile_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enqueue_transactional_email(
    NEW.id,
    'signup_welcome',
    jsonb_build_object('full_name', NEW.full_name, 'plan_id', NEW.plan_id)
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_email_profile_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.plan_id IS DISTINCT FROM NEW.plan_id THEN
    PERFORM public.enqueue_transactional_email(
      NEW.id,
      'plan_changed',
      jsonb_build_object('from_plan', OLD.plan_id, 'to_plan', NEW.plan_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_email_recording_storage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.check_storage_email_alerts(NEW.user_id);
    PERFORM public.enqueue_transactional_email(
      NEW.user_id,
      'recording_uploaded',
      jsonb_build_object(
        'file_name', NEW.file_name,
        'size_bytes', NEW.size_bytes
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.check_storage_email_alerts(OLD.user_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_email_admin_granted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NULL) THEN
    PERFORM public.enqueue_transactional_email(
      NEW.user_id,
      'admin_access_granted',
      jsonb_build_object('role', NEW.role)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_email_plan_grant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.revoked_at IS NULL THEN
    PERFORM public.enqueue_transactional_email(
      NEW.user_id,
      'plan_grant_issued',
      jsonb_build_object(
        'plan_id', NEW.plan_id,
        'reason', NEW.reason,
        'expires_at', NEW.expires_at
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_email_welcome ON public.profiles;
CREATE TRIGGER profiles_email_welcome
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_email_profile_created();

DROP TRIGGER IF EXISTS profiles_email_plan_change ON public.profiles;
CREATE TRIGGER profiles_email_plan_change
  AFTER UPDATE OF plan_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_email_profile_plan_change();

DROP TRIGGER IF EXISTS mixer_recordings_email_storage ON public.mixer_recordings;
CREATE TRIGGER mixer_recordings_email_storage
  AFTER INSERT OR DELETE ON public.mixer_recordings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_email_recording_storage();

DROP TRIGGER IF EXISTS admin_users_email_granted ON public.admin_users;
CREATE TRIGGER admin_users_email_granted
  AFTER INSERT OR UPDATE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_email_admin_granted();

DROP TRIGGER IF EXISTS plan_grants_email_issued ON public.plan_grants;
CREATE TRIGGER plan_grants_email_issued
  AFTER INSERT ON public.plan_grants
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_email_plan_grant();

CREATE OR REPLACE FUNCTION public.admin_grant_role_by_email(
  p_email text,
  p_role text DEFAULT 'admin'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Super admin access required';
  END IF;

  IF p_role NOT IN ('admin', 'super_admin', 'support') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found with email: %', p_email;
  END IF;

  PERFORM public.admin_grant_role(v_user_id, p_role);

  RETURN jsonb_build_object('user_id', v_user_id, 'email', p_email, 'role', p_role);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_email_queue(
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
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
    'total', (SELECT count(*) FROM public.email_queue),
    'items', COALESCE(
      (
        SELECT jsonb_agg(row_to_json(e) ORDER BY e.created_at DESC)
        FROM (
          SELECT id, user_id, email_to, template, status, attempts, last_error, created_at, sent_at
          FROM public.email_queue
          ORDER BY created_at DESC
          LIMIT p_limit OFFSET p_offset
        ) e
      ),
      '[]'::jsonb
    )
  );
END;
$$;

-- Enqueue coupon redemption email from redeem_coupon
CREATE OR REPLACE FUNCTION public.redeem_coupon(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon public.coupons%ROWTYPE;
  v_user_id uuid;
  v_old_plan text;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to redeem a coupon';
  END IF;

  v_user_id := auth.uid();
  PERFORM public.sync_expired_plan_grants(v_user_id);

  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE upper(code) = upper(trim(p_code))
  FOR UPDATE;

  IF v_coupon.id IS NULL THEN
    RAISE EXCEPTION 'Invalid coupon code';
  END IF;

  IF NOT v_coupon.is_active THEN
    RAISE EXCEPTION 'This coupon is no longer active';
  END IF;

  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at <= now() THEN
    RAISE EXCEPTION 'This coupon has expired';
  END IF;

  IF v_coupon.max_uses IS NOT NULL AND v_coupon.use_count >= v_coupon.max_uses THEN
    RAISE EXCEPTION 'This coupon has reached its usage limit';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.coupon_redemptions
    WHERE coupon_id = v_coupon.id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'You have already redeemed this coupon';
  END IF;

  IF v_coupon.kind = 'plan_upgrade' THEN
    SELECT plan_id INTO v_old_plan FROM public.profiles WHERE id = v_user_id;
    UPDATE public.profiles SET plan_id = v_coupon.plan_id::public.plan_tier, updated_at = now() WHERE id = v_user_id;

    INSERT INTO public.plan_grants (user_id, plan_id, previous_plan_id, issued_by, reason)
    VALUES (v_user_id, v_coupon.plan_id, v_old_plan::public.plan_tier, NULL, 'Coupon: ' || v_coupon.code);
  END IF;

  UPDATE public.coupons SET use_count = use_count + 1 WHERE id = v_coupon.id;

  INSERT INTO public.coupon_redemptions (coupon_id, user_id, metadata)
  VALUES (
    v_coupon.id,
    v_user_id,
    jsonb_build_object('kind', v_coupon.kind, 'plan_id', v_coupon.plan_id)
  );

  PERFORM public.log_activity(
    'coupon.redeem',
    'coupon',
    v_coupon.id::text,
    jsonb_build_object('code', v_coupon.code, 'kind', v_coupon.kind)
  );

  v_result := jsonb_build_object(
    'code', v_coupon.code,
    'kind', v_coupon.kind,
    'plan_id', v_coupon.plan_id,
    'percent_off', v_coupon.percent_off,
    'amount_off_cents', v_coupon.amount_off_cents,
    'message', CASE
      WHEN v_coupon.kind = 'plan_upgrade' THEN 'Plan upgraded successfully!'
      WHEN v_coupon.kind = 'percent_off' THEN format('%s%% discount saved for checkout', v_coupon.percent_off)
      ELSE format('$%s discount saved for checkout', round(v_coupon.amount_off_cents / 100.0, 2))
    END
  );

  PERFORM public.enqueue_transactional_email(
    v_user_id,
    'coupon_redeemed',
    jsonb_build_object('code', v_coupon.code, 'kind', v_coupon.kind, 'plan_id', v_coupon.plan_id)
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_transactional_email(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_role_by_email(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_email_queue(int, int) TO authenticated;
