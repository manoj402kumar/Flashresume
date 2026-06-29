-- v7: Add idempotency guard to add_credit_bucket RPC
-- Prevents duplicate credit grants if Razorpay fires duplicate webhooks

-- Step 1a: Null out the referral-bonus duplicate (it's a legitimate row, not a fraud duplicate)
UPDATE public.credit_buckets
SET payment_id = NULL
WHERE plan_type = 'referral'
  AND payment_id IN (
    SELECT payment_id FROM public.credit_buckets
    GROUP BY payment_id HAVING COUNT(*) > 1
  );

-- Step 1b: Dedup remaining true duplicates (support_override — keep newest)
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

-- Step 3: Replace function with idempotency guard (RETURNS uuid preserved)
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
    -- IDEMPOTENCY GUARD: if this payment_id already exists, return its id silently
    IF p_payment_id IS NOT NULL THEN
        SELECT id INTO v_bucket_id FROM credit_buckets WHERE payment_id = p_payment_id;
        IF FOUND THEN
            RETURN v_bucket_id;
        END IF;
    END IF;

    IF p_plan_type = 'referral' THEN
        v_status := 'fallback';
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM credit_buckets
            WHERE user_id = p_user_id
            AND status IN ('active', 'queued')
            AND plan_type != 'referral'
        ) INTO v_has_active;

        IF v_has_active THEN
            v_status := 'queued';
        ELSE
            v_status := 'active';
        END IF;
    END IF;

    INSERT INTO credit_buckets (
        user_id, plan_type, status, original_credits, remaining_credits,
        validity_duration_days,
        activated_at,
        expires_at,
        payment_id
    ) VALUES (
        p_user_id,
        p_plan_type::plan_type_enum,
        v_status,
        p_amount,
        p_amount,
        p_validity_days,
        CASE WHEN v_status = 'active' THEN now() ELSE NULL END,
        CASE WHEN v_status = 'active' AND p_validity_days IS NOT NULL
             THEN now() + (p_validity_days || ' days')::interval
             ELSE NULL END,
        p_payment_id
    ) RETURNING id INTO v_bucket_id;

    RETURN v_bucket_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
