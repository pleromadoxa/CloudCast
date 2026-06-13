-- Email production: fix dispatch URL, app URL, dedupe plan-change triggers

UPDATE public.app_internal_settings
SET value = 'https://ixjydnkpnyxnckhkqhue.supabase.co/functions/v1', updated_at = now()
WHERE key = 'functions_base_url'
  AND value NOT LIKE '%/functions/v1';

UPDATE public.app_internal_settings
SET value = 'https://cloudcast.pleromadoxa.workers.dev', updated_at = now()
WHERE key = 'app_public_url';

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

  v_functions_url := rtrim(public.get_app_setting('functions_base_url'), '/');
  v_secret := public.get_app_setting('email_webhook_secret');

  IF v_functions_url IS NOT NULL AND v_secret IS NOT NULL THEN
    IF v_functions_url NOT LIKE '%/functions/v1' THEN
      v_functions_url := v_functions_url || '/functions/v1';
    END IF;

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

-- Plan changes are handled by maybe_enqueue_plan_emails (product-aware) + plan_grants trigger.
DROP TRIGGER IF EXISTS profiles_email_plan_change ON public.profiles;
