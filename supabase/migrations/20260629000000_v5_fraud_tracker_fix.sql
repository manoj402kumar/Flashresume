-- 1. Smart `increment_fraud_counter` RPC
CREATE OR REPLACE FUNCTION public.increment_fraud_counter(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_has_credits BOOLEAN;
BEGIN
    -- Check if user has active credits in credit_buckets
    SELECT EXISTS (
        SELECT 1 FROM public.credit_buckets
        WHERE user_id = p_user_id
          AND remaining_credits > 0
          AND status IN ('active', 'queued', 'fallback')
          AND (expires_at IS NULL OR expires_at > now())
    ) INTO v_has_credits;

    -- If no credits found in buckets, also check legacy subscriptions table just in case
    IF NOT v_has_credits THEN
        SELECT EXISTS (
            SELECT 1 FROM public.subscriptions
            WHERE user_id = p_user_id
              AND is_active = TRUE
              AND (expires_at IS NULL OR expires_at > now())
        ) INTO v_has_credits;
    END IF;

    -- Only increment if they DO NOT have any active credits/subscriptions
    IF NOT v_has_credits THEN
        UPDATE public.users
        SET fraud_tracker_counter = COALESCE(fraud_tracker_counter, 0) + 1
        WHERE id = p_user_id;
    END IF;
END;
$$;

-- 2. Trigger on resume_downloads to automatically reset the counter
CREATE OR REPLACE FUNCTION public.reset_fraud_on_download()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Guard against anonymous/guest downloads
    IF NEW.user_id IS NULL THEN
        RETURN NEW;
    END IF;

    UPDATE public.users 
    SET fraud_tracker_counter = 0 
    WHERE id = NEW.user_id;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_fraud_on_download ON public.resume_downloads;

CREATE TRIGGER trg_reset_fraud_on_download
AFTER INSERT ON public.resume_downloads
FOR EACH ROW
EXECUTE FUNCTION public.reset_fraud_on_download();

-- 3. One-time data sanitization to fix existing false positives
UPDATE public.users u
SET fraud_tracker_counter = 0
WHERE COALESCE(fraud_tracker_counter, 0) > 0
  AND (
    -- Condition A: User has successfully downloaded a resume in the past
    EXISTS (SELECT 1 FROM public.resume_downloads rd WHERE rd.user_id = u.id)
    
    -- Condition B: User currently has active bucket credits
    OR EXISTS (
        SELECT 1 FROM public.credit_buckets cb 
        WHERE cb.user_id = u.id 
          AND cb.remaining_credits > 0
          AND cb.status IN ('active', 'queued', 'fallback')
          AND (cb.expires_at IS NULL OR cb.expires_at > now())
    )
    
    -- Condition C: User currently has an active legacy subscription
    OR EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = u.id AND s.is_active = TRUE AND (s.expires_at IS NULL OR s.expires_at > now()))
  );
