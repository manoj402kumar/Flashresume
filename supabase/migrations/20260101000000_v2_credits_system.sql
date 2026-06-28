-- Phase 1: Add credits balance to users
ALTER TABLE public.users 
ADD COLUMN credits_balance INTEGER NOT NULL DEFAULT 0,
ADD COLUMN credits_updated_at TIMESTAMPTZ DEFAULT now();

-- Phase 2: Create credit transactions audit log
CREATE TABLE public.credit_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount        INTEGER NOT NULL,          -- positive = top-up, negative = deduction
  type          TEXT NOT NULL,             -- 'purchase', 'download', 'refund', 'bonus'
  plan_type     TEXT,                      -- 'pay_per_use', 'regular', 'student' (null for downloads)
  payment_id    TEXT,                      -- Razorpay payment_id (null for deductions)
  session_id    UUID,                      -- resume_sessions.id for download events
  note          TEXT,                      -- human-readable description
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- RLS policy for credit_transactions
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_transactions" ON public.credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Phase 3: Add credits_granted to subscriptions and rename plans
ALTER TABLE public.subscriptions 
ADD COLUMN credits_granted INTEGER DEFAULT 0;

UPDATE public.subscriptions SET plan_type = 'pay_per_use' WHERE plan_type = 'one_time';
UPDATE public.payments SET plan_type = 'pay_per_use' WHERE plan_type = 'one_time';

-- Phase 4: Atomic deduction function
CREATE OR REPLACE FUNCTION deduct_credits(p_user_id UUID, p_amount INTEGER, p_session_id UUID)
RETURNS TABLE(success BOOLEAN, new_balance INTEGER) 
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  -- Lock the user row for this transaction
  SELECT credits_balance INTO current_balance 
  FROM public.users 
  WHERE id = p_user_id
  FOR UPDATE;

  IF current_balance >= p_amount THEN
    UPDATE public.users 
    SET credits_balance = credits_balance - p_amount,
        credits_updated_at = now()
    WHERE id = p_user_id;

    INSERT INTO public.credit_transactions(user_id, amount, type, session_id, note)
    VALUES (p_user_id, -p_amount, 'download', p_session_id, '10 credits used for resume download');

    RETURN QUERY SELECT TRUE, (current_balance - p_amount)::INTEGER;
  ELSE
    RETURN QUERY SELECT FALSE, current_balance::INTEGER;
  END IF;
END;
$$;

-- Phase 5: Atomic addition function
CREATE OR REPLACE FUNCTION add_credits(p_user_id UUID, p_amount INTEGER, p_plan_type TEXT, p_payment_id TEXT)
RETURNS TABLE(success BOOLEAN, new_balance INTEGER) 
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  -- Lock the user row for this transaction
  SELECT credits_balance INTO current_balance 
  FROM public.users 
  WHERE id = p_user_id
  FOR UPDATE;

  UPDATE public.users 
  SET credits_balance = credits_balance + p_amount,
      credits_updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.credit_transactions(user_id, amount, type, plan_type, payment_id, note)
  VALUES (p_user_id, p_amount, 'purchase', p_plan_type, p_payment_id, p_amount || ' credits purchased via ' || p_plan_type);

  RETURN QUERY SELECT TRUE, (current_balance + p_amount)::INTEGER;
END;
$$;

-- Phase 6: Enable Realtime on users table (Required for CreditBadge live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;

