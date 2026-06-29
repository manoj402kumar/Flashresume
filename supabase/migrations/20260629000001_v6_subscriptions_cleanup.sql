-- 1. Fix Orphaned User (Manual Grant)
-- This user paid for a student plan but encountered a partial failure in the backend
-- before their credit bucket was created.
SELECT add_credit_bucket(
    '069a6498-4ffe-42ca-8ee8-62e654a19cef'::uuid,  -- user_id
    'student',     -- plan_type
    300,           -- p_amount
    90,            -- validity_days
    'pay_T2cd8zYH13izkp'  -- payment_id (idempotency key)
);

-- Ensure their legacy subscription record reflects this as well
-- First, deactivate any existing subscriptions for this user
UPDATE public.subscriptions 
SET is_active = FALSE 
WHERE user_id = '069a6498-4ffe-42ca-8ee8-62e654a19cef';

-- Then insert the new subscription record
INSERT INTO public.subscriptions (user_id, plan_type, is_active, credits_granted, expires_at, student_claimed)
VALUES (
    '069a6498-4ffe-42ca-8ee8-62e654a19cef',
    'student', 
    TRUE, 
    300,
    NOW() + INTERVAL '90 days',
    TRUE
);

-- 2. Cleanup Expired Subscriptions
-- Set is_active = FALSE for all subscriptions that have passed their expiration date
UPDATE public.subscriptions
SET is_active = FALSE
WHERE is_active = TRUE
  AND expires_at IS NOT NULL
  AND expires_at < NOW();

-- NOTE: To prevent this from drifting again in the future, consider using pg_cron 
-- or ensuring that any logic checking `is_active` also checks `expires_at > NOW()`.

-- 3. Redefine deduct_credits_v2 to check expires_at
CREATE OR REPLACE FUNCTION public.deduct_credits_v2(
  p_user_id UUID,
  p_amount INTEGER
) RETURNS TABLE(success BOOLEAN, new_balance INTEGER) AS $body
DECLARE
  v_remaining_cost INTEGER := p_amount;
  v_bucket RECORD;
  v_total_remaining INTEGER := 0;
BEGIN
  -- Check total available credits (now with expires_at check)
  SELECT SUM(remaining_credits) INTO v_total_remaining
  FROM public.credit_buckets
  WHERE user_id = p_user_id 
    AND status IN ('active', 'queued', 'fallback') 
    AND remaining_credits > 0
    AND (expires_at IS NULL OR expires_at > now());
  
  IF v_total_remaining IS NULL OR v_total_remaining < p_amount THEN
    RETURN QUERY SELECT FALSE, COALESCE(v_total_remaining, 0);
    RETURN;
  END IF;

  -- Deduct from oldest active buckets first
  FOR v_bucket IN 
    SELECT id, remaining_credits 
    FROM public.credit_buckets 
    WHERE user_id = p_user_id 
      AND status IN ('active', 'queued', 'fallback') 
      AND remaining_credits > 0
      AND (expires_at IS NULL OR expires_at > now())
    ORDER BY created_at ASC
  LOOP
    IF v_remaining_cost = 0 THEN
      EXIT;
    END IF;

    IF v_bucket.remaining_credits >= v_remaining_cost THEN
      UPDATE public.credit_buckets 
      SET remaining_credits = remaining_credits - v_remaining_cost
      WHERE id = v_bucket.id;
      v_remaining_cost := 0;
    ELSE
      UPDATE public.credit_buckets 
      SET remaining_credits = 0, status = 'exhausted'
      WHERE id = v_bucket.id;
      v_remaining_cost := v_remaining_cost - v_bucket.remaining_credits;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT TRUE, v_total_remaining - p_amount;
END;
$body LANGUAGE plpgsql SECURITY DEFINER;
