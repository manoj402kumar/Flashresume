-- Migration v20: Reset fraud counter for existing users and auto-unblock when credits are granted

-- 1. Reset fraud_tracker_counter to 0 for all existing users in production
UPDATE public.users
SET fraud_tracker_counter = 0
WHERE COALESCE(fraud_tracker_counter, 0) > 0;

-- 2. Update the sync_credits_balance trigger function on credit_buckets
-- Whenever credits are added/updated in credit_buckets and the total remaining credits > 0,
-- automatically reset fraud_tracker_counter to 0 to unblock the user instantly.
CREATE OR REPLACE FUNCTION public.sync_credits_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_total_credits INTEGER;
BEGIN
  -- Compute total active/fallback remaining credits
  SELECT COALESCE(SUM(remaining_credits), 0)
  INTO v_total_credits
  FROM credit_buckets
  WHERE user_id = NEW.user_id 
    AND status IN ('active','fallback') 
    AND remaining_credits > 0;

  -- Update user's credits_balance AND reset fraud_tracker_counter if v_total_credits > 0
  UPDATE users 
  SET credits_balance = v_total_credits,
      fraud_tracker_counter = CASE WHEN v_total_credits > 0 THEN 0 ELSE fraud_tracker_counter END
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
