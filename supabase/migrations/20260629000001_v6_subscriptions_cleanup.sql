-- 1. Fix Orphaned User (Manual Grant)
DO $$
BEGIN
    -- This user paid for a student plan but encountered a partial failure in the backend
    -- before their credit bucket was created.
    PERFORM add_credit_bucket(
        '069a6498-4ffe-42ca-8ee8-62e654a19cef'::uuid,  -- user_id
        'student',     -- plan_type
        300,           -- p_amount
        60,            -- validity_days
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
        NOW() + INTERVAL '60 days',
        TRUE
    );
EXCEPTION WHEN others THEN
    -- Ignore errors on fresh DBs where the user does not exist
    NULL;
END $$;

-- 2. Cleanup Expired Subscriptions
-- Set is_active = FALSE for all subscriptions that have passed their expiration date
UPDATE public.subscriptions
SET is_active = FALSE
WHERE is_active = TRUE
  AND expires_at IS NOT NULL
  AND expires_at < NOW();

-- NOTE: To prevent this from drifting again in the future, consider using pg_cron 
-- or ensuring that any logic checking `is_active` also checks `expires_at > NOW()`.


