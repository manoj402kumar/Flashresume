-- ==============================================================================
-- MIGRATION: 20260730000000_v21_stateless_generation.sql
-- ==============================================================================
-- Architecture change: resume_text and generated_output are no longer stored.
-- All resume content is sent directly from the backend to the client (localStorage).
-- This frees ~37KB per row (~185MB total from existing rows).
--
-- What is KEPT in resume_sessions:
--   id, user_id, payment_id, download_count, created_at
-- (needed for: feedback validation, payment linking, admin queue health)
-- ==============================================================================

-- Step 1: Wipe heavy content columns from all existing rows
-- This immediately frees the storage on Supabase.
UPDATE public.resume_sessions
SET
    generated_output = NULL,
    resume_text      = NULL
WHERE
    generated_output IS NOT NULL
    OR resume_text IS NOT NULL;
