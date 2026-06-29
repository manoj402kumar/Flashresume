-- v7: Add idempotency guard to add_credit_bucket RPC
-- Prevents duplicate credit grants if Razorpay fires duplicate webhooks

-- Step 1: Add a partial UNIQUE constraint on payment_id (excluding NULLs — referral buckets have no payment_id)
-- Note: A regular UNIQUE constraint on PostgreSQL treats multiple NULLs as distinct values, 
-- so it natively allows multiple NULL payment_ids while enforcing uniqueness on non-NULLs.
ALTER TABLE public.credit_buckets
ADD CONSTRAINT credit_buckets_payment_id_unique UNIQUE (payment_id);

-- Step 2: Update add_credit_bucket RPC to check idempotency at the top
-- TODO for USER: Please run `SELECT pg_get_functiondef('public.add_credit_bucket'::regproc);` 
-- in your Supabase SQL editor to get the exact live function body, and paste it here, 
-- inserting the idempotency block right after the BEGIN statement as shown below:

/*
CREATE OR REPLACE FUNCTION public.add_credit_bucket(
    p_user_id uuid,
    p_plan_type text,
    p_amount integer,
    p_validity_days integer,
    p_payment_id text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_status bucket_status_enum;
    v_has_active BOOLEAN;
    v_bucket_id UUID;
BEGIN
    -- IDEMPOTENCY GUARD: if this payment_id was already processed, return existing bucket id
    IF p_payment_id IS NOT NULL THEN
        SELECT id INTO v_bucket_id FROM credit_buckets WHERE payment_id = p_payment_id;
        IF FOUND THEN
            RETURN v_bucket_id;  -- silent no-op, return existing
        END IF;
    END IF;

    -- ... PASTE THE REST OF THE EXISTING LIVE FUNCTION BODY HERE ...
END;
$$;
*/
