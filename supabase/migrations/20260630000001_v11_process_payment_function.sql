-- ==============================================================================
-- MIGRATION: 20260630000001_v11_process_payment_function.sql
-- ==============================================================================
-- PURPOSE: Version-control the `process_successful_payment` function which was
-- previously only living in production Supabase Studio (not in this repo).
-- Saving it here as-is, with annotated bugs for the follow-up fix in v12.
--
-- KNOWN BUGS (see v12 for fixes):
--   BUG-1: `add_credit_bucket` inner call casts p_plan_type::plan_type_enum.
--           If plan_type_enum is missing values (e.g., 'pay_per_use'), the entire
--           transaction silently rolls back and credits are never granted.
--   BUG-2: If `add_credit_bucket` raises an exception, the PG transaction rolls
--           back ALL steps — including the `UPDATE payments SET status='success'`.
--           The payment stays 'pending'. Python's outer except block then marks it
--           'failed'. Both paths (verify + webhook) call this same function, so
--           the user is stuck with 0 credits and an error page.
--   BUG-3: When v_payment_status IS NULL (order_id not found), the function
--           silently falls through, updates 0 rows, but still calls add_credit_bucket.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.process_successful_payment(
    p_order_id TEXT,
    p_payment_id TEXT,
    p_signature TEXT,
    p_user_id UUID,
    p_plan_type TEXT,
    p_credits_to_add INT,
    p_validity_days INT
) RETURNS JSONB AS $$
DECLARE
    v_payment_status TEXT;
    v_expires_at TIMESTAMPTZ;
    v_bucket_id UUID;
BEGIN
    -- 1. Check current payment status and lock row for update
    SELECT status INTO v_payment_status 
    FROM payments 
    WHERE razorpay_order_id = p_order_id 
    FOR UPDATE;

    -- Idempotency check: if status is already success, check if we already processed it
    IF v_payment_status = 'success' THEN
        IF EXISTS (SELECT 1 FROM credit_buckets WHERE payment_id = p_payment_id) THEN
            RETURN '{"status": "already_processed", "message": "Credits already granted"}';
        END IF;
    END IF;

    -- 2. Update payment status to success
    UPDATE payments 
    SET status = 'success', 
        razorpay_payment_id = p_payment_id,
        razorpay_signature = p_signature
    WHERE razorpay_order_id = p_order_id;

    -- 3. Add to credit_buckets (calls your existing robust RPC)
    -- BUG-1: add_credit_bucket does p_plan_type::plan_type_enum — if enum is missing
    -- a value, this throws and rolls back the entire transaction.
    SELECT public.add_credit_bucket(
        p_user_id,
        p_plan_type,
        p_credits_to_add,
        p_validity_days,
        p_payment_id
    ) INTO v_bucket_id;

    -- 4. Update Subscriptions
    IF p_plan_type = 'regular' THEN
        v_expires_at := now() + interval '60 days';
    ELSIF p_plan_type = 'student' THEN
        v_expires_at := now() + interval '60 days';
    ELSIF p_plan_type = 'pay_per_use' THEN
        v_expires_at := now() + interval '10 days';
    END IF;

    UPDATE subscriptions SET is_active = false WHERE user_id = p_user_id;
    
    INSERT INTO subscriptions (user_id, plan_type, is_active, credits_granted, expires_at, student_claimed)
    VALUES (
        p_user_id, 
        p_plan_type, 
        true, 
        p_credits_to_add, 
        v_expires_at, 
        CASE WHEN p_plan_type = 'student' THEN true ELSE false END
    );

    RETURN jsonb_build_object('status', 'ok', 'bucket_id', v_bucket_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
