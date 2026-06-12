-- Manual plan issuing, coupons, and platform broadcasting

CREATE TABLE IF NOT EXISTS public.plan_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id public.plan_tier NOT NULL REFERENCES public.subscription_plans(id),
  previous_plan_id public.plan_tier NOT NULL REFERENCES public.subscription_plans(id),
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plan_grants_user_idx ON public.plan_grants (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS plan_grants_active_idx ON public.plan_grants (user_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.plan_grants ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('plan_upgrade', 'percent_off', 'fixed_off')),
  plan_id public.plan_tier REFERENCES public.subscription_plans(id),
  percent_off int CHECK (percent_off IS NULL OR (percent_off > 0 AND percent_off <= 100)),
  amount_off_cents int CHECK (amount_off_cents IS NULL OR amount_off_cents >= 0),
  max_uses int CHECK (max_uses IS NULL OR max_uses > 0),
  use_count int NOT NULL DEFAULT 0,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coupons_code_unique UNIQUE (code),
  CONSTRAINT coupons_kind_plan_chk CHECK (
    kind <> 'plan_upgrade' OR plan_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS coupons_code_idx ON public.coupons (upper(code));
CREATE INDEX IF NOT EXISTS coupons_active_idx ON public.coupons (is_active, created_at DESC);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coupon_redemptions_unique UNIQUE (coupon_id, user_id)
);

CREATE INDEX IF NOT EXISTS coupon_redemptions_user_idx ON public.coupon_redemptions (user_id, redeemed_at DESC);

ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.platform_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'promo')),
  link_url text,
  link_label text,
  target_plan text NOT NULL DEFAULT 'all' CHECK (target_plan IN ('all', 'free', 'pro', 'pro_master')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_broadcasts_active_idx
  ON public.platform_broadcasts (is_active, starts_at DESC);

ALTER TABLE public.platform_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.sync_expired_plan_grants(p_user_id uuid DEFAULT auth.uid())
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grant record;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  FOR v_grant IN
    SELECT id, user_id, previous_plan_id
    FROM public.plan_grants
    WHERE user_id = p_user_id
      AND revoked_at IS NULL
      AND expires_at IS NOT NULL
      AND expires_at <= now()
  LOOP
    UPDATE public.plan_grants SET revoked_at = now() WHERE id = v_grant.id;
    UPDATE public.profiles
      SET plan_id = v_grant.previous_plan_id, updated_at = now()
      WHERE id = v_grant.user_id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_issue_plan(
  p_email text,
  p_plan_id text,
  p_reason text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_old_plan text;
  v_grant_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE id = p_plan_id::public.plan_tier) THEN
    RAISE EXCEPTION 'Unknown plan: %', p_plan_id;
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found with email: %', p_email;
  END IF;

  SELECT plan_id INTO v_old_plan FROM public.profiles WHERE id = v_user_id;
  IF v_old_plan IS NULL THEN
    RAISE EXCEPTION 'Profile not found for user';
  END IF;

  UPDATE public.profiles SET plan_id = p_plan_id::public.plan_tier, updated_at = now() WHERE id = v_user_id;

  INSERT INTO public.plan_grants (user_id, plan_id, previous_plan_id, issued_by, reason, expires_at)
  VALUES (v_user_id, p_plan_id::public.plan_tier, v_old_plan::public.plan_tier, auth.uid(), nullif(trim(p_reason), ''), p_expires_at)
  RETURNING id INTO v_grant_id;

  PERFORM public.log_activity(
    'admin.plan.issue',
    'plan_grant',
    v_grant_id::text,
    jsonb_build_object('user_id', v_user_id, 'email', p_email, 'from', v_old_plan, 'to', p_plan_id, 'expires_at', p_expires_at)
  );

  RETURN jsonb_build_object(
    'grant_id', v_grant_id,
    'user_id', v_user_id,
    'email', p_email,
    'previous_plan_id', v_old_plan,
    'plan_id', p_plan_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_plan_grants(
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
    'total', (SELECT count(*) FROM public.plan_grants),
    'grants', COALESCE(
      (
        SELECT jsonb_agg(row_to_json(g) ORDER BY g.created_at DESC)
        FROM (
          SELECT
            pg.id,
            pg.user_id,
            u.email AS user_email,
            p.full_name AS user_name,
            pg.plan_id,
            sp.name AS plan_name,
            pg.previous_plan_id,
            pg.reason,
            pg.expires_at,
            pg.revoked_at,
            pg.created_at,
            ib.email AS issued_by_email
          FROM public.plan_grants pg
          JOIN auth.users u ON u.id = pg.user_id
          LEFT JOIN public.profiles p ON p.id = pg.user_id
          LEFT JOIN public.subscription_plans sp ON sp.id = pg.plan_id
          LEFT JOIN auth.users ib ON ib.id = pg.issued_by
          ORDER BY pg.created_at DESC
          LIMIT p_limit OFFSET p_offset
        ) g
      ),
      '[]'::jsonb
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_plan_grant(p_grant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grant public.plan_grants%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_grant FROM public.plan_grants WHERE id = p_grant_id;
  IF v_grant.id IS NULL THEN
    RAISE EXCEPTION 'Grant not found';
  END IF;

  IF v_grant.revoked_at IS NOT NULL THEN
    RETURN;
  END IF;

  UPDATE public.plan_grants SET revoked_at = now() WHERE id = p_grant_id;
  UPDATE public.profiles
    SET plan_id = v_grant.previous_plan_id, updated_at = now()
    WHERE id = v_grant.user_id;

  PERFORM public.log_activity(
    'admin.plan.revoke',
    'plan_grant',
    p_grant_id::text,
    jsonb_build_object('user_id', v_grant.user_id, 'reverted_to', v_grant.previous_plan_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_coupon(
  p_code text,
  p_kind text,
  p_plan_id text DEFAULT NULL,
  p_percent_off int DEFAULT NULL,
  p_amount_off_cents int DEFAULT NULL,
  p_max_uses int DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.coupons
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.coupons;
  v_code text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  v_code := upper(trim(p_code));
  IF length(v_code) < 3 THEN
    RAISE EXCEPTION 'Coupon code must be at least 3 characters';
  END IF;

  IF p_kind = 'plan_upgrade' AND p_plan_id IS NULL THEN
    RAISE EXCEPTION 'plan_id required for plan_upgrade coupons';
  END IF;

  INSERT INTO public.coupons (
    code, kind, plan_id, percent_off, amount_off_cents, max_uses, expires_at, notes, created_by
  )
  VALUES (
    v_code,
    p_kind,
    p_plan_id::public.plan_tier,
    p_percent_off,
    p_amount_off_cents,
    p_max_uses,
    p_expires_at,
    nullif(trim(p_notes), ''),
    auth.uid()
  )
  RETURNING * INTO v_row;

  PERFORM public.log_activity(
    'admin.coupon.create',
    'coupon',
    v_row.id::text,
    jsonb_build_object('code', v_row.code, 'kind', v_row.kind)
  );

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_coupons()
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

  RETURN COALESCE(
    (
      SELECT jsonb_agg(row_to_json(c) ORDER BY c.created_at DESC)
      FROM (
        SELECT
          c.id,
          c.code,
          c.kind,
          c.plan_id,
          sp.name AS plan_name,
          c.percent_off,
          c.amount_off_cents,
          c.max_uses,
          c.use_count,
          c.expires_at,
          c.is_active,
          c.notes,
          c.created_at,
          cb.email AS created_by_email
        FROM public.coupons c
        LEFT JOIN public.subscription_plans sp ON sp.id = c.plan_id
        LEFT JOIN auth.users cb ON cb.id = c.created_by
        ORDER BY c.created_at DESC
      ) c
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_deactivate_coupon(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE public.coupons SET is_active = false WHERE id = p_id;

  PERFORM public.log_activity('admin.coupon.deactivate', 'coupon', p_id::text, '{}'::jsonb);
END;
$$;

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

  RETURN jsonb_build_object(
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
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_all_stream_destinations(
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_search text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  v_search := nullif(trim(p_search), '');

  RETURN jsonb_build_object(
    'total', (
      SELECT count(*)
      FROM public.stream_destinations sd
      JOIN auth.users u ON u.id = sd.user_id
      LEFT JOIN public.profiles p ON p.id = sd.user_id
      WHERE v_search IS NULL
        OR sd.name ILIKE '%' || v_search || '%'
        OR sd.platform ILIKE '%' || v_search || '%'
        OR u.email ILIKE '%' || v_search || '%'
        OR coalesce(p.full_name, '') ILIKE '%' || v_search || '%'
    ),
    'destinations', COALESCE(
      (
        SELECT jsonb_agg(row_to_json(d) ORDER BY d.created_at DESC)
        FROM (
          SELECT
            sd.id,
            sd.user_id,
            u.email AS user_email,
            p.full_name AS user_name,
            sd.name,
            sd.platform,
            sd.stream_url,
            left(sd.stream_key, 4) || '••••' AS stream_key_masked,
            sd.is_enabled,
            sd.sort_order,
            sd.created_at,
            sd.updated_at
          FROM public.stream_destinations sd
          JOIN auth.users u ON u.id = sd.user_id
          LEFT JOIN public.profiles p ON p.id = sd.user_id
          WHERE v_search IS NULL
            OR sd.name ILIKE '%' || v_search || '%'
            OR sd.platform ILIKE '%' || v_search || '%'
            OR u.email ILIKE '%' || v_search || '%'
            OR coalesce(p.full_name, '') ILIKE '%' || v_search || '%'
          ORDER BY sd.created_at DESC
          LIMIT p_limit OFFSET p_offset
        ) d
      ),
      '[]'::jsonb
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_broadcast(
  p_title text,
  p_message text,
  p_severity text DEFAULT 'info',
  p_link_url text DEFAULT NULL,
  p_link_label text DEFAULT NULL,
  p_target_plan text DEFAULT 'all',
  p_starts_at timestamptz DEFAULT now(),
  p_ends_at timestamptz DEFAULT NULL
)
RETURNS public.platform_broadcasts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.platform_broadcasts;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  INSERT INTO public.platform_broadcasts (
    title, message, severity, link_url, link_label, target_plan, starts_at, ends_at, created_by
  )
  VALUES (
    trim(p_title),
    trim(p_message),
    coalesce(p_severity, 'info'),
    nullif(trim(p_link_url), ''),
    nullif(trim(p_link_label), ''),
    coalesce(p_target_plan, 'all'),
    coalesce(p_starts_at, now()),
    p_ends_at,
    auth.uid()
  )
  RETURNING * INTO v_row;

  PERFORM public.log_activity(
    'admin.broadcast.create',
    'platform_broadcast',
    v_row.id::text,
    jsonb_build_object('title', v_row.title, 'target_plan', v_row.target_plan)
  );

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_broadcasts()
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

  RETURN COALESCE(
    (
      SELECT jsonb_agg(row_to_json(b) ORDER BY b.created_at DESC)
      FROM (
        SELECT
          pb.id,
          pb.title,
          pb.message,
          pb.severity,
          pb.link_url,
          pb.link_label,
          pb.target_plan,
          pb.starts_at,
          pb.ends_at,
          pb.is_active,
          pb.created_at,
          cb.email AS created_by_email
        FROM public.platform_broadcasts pb
        LEFT JOIN auth.users cb ON cb.id = pb.created_by
        ORDER BY pb.created_at DESC
      ) b
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_deactivate_broadcast(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE public.platform_broadcasts SET is_active = false WHERE id = p_id;

  PERFORM public.log_activity('admin.broadcast.deactivate', 'platform_broadcast', p_id::text, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_active_broadcasts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    PERFORM public.sync_expired_plan_grants(auth.uid());
    SELECT plan_id INTO v_plan FROM public.profiles WHERE id = auth.uid();
  ELSE
    v_plan := 'free';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(row_to_json(b) ORDER BY b.starts_at DESC)
      FROM (
        SELECT id, title, message, severity, link_url, link_label, target_plan, starts_at, ends_at
        FROM public.platform_broadcasts
        WHERE is_active = true
          AND starts_at <= now()
          AND (ends_at IS NULL OR ends_at > now())
          AND (target_plan = 'all' OR target_plan = coalesce(v_plan, 'free'))
        ORDER BY starts_at DESC
        LIMIT 5
      ) b
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_expired_plan_grants(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_issue_plan(text, text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_plan_grants(int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_plan_grant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_coupon(text, text, text, int, int, int, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_coupons() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_deactivate_coupon(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_coupon(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_all_stream_destinations(int, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_broadcast(text, text, text, text, text, text, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_broadcasts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_deactivate_broadcast(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_broadcasts() TO anon, authenticated;
