-- V17: Create email_campaign_logs table for cold email conversion tracking
-- Tracks when a free user was last emailed so the campaign can
-- cycle through all free users indefinitely, oldest-emailed first.
CREATE TABLE IF NOT EXISTS public.email_campaign_logs (
    user_id          UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    last_emailed_at  TIMESTAMPTZ DEFAULT now(),
    total_emails_sent INTEGER DEFAULT 1
);

-- RLS: Only service-role (admin script) can touch this table.
ALTER TABLE public.email_campaign_logs ENABLE ROW LEVEL SECURITY;
