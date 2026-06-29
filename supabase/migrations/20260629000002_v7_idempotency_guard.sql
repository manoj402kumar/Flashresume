-- v7: Add idempotency guard to add_credit_bucket RPC
-- Prevents duplicate credit grants if Razorpay fires duplicate webhooks

-- Step 1: Clean up support_override duplicates before adding constraint
-- (keep only the most recently created row per duplicate payment_id)
DELETE FROM public.credit_buckets
WHERE id NOT IN (
  SELECT DISTINCT ON (payment_id) id
  FROM public.credit_buckets
  WHERE payment_id IS NOT NULL
  ORDER BY payment_id, created_at DESC
);

-- Step 2: Add UNIQUE constraint (now safe)
ALTER TABLE public.credit_buckets
ADD CONSTRAINT credit_buckets_payment_id_unique UNIQUE (payment_id);

-- Step 3: Replace function — KEEP uuid return type and enum cast
-- TODO for USER: Please run `SELECT pg_get_functiondef('public.add_credit_bucket'::regproc);` 
-- in your Supabase SQL editor to get the exact live function body, and paste it here, 
-- inserting the idempotency block right after the BEGIN statement as shown below:

/*
CREATE OR REPLACE FUNCTION public.add_credit_bucket(
  p_user_id UUID,
  p_plan_type TEXT,
  p_amount INTEGER,
  p_validity_days INTEGER DEFAULT NULL,
  p_payment_id TEXT DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_status bucket_status_enum;
  v_has_active BOOLEAN;
  v_bucket_id UUID;
BEGIN
  -- IDEMPOTENCY GUARD
  IF p_payment_id IS NOT NULL THEN
    SELECT id INTO v_bucket_id FROM credit_buckets WHERE payment_id = p_payment_id;
    IF FOUND THEN
      RETURN v_bucket_id;  -- silent no-op, return existing bucket id
    END IF;
  END IF;

  -- ... PASTE THE REST OF THE EXISTING LIVE FUNCTION BODY HERE ...
  -- MAKE SURE to keep p_plan_type::plan_type_enum and RETURNING id INTO v_bucket_id
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
*/
