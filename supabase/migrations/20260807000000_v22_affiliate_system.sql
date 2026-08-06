-- FlashResume v22: Affiliate System
-- Tables: affiliates, affiliate_conversions, affiliate_payouts
-- Alters: payments (add affiliate_code column)

-- 1. affiliates table
CREATE TABLE IF NOT EXISTS public.affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  affiliate_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active',            -- 'active' | 'suspended'
  earnings_balance NUMERIC(10,2) DEFAULT 0, -- pending payout
  total_earned NUMERIC(10,2) DEFAULT 0,     -- lifetime
  upi_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

-- Affiliates can read/update their own row
CREATE POLICY "Affiliates can view own record" ON public.affiliates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Affiliates can update own record" ON public.affiliates
  FOR UPDATE USING (auth.uid() = user_id);

-- 2. affiliate_conversions table
CREATE TABLE IF NOT EXISTS public.affiliate_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  payment_id TEXT NOT NULL,
  new_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  plan_type TEXT NOT NULL,
  plan_amount INTEGER NOT NULL,           -- in rupees
  commission_amount NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'credited',        -- 'credited' | 'paid_out'
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.affiliate_conversions ENABLE ROW LEVEL SECURITY;

-- Affiliates can view their own conversions
CREATE POLICY "Affiliates view own conversions" ON public.affiliate_conversions
  FOR SELECT USING (
    affiliate_id IN (
      SELECT id FROM public.affiliates WHERE user_id = auth.uid()
    )
  );

-- 3. affiliate_payouts table
CREATE TABLE IF NOT EXISTS public.affiliate_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  upi_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',         -- 'pending' | 'processed'
  requested_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  admin_note TEXT
);

ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;

-- Affiliates can view their own payouts
CREATE POLICY "Affiliates view own payouts" ON public.affiliate_payouts
  FOR SELECT USING (
    affiliate_id IN (
      SELECT id FROM public.affiliates WHERE user_id = auth.uid()
    )
  );

-- 4. Add affiliate_code column to payments table
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS affiliate_code TEXT;

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_affiliates_code ON public.affiliates(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_affiliates_user ON public.affiliates(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_affiliate ON public.affiliate_conversions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_affiliate ON public.affiliate_payouts(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_payments_affiliate_code ON public.payments(affiliate_code);
