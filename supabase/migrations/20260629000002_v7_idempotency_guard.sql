-- v7: Add idempotency guard to add_credit_bucket RPC
-- Prevents duplicate credit grants if Razorpay fires duplicate webhooks

-- Step 1: Add a partial UNIQUE constraint on payment_id (excluding NULLs — referral buckets have no payment_id)
-- Note: A regular UNIQUE constraint on PostgreSQL treats multiple NULLs as distinct values, 
-- so it natively allows multiple NULL payment_ids while enforcing uniqueness on non-NULLs.
ALTER TABLE public.credit_buckets
ADD CONSTRAINT credit_buckets_payment_id_unique UNIQUE (payment_id);

-- Step 2: Update add_credit_bucket RPC to check idempotency at the top
CREATE OR REPLACE FUNCTION public.add_credit_bucket(
  p_user_id UUID,
  p_plan_type TEXT,
  p_amount INTEGER,
  p_validity_days INTEGER DEFAULT NULL,
  p_payment_id TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  -- IDEMPOTENCY GUARD: if this payment_id was already processed, return silently
  IF p_payment_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM credit_buckets WHERE payment_id = p_payment_id) THEN
      RETURN;  -- silent no-op, void function
    END IF;
  END IF;

  INSERT INTO public.credit_buckets (
    user_id, plan_type, original_credits, remaining_credits, status, expires_at, payment_id
  ) VALUES (
    p_user_id, p_plan_type, p_amount, p_amount, 'active',
    CASE WHEN p_validity_days IS NOT NULL 
         THEN now() + (p_validity_days || ' days')::interval 
         ELSE NULL END,
    p_payment_id
  );

  -- Update users.credits_balance for legacy fallback
  UPDATE public.users
  SET credits_balance = COALESCE(credits_balance, 0) + p_amount
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
