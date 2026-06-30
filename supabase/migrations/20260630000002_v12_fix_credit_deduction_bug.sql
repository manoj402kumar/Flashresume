-- ==============================================================================
-- MIGRATION: 20260630000002_v12_fix_credit_deduction_bug.sql
-- ==============================================================================
-- PURPOSE: Fix the root cause of "credits not showing after payment" for users
-- who had previously exhausted a credit bucket.
--
-- ROOT CAUSE:
--   `deduct_credits_v2` sets status = 'exhausted' when a bucket hits 0.
--   But bucket_status_enum only has: active, queued, fallback, depleted, expired.
--   There is NO 'exhausted' value. This causes the UPDATE to throw a PG exception,
--   the transaction rolls back, and the bucket stays status='active' with
--   remaining_credits=0 — a "zombie" bucket.
--
-- CASCADE EFFECT:
--   When a zombie bucket exists, `add_credit_bucket` sees an 'active' bucket
--   for the user and puts the NEW purchase into 'queued' status instead of 'active'.
--   The user pays, gets no credits visible, and is frustrated.
--   The pg_cron job from v10 would eventually promote the queued bucket (up to 1hr),
--   but this is unacceptable UX for a payment flow.
--
-- FIXES IN THIS MIGRATION:
--   1. One-time cleanup: set zombie buckets (active, 0 credits) -> depleted
--   2. Fix deduct_credits_v2: 'exhausted' -> 'depleted'
--   3. Harden add_credit_bucket: exclude 0-credit buckets from active check
-- ==============================================================================


-- ==============================================================================
-- FIX 1: Clean up existing zombie buckets
-- These are buckets that deduct_credits_v2 failed to mark as depleted.
-- Safe: a bucket with 0 remaining_credits is functionally exhausted.
-- ==============================================================================

UPDATE public.credit_buckets
SET status = 'depleted'
WHERE status = 'active'
  AND remaining_credits = 0;

-- Also clean up queued buckets with 0 credits (edge case from duplicate processing)
UPDATE public.credit_buckets
SET status = 'depleted'
WHERE status = 'queued'
  AND remaining_credits = 0;


-- ==============================================================================
-- FIX 2: Rewrite deduct_credits_v2 — change 'exhausted' to 'depleted'
-- ==============================================================================

-- NOTE: DROP required because PostgreSQL cannot change return type via CREATE OR REPLACE
DROP FUNCTION IF EXISTS public.deduct_credits_v2(uuid, integer);

CREATE FUNCTION public.deduct_credits_v2(
  p_user_id UUID,
  p_amount INTEGER
) RETURNS TABLE(success BOOLEAN, new_balance INTEGER) AS $$
DECLARE
  v_remaining_cost INTEGER := p_amount;
  v_bucket RECORD;
  v_total_remaining INTEGER := 0;
BEGIN
  -- Check total available credits across all active/queued/fallback buckets
  SELECT SUM(remaining_credits) INTO v_total_remaining
  FROM public.credit_buckets
  WHERE user_id = p_user_id
    AND status IN ('active', 'queued', 'fallback')
    AND remaining_credits > 0;
  
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
    ORDER BY created_at ASC
    FOR UPDATE  -- lock rows to prevent race conditions
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
      -- FIX: was 'exhausted' which does NOT exist in bucket_status_enum.
      -- Correct value is 'depleted'.
      UPDATE public.credit_buckets 
      SET remaining_credits = 0,
          status = 'depleted'   -- FIXED: was 'exhausted'
      WHERE id = v_bucket.id;
      v_remaining_cost := v_remaining_cost - v_bucket.remaining_credits;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT TRUE, v_total_remaining - p_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- FIX 3: Harden add_credit_bucket — exclude 0-credit buckets from active check
-- This is a defensive fix so that even if FIX 2 fails in the future (e.g. new
-- edge case), new purchases still go to 'active' instead of 'queued'.
-- ==============================================================================

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
        -- HARDENED: Only count buckets that actually have credits remaining.
        -- Previously this checked ANY active/queued bucket including zombies
        -- (active, remaining_credits=0), which caused new purchases to go
        -- to 'queued' even though the user had no usable credits.
        SELECT EXISTS (
            SELECT 1 FROM credit_buckets
            WHERE user_id = p_user_id
              AND status IN ('active', 'queued')
              AND plan_type != 'referral'
              AND remaining_credits > 0   -- HARDENED: exclude zombie buckets
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
