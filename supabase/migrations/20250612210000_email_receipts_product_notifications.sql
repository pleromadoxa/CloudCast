-- Payment receipts, product plan change emails, replay clip notifications, combined storage alerts

CREATE OR REPLACE FUNCTION public.plan_price_cents(p_plan plan_tier)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_plan
    WHEN 'pro'::plan_tier THEN 2900
    WHEN 'pro_master'::plan_tier THEN 7900
    WHEN 'universal'::plan_tier THEN 11900
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.maybe_enqueue_plan_emails(
  p_user_id uuid,
  p_product text,
  p_from_plan plan_tier,
  p_to_plan plan_tier
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount int;
  v_receipt_id text;
BEGIN
  IF p_user_id IS NULL OR p_from_plan IS NOT DISTINCT FROM p_to_plan THEN
    RETURN;
  END IF;

  PERFORM public.enqueue_transactional_email(
    p_user_id,
    'plan_changed',
    jsonb_build_object(
      'product', p_product,
      'from_plan', p_from_plan,
      'to_plan', p_to_plan
    )
  );

  v_amount := public.plan_price_cents(p_to_plan);
  IF v_amount > 0 AND p_to_plan IN ('pro'::plan_tier, 'pro_master'::plan_tier, 'universal'::plan_tier) THEN
    v_receipt_id := 'CC-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    PERFORM public.enqueue_transactional_email(
      p_user_id,
      'payment_receipt',
      jsonb_build_object(
        'product', p_product,
        'plan_id', p_to_plan,
        'amount_cents', v_amount,
        'currency', 'USD',
        'billing_interval', 'Monthly',
        'receipt_id', v_receipt_id,
        'paid_at', now(),
        'period_end', now() + interval '30 days',
        'support_email', 'support@cloudcast.regal'
      )
    );
  END IF;
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
  FROM (
    SELECT size_bytes FROM public.mixer_recordings WHERE user_id = p_user_id
    UNION ALL
    SELECT size_bytes FROM public.replay_clips WHERE user_id = p_user_id
  ) combined;

  SELECT COALESCE(
    CASE
      WHEN p.plan_id = 'universal'::plan_tier THEN 100::bigint * 1024 * 1024 * 1024
      WHEN GREATEST(
        CASE COALESCE(p.video_plan_id, p.plan_id) WHEN 'pro_master' THEN 3 WHEN 'pro' THEN 2 WHEN 'universal' THEN 3 ELSE 0 END,
        CASE COALESCE(p.replay_plan_id, p.plan_id) WHEN 'pro_master' THEN 3 WHEN 'pro' THEN 2 WHEN 'universal' THEN 3 ELSE 0 END
      ) >= 3 THEN 100::bigint * 1024 * 1024 * 1024
      WHEN GREATEST(
        CASE COALESCE(p.video_plan_id, p.plan_id) WHEN 'pro_master' THEN 3 WHEN 'pro' THEN 2 ELSE 0 END,
        CASE COALESCE(p.replay_plan_id, p.plan_id) WHEN 'pro_master' THEN 3 WHEN 'pro' THEN 2 ELSE 0 END
      ) >= 2 THEN 50::bigint * 1024 * 1024 * 1024
      ELSE 0::bigint
    END,
    0::bigint
  )
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

CREATE OR REPLACE FUNCTION public.trg_email_replay_clip_storage()
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
      'replay_clip_uploaded',
      jsonb_build_object(
        'label', NEW.label,
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

DROP TRIGGER IF EXISTS replay_clips_email_storage ON public.replay_clips;
CREATE TRIGGER replay_clips_email_storage
  AFTER INSERT OR DELETE ON public.replay_clips
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_email_replay_clip_storage();

CREATE OR REPLACE FUNCTION public.update_user_product_plan(
  p_product text,
  p_plan_id plan_tier
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_old plan_tier;
  v_effective_product text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_plan_id NOT IN ('free', 'pro', 'pro_master', 'universal') THEN
    RAISE EXCEPTION 'Invalid plan';
  END IF;

  IF p_product = 'universal' OR p_plan_id = 'universal' THEN
    SELECT plan_id INTO v_old FROM public.profiles WHERE id = uid;
    UPDATE public.profiles
    SET
      plan_id = 'universal',
      video_plan_id = 'pro_master',
      audio_plan_id = 'pro_master',
      symphony_plan_id = 'pro_master',
      replay_plan_id = 'pro_master',
      updated_at = now()
    WHERE id = uid;
    PERFORM public.maybe_enqueue_plan_emails(uid, 'universal', COALESCE(v_old, 'free'::plan_tier), 'universal'::plan_tier);
    RETURN;
  END IF;

  v_effective_product := CASE WHEN p_product = 'instant_replay' THEN 'video_mixer' ELSE p_product END;

  IF v_effective_product = 'video_mixer' THEN
    SELECT COALESCE(video_plan_id, plan_id, 'free'::plan_tier) INTO v_old FROM public.profiles WHERE id = uid;
    UPDATE public.profiles
    SET
      plan_id = p_plan_id,
      video_plan_id = p_plan_id,
      replay_plan_id = p_plan_id,
      updated_at = now()
    WHERE id = uid;
    PERFORM public.maybe_enqueue_plan_emails(uid, 'video_mixer', v_old, p_plan_id);
    RETURN;
  END IF;

  IF v_effective_product = 'audio_mixer' THEN
    SELECT COALESCE(audio_plan_id, plan_id, 'free'::plan_tier) INTO v_old FROM public.profiles WHERE id = uid;
    UPDATE public.profiles
    SET audio_plan_id = p_plan_id, updated_at = now()
    WHERE id = uid;
    PERFORM public.maybe_enqueue_plan_emails(uid, 'audio_mixer', v_old, p_plan_id);
    RETURN;
  END IF;

  IF v_effective_product = 'symphony_studio' THEN
    SELECT COALESCE(symphony_plan_id, plan_id, 'free'::plan_tier) INTO v_old FROM public.profiles WHERE id = uid;
    UPDATE public.profiles
    SET symphony_plan_id = p_plan_id, updated_at = now()
    WHERE id = uid;
    PERFORM public.maybe_enqueue_plan_emails(uid, 'symphony_studio', v_old, p_plan_id);
    RETURN;
  END IF;

  RAISE EXCEPTION 'Unknown product: %', p_product;
END;
$$;

GRANT EXECUTE ON FUNCTION public.plan_price_cents(plan_tier) TO authenticated;
GRANT EXECUTE ON FUNCTION public.maybe_enqueue_plan_emails(uuid, text, plan_tier, plan_tier) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_product_plan(text, plan_tier) TO authenticated;
