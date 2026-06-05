-- FlashResume Database Schema for Supabase

-- 1. Users (Extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  college_name TEXT,
  roll_number TEXT,
  is_student BOOLEAN DEFAULT FALSE,
  student_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  referral_code TEXT UNIQUE,
  referred_by UUID REFERENCES public.users(id),
  credits_balance INTEGER DEFAULT 0
);

-- Turn on Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- Policy: Users can only read/update their own profile
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
-- Allow inserts for trigger
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- Trigger to automatically create a public.users record when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, referral_code)
  VALUES (new.id, new.email, upper(substring(gen_random_uuid()::text, 1, 8)));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. Resume Sessions
CREATE TABLE IF NOT EXISTS public.resume_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  resume_text TEXT,
  generated_output JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  downloaded_at TIMESTAMPTZ,
  payment_id TEXT
);

ALTER TABLE public.resume_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own resume sessions" ON public.resume_sessions FOR ALL USING (auth.uid() = user_id);

-- 3. Subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL, -- 'one_time', 'student', 'regular'
  student_claimed BOOLEAN DEFAULT FALSE,
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
-- Note: Subscriptions should be modified by a secure backend role normally, but allowing read for the user.

-- 4. Payments
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  razorpay_order_id TEXT NOT NULL,
  razorpay_payment_id TEXT,
  amount INTEGER NOT NULL, -- in paise
  plan_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'success', 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);

-- 5. Resume Downloads
CREATE TABLE IF NOT EXISTS public.resume_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.resume_sessions(id) ON DELETE CASCADE,
  payment_id TEXT,
  downloaded_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.resume_downloads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own downloads" ON public.resume_downloads FOR SELECT USING (auth.uid() = user_id);

-- 6. Page Visits (Analytics)
CREATE TABLE IF NOT EXISTS public.page_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_type TEXT NOT NULL, -- 'landing', 'result', etc
  session_id TEXT, -- Optional cookie/localstorage id for anonymous tracking
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  visited_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.page_visits ENABLE ROW LEVEL SECURITY;
-- Analytics should be readable only by admins, but inserts should be open (if public) or handled via backend service key
-- Using service role key in backend bypasses RLS, so this is safe:
CREATE POLICY "Enable insert for all" ON public.page_visits FOR INSERT WITH CHECK (true);


-- 7. Referral Rewards
CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  payment_id TEXT,
  credits_awarded INTEGER DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referrer_id, referred_user_id)
);

ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own referral rewards" ON public.referral_rewards FOR SELECT USING (auth.uid() = referrer_id);

-- RPC Function for Atomic Credit Award
CREATE OR REPLACE FUNCTION public.award_referral_bonus(
  p_referrer_uuid UUID,
  p_referred_uuid UUID,
  p_amount INTEGER,
  p_pay_id TEXT
) RETURNS void AS $$
BEGIN
  -- Insert into referral_rewards first. If it violates UNIQUE constraint, it throws an error and aborts transaction.
  INSERT INTO public.referral_rewards (referrer_id, referred_user_id, payment_id, credits_awarded)
  VALUES (p_referrer_uuid, p_referred_uuid, p_pay_id, p_amount);
  
  -- If insert succeeds, safely update credits
  UPDATE public.users
  SET credits_balance = COALESCE(credits_balance, 0) + p_amount
  WHERE id = p_referrer_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. OTP Verifications (Student Offer Email Verification)
-- Used by /api/payments/send-otp and /api/payments/verify-otp
-- RLS is disabled — accessed only via the backend service role key (not by users directly)
CREATE TABLE IF NOT EXISTS public.otp_verifications (
  email TEXT PRIMARY KEY,            -- one active OTP per email at a time
  otp TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  failed_attempts INTEGER DEFAULT 0, -- brute-force protection (max 5 attempts)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- No RLS — backend service key bypasses it; users never query this table directly
ALTER TABLE public.otp_verifications DISABLE ROW LEVEL SECURITY;

