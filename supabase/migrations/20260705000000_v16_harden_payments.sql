-- ==============================================================================
-- MIGRATION: 20260705000000_v16_harden_payments.sql
-- ==============================================================================
-- PURPOSE: Fix payment credit grant race conditions, zombie buckets, and idempotency.
-- 
-- CHANGES:
-- 1. Create payment_recovery_queue table
-- 2. Add payment_id TEXT UNIQUE to subscriptions
-- 3. Cleanup 64 zombie buckets + queued buckets
-- 4. Safe enum cast in add_credit_bucket
-- 5. Nested BEGIN...EXCEPTION in process_successful_payment
-- 6. Add sync_credits_balance trigger
-- ==============================================================================

-- ==============================================================================
-- 1. CREATE PAYMENT RECOVERY QUEUE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.payment_recovery_queue (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    TEXT NOT NULL,
    user_id     UUID REFERENCES public.users(id),
    plan_type   TEXT,
    error_msg   TEXT,
    resolved    BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- RLS: service_role only
ALTER TABLE public.payment_recovery_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON public.payment_recovery_queue FOR ALL USING (auth.role() = 'service_role');


-- ==============================================================================
-- 2. ADD PAYMENT_ID TO SUBSCRIPTIONS (IDEMPOTENCY GUARD)
-- ==============================================================================
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS payment_id TEXT UNIQUE;


-- ==============================================================================
-- 3. CLEAN UP ZOMBIE BUCKETS
-- ==============================================================================
-- Fix existing zombie buckets
UPDATE public.credit_buckets
SET status = 'depleted'
WHERE status IN ('active', 'queued') AND remaining_credits = 0;

-- Promote queued buckets that are now the only active bucket per user
WITH ranked AS (
  SELECT id, user_id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) as rn
  FROM credit_buckets
  WHERE status = 'queued' AND remaining_credits > 0
    AND NOT EXISTS (
      SELECT 1 FROM credit_buckets cb2
      WHERE cb2.user_id = credit_buckets.user_id
        AND cb2.status = 'active' AND cb2.remaining_credits > 0
    )
)
UPDATE credit_buckets
SET status = 'active',
    activated_at = now(),
    expires_at = CASE WHEN validity_duration_days IS NOT NULL
                      THEN now() + (validity_duration_days || ' days')::interval
                      ELSE NULL END
WHERE id IN (SELECT id FROM ranked WHERE rn = 1);


-- ==============================================================================
-- 4. HARDEN add_credit_bucket WITH SAFE ENUM CAST
-- ==============================================================================
DROP FUNCTION IF EXISTS public.add_credit_bucket(UUID, TEXT, INTEGER, INTEGER, TEXT);

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
    v_safe_plan_type plan_type_enum;
BEGIN
    -- IDEMPOTENCY GUARD
    IF p_payment_id IS NOT NULL THEN
        SELECT id INTO v_bucket_id FROM credit_buckets WHERE payment_id = p_payment_id;
        IF FOUND THEN
            RETURN v_bucket_id;
        END IF;
    END IF;

    -- Safe cast to enum
    CASE p_plan_type
      WHEN 'student' THEN v_safe_plan_type := 'student'::plan_type_enum;
      WHEN 'regular' THEN v_safe_plan_type := 'regular'::plan_type_enum;
      WHEN 'pay_per_use' THEN v_safe_plan_type := 'pay_per_use'::plan_type_enum;
      WHEN 'bulk_offer' THEN v_safe_plan_type := 'bulk_offer'::plan_type_enum;
      WHEN 'referral' THEN v_safe_plan_type := 'referral'::plan_type_enum;
      WHEN 'manual' THEN v_safe_plan_type := 'manual'::plan_type_enum;
      ELSE
          RAISE EXCEPTION 'Unknown plan_type: %', p_plan_type;
    END CASE;

    IF p_plan_type = 'referral' THEN
        v_status := 'fallback';
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM credit_buckets
            WHERE user_id = p_user_id
              AND status IN ('active', 'queued')
              AND plan_type != 'referral'
              AND remaining_credits > 0
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
        v_safe_plan_type,
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


-- ==============================================================================
-- 5. REWRITE process_successful_payment WITH NESTED EXCEPTION
-- ==============================================================================
DROP FUNCTION IF EXISTS public.process_successful_payment(TEXT, TEXT, TEXT, UUID, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.process_successful_payment(TEXT, TEXT, TEXT, UUID, TEXT, INT, INT);

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
    v_error TEXT;
BEGIN
    -- OUTER BLOCK: This update commits if nothing below raises an unhandled exception
    UPDATE payments 
    SET status = 'success', 
        razorpay_payment_id = p_payment_id,
        razorpay_signature = p_signature
    WHERE razorpay_order_id = p_order_id AND status != 'success';

    IF NOT FOUND THEN
        -- It was already processed (success or something else)
        -- Check if credits were already granted (idempotency fallback)
        IF EXISTS (SELECT 1 FROM credit_buckets WHERE payment_id = p_payment_id) THEN
            RETURN jsonb_build_object('status', 'already_processed', 'message', 'Credits already granted');
        ELSE
            RETURN jsonb_build_object('status', 'not_found', 'message', 'Order not found in payments table');
        END IF;
    END IF;

    -- NESTED BLOCK: PL/pgSQL sub-block with its own exception handler
    BEGIN
        -- 1. Grant Credits
        PERFORM public.add_credit_bucket(
            p_user_id,
            p_plan_type,
            p_credits_to_add,
            p_validity_days,
            p_payment_id
        );
        
        -- 2. Update Subscriptions
        -- Deactivate old subscription
        UPDATE subscriptions SET is_active = false WHERE user_id = p_user_id;

        -- Insert new subscription, handling duplicate webhook/verify races
        INSERT INTO subscriptions (
            user_id, plan_type, is_active, credits_granted, expires_at, student_claimed, payment_id
        )
        VALUES (
            p_user_id, 
            p_plan_type, 
            true, 
            p_credits_to_add, 
            now() + (p_validity_days || ' days')::interval, 
            CASE WHEN p_plan_type = 'student' THEN true ELSE false END,
            p_payment_id
        ) ON CONFLICT (payment_id) DO NOTHING;

    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
        INSERT INTO payment_recovery_queue (order_id, user_id, plan_type, error_msg)
        VALUES (p_order_id, p_user_id, p_plan_type, v_error);
        -- Outer UPDATE on payments is NOT rolled back!
    END;

    RETURN jsonb_build_object('status', 'ok');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- 6. ADD sync_credits_balance TRIGGER
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.sync_credits_balance()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users SET credits_balance = (
    SELECT COALESCE(SUM(remaining_credits), 0)
    FROM credit_buckets
    WHERE user_id = NEW.user_id 
      AND status IN ('active','fallback') 
      AND remaining_credits > 0
  ) WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_credits ON public.credit_buckets;

CREATE TRIGGER trg_sync_credits
AFTER INSERT OR UPDATE OF remaining_credits, status ON public.credit_buckets
FOR EACH ROW EXECUTE FUNCTION public.sync_credits_balance();
