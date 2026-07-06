-- Migration: v14_bulk_offer_sync
-- Purpose: Sync the live DB changes for the bulk_offer plan to local repository.

-- 1. Add bulk_offer to plan_type_enum
ALTER TYPE plan_type_enum ADD VALUE IF NOT EXISTS 'bulk_offer';

-- 2. Update process_successful_payment to handle bulk_offer expiry
CREATE OR REPLACE FUNCTION public.process_successful_payment(
    p_order_id TEXT,
    p_payment_id TEXT,
    p_signature TEXT,
    p_user_id UUID,
    p_plan_type TEXT,
    p_credits_to_add INT,
    p_validity_days INT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payment_status TEXT;
    v_expires_at TIMESTAMPTZ;
    v_bucket_id UUID;
BEGIN
    SELECT status INTO v_payment_status 
    FROM payments 
    WHERE razorpay_order_id = p_order_id 
    FOR UPDATE;

    IF v_payment_status = 'success' THEN
        IF EXISTS (SELECT 1 FROM credit_buckets WHERE payment_id = p_payment_id) THEN
            RETURN '{"status": "already_processed", "message": "Credits already granted"}';
        END IF;
    END IF;

    UPDATE payments 
    SET status = 'success', 
        razorpay_payment_id = p_payment_id,
        razorpay_signature = p_signature
    WHERE razorpay_order_id = p_order_id;

    SELECT public.add_credit_bucket(
        p_user_id,
        p_plan_type,
        p_credits_to_add,
        p_validity_days,
        p_payment_id
    ) INTO v_bucket_id;

    -- ✅ ALL 4 PLANS COVERED
    IF p_plan_type = 'regular' THEN
        v_expires_at := now() + interval '60 days';
    ELSIF p_plan_type = 'student' THEN
        v_expires_at := now() + interval '60 days';
    ELSIF p_plan_type = 'pay_per_use' THEN
        v_expires_at := now() + interval '10 days';
    ELSIF p_plan_type = 'bulk_offer' THEN
        v_expires_at := now() + interval '365 days';
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

    RETURN '{"status": "ok", "bucket_id": "' || v_bucket_id || '"}';
END;
$$;
