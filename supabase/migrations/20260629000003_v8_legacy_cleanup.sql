-- v8: Cleanup legacy credit functions
-- Dropping unused v1 functions that have been fully replaced by v2/bucket logic.

DROP FUNCTION IF EXISTS public.add_credits(uuid, integer, text, text);
DROP FUNCTION IF EXISTS public.deduct_credits(uuid, integer, uuid);
