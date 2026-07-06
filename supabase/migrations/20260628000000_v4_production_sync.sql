-- FlashResume V4 Production Sync
-- This migration brings the repository schema up to date with the live production database.
-- It includes the new credit buckets system, LLM usage tracking, circuit breakers, and job applications.

-- 1. Create credit_buckets table
CREATE TABLE IF NOT EXISTS public.credit_buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  payment_id TEXT,
  plan_type TEXT NOT NULL,
  original_credits INTEGER NOT NULL,
  remaining_credits INTEGER NOT NULL,
  status TEXT DEFAULT 'active', -- 'active', 'queued', 'fallback', 'exhausted'
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (payment_id, user_id)
);

-- Enable RLS for credit_buckets
ALTER TABLE public.credit_buckets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own credit buckets" ON public.credit_buckets
  FOR SELECT USING (auth.uid() = user_id);

-- 2. Create llm_usage table
CREATE TABLE IF NOT EXISTS public.llm_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  success BOOLEAN DEFAULT TRUE,
  speed_secs FLOAT DEFAULT 0.0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for llm_usage
ALTER TABLE public.llm_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own llm usage" ON public.llm_usage
  FOR SELECT USING (auth.uid() = user_id);

-- 3. Create llm_circuit_breakers table
CREATE TABLE IF NOT EXISTS public.llm_circuit_breakers (
  model_name TEXT PRIMARY KEY,
  status TEXT DEFAULT 'operational', -- 'operational', 'degraded', 'failed'
  failure_count INTEGER DEFAULT 0,
  last_failure TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Service role only (admin)
ALTER TABLE public.llm_circuit_breakers ENABLE ROW LEVEL SECURITY;

-- 4. Create rr_counters table (for Round-Robin routing)
CREATE TABLE IF NOT EXISTS public.rr_counters (
  id TEXT PRIMARY KEY,
  current_index INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Service role only
ALTER TABLE public.rr_counters ENABLE ROW LEVEL SECURITY;

-- 5. Create system_metrics table
CREATE TABLE IF NOT EXISTS public.system_metrics (
  id TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Service role only
ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;

-- 6. Create job_applications table
CREATE TABLE IF NOT EXISTS public.job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  status TEXT DEFAULT 'applied',
  applied_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own job applications" ON public.job_applications
  FOR ALL USING (auth.uid() = user_id);

-- 7. Add missing columns
-- payments.razorpay_signature
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS razorpay_signature TEXT;

-- resume_downloads.device_type
ALTER TABLE public.resume_downloads 
ADD COLUMN IF NOT EXISTS device_type TEXT;

-- resume_sessions.download_count
ALTER TABLE public.resume_sessions 
ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0;

-- users.fraud_tracker_counter
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS fraud_tracker_counter INTEGER DEFAULT 0;

-- 8. Create add_credit_bucket RPC (with p_validity_days DEFAULT NULL)
CREATE OR REPLACE FUNCTION public.add_credit_bucket(
  p_user_id UUID,
  p_plan_type TEXT,
  p_amount INTEGER,
  p_validity_days INTEGER DEFAULT NULL,
  p_payment_id TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO public.credit_buckets (
    user_id, plan_type, original_credits, remaining_credits, status, expires_at, payment_id
  ) VALUES (
    p_user_id,
    p_plan_type,
    p_amount,
    p_amount,
    'active',
    CASE WHEN p_validity_days IS NOT NULL THEN now() + (p_validity_days || ' days')::interval ELSE NULL END,
    p_payment_id
  );
  
  -- Update users.credits_balance for legacy fallback
  UPDATE public.users 
  SET credits_balance = COALESCE(credits_balance, 0) + p_amount 
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create deduct_credits_v2 RPC
CREATE OR REPLACE FUNCTION public.deduct_credits_v2(
  p_user_id UUID,
  p_amount INTEGER
) RETURNS TABLE(success BOOLEAN, new_balance INTEGER) AS $$
DECLARE
  v_remaining_cost INTEGER := p_amount;
  v_bucket RECORD;
  v_total_remaining INTEGER := 0;
BEGIN
  -- Check total available credits
  SELECT SUM(remaining_credits) INTO v_total_remaining
  FROM public.credit_buckets
  WHERE user_id = p_user_id AND status IN ('active', 'queued', 'fallback') AND remaining_credits > 0;
  
  IF v_total_remaining IS NULL OR v_total_remaining < p_amount THEN
    RETURN QUERY SELECT FALSE, COALESCE(v_total_remaining, 0);
    RETURN;
  END IF;

  -- Deduct from oldest active buckets first
  FOR v_bucket IN 
    SELECT id, remaining_credits 
    FROM public.credit_buckets 
    WHERE user_id = p_user_id AND status IN ('active', 'queued', 'fallback') AND remaining_credits > 0
    ORDER BY created_at ASC
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
      UPDATE public.credit_buckets 
      SET remaining_credits = 0, status = 'exhausted'
      WHERE id = v_bucket.id;
      v_remaining_cost := v_remaining_cost - v_bucket.remaining_credits;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT TRUE, v_total_remaining - p_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
