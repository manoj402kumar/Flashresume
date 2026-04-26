-- FlashResume Database Schema for Supabase

-- 1. Users (Extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  college_name TEXT,
  roll_number TEXT,
  is_student BOOLEAN DEFAULT FALSE,
  student_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
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
  INSERT INTO public.users (id, email)
  VALUES (new.id, new.email);
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
