-- V23: Add service-role RLS policy for email_campaign_logs
-- The table was created in V17 with RLS enabled but NO policies defined.
-- This caused upserts from the backend (which uses the service-role key) to
-- silently fail on some Supabase project configurations.
--
-- The backend only ever reads/writes this table via the service-role client,
-- so we add a single policy that grants full access to the service role.
-- No end-user policy is needed — this table is admin-only.

-- Allow service role to SELECT (used in LEFT JOIN embed via PostgREST)
CREATE POLICY "service_role_select_campaign_logs"
ON public.email_campaign_logs
FOR SELECT
TO service_role
USING (true);

-- Allow service role to INSERT (first time logging a user)
CREATE POLICY "service_role_insert_campaign_logs"
ON public.email_campaign_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- Allow service role to UPDATE (subsequent email sends)
CREATE POLICY "service_role_update_campaign_logs"
ON public.email_campaign_logs
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);
