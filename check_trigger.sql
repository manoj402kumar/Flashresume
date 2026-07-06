SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'sync_credits_balance';
