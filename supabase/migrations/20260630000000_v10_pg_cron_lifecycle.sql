-- ==============================================================================
-- MIGRATION: 20260630000000_v10_pg_cron_lifecycle.sql
-- ==============================================================================

-- ==============================================================================
-- 1. MANUAL HOTFIXES
-- ==============================================================================

-- Fix 1: manitelus - expire ghost bucket (safe no-op if already fixed)
UPDATE credit_buckets
SET status = 'expired'
WHERE payment_id = 'pay_T2ao9XZ0oiegMm'
  AND status = 'active'
  AND expires_at < NOW();

-- Fix 2: y.manoj - activate stranded student bucket
-- VERIFIED: status=queued, validity=60 days, no active bucket exists
UPDATE credit_buckets
SET status    = 'active',
    activated_at = NOW(),
    expires_at   = NOW() + (validity_duration_days || ' days')::interval
WHERE payment_id = 'pay_T5qU8aVxdyc4Mv'
  AND status = 'queued';

-- ==============================================================================
-- 2. LIFECYCLE MANAGEMENT FUNCTION (race-condition safe)
-- ==============================================================================

CREATE OR REPLACE FUNCTION manage_credit_bucket_lifecycle()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_bucket_id UUID;
BEGIN
  -- STEP 1: Expire all overdue active buckets (global sweep)
  UPDATE credit_buckets
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();

  -- STEP 2: Promote exactly one queued bucket per eligible user
  -- Uses a cursor loop so each user is processed independently
  -- FOR UPDATE SKIP LOCKED at the SELECT level prevents race conditions
  FOR v_user_id IN
    SELECT DISTINCT cb.user_id
    FROM credit_buckets cb
    WHERE cb.status = 'queued'
      AND cb.plan_type != 'referral'
      AND NOT EXISTS (
        SELECT 1 FROM credit_buckets cb2
        WHERE cb2.user_id = cb.user_id
          AND cb2.status   = 'active'
          AND cb2.plan_type != 'referral'
      )
  LOOP
    -- Lock exactly ONE queued bucket for this user, skip if locked by concurrent run
    SELECT id INTO v_bucket_id
    FROM credit_buckets
    WHERE user_id    = v_user_id
      AND status     = 'queued'
      AND plan_type != 'referral'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    -- Only promote if we successfully acquired the lock
    IF v_bucket_id IS NOT NULL THEN
      UPDATE credit_buckets
      SET status       = 'active',
          activated_at = NOW(),
          expires_at   = CASE
            WHEN validity_duration_days IS NOT NULL
            THEN NOW() + (validity_duration_days || ' days')::interval
            ELSE NULL
          END
      WHERE id = v_bucket_id;
    END IF;
  END LOOP;
END;
$$;

-- ==============================================================================
-- 3. SCHEDULE pg_cron JOB (safe: only schedules if not already exists)
-- ==============================================================================

DO $$
BEGIN
  -- Only create if it doesn't already exist — avoids unschedule() error
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'bucket-lifecycle-manager'
  ) THEN
    PERFORM cron.schedule(
      'bucket-lifecycle-manager',
      '0 * * * *',
      $$SELECT manage_credit_bucket_lifecycle()$$
    );
  END IF;
END;
$$;
