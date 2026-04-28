-- Add student_verified to users
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS student_verified BOOLEAN NOT NULL DEFAULT false;

-- Create student_verifications table
CREATE TABLE IF NOT EXISTS public.student_verifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  method            TEXT NOT NULL, -- 'details' or 'email'
  college_name      TEXT,
  enrollment_number TEXT,
  student_email     TEXT,
  status            TEXT NOT NULL DEFAULT 'approved', -- auto-approved based on spec
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.student_verifications ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own verifications
CREATE POLICY "users_own_verifications" ON public.student_verifications
  FOR SELECT USING (auth.uid() = user_id);

-- Allow users to insert their own verifications
CREATE POLICY "users_insert_verifications" ON public.student_verifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Ensure users can update their own row in users table to set student_verified
CREATE POLICY "users_update_own_row" ON public.users
  FOR UPDATE USING (auth.uid() = id);
