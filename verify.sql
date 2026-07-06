SELECT
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_recovery_queue') as recovery_table_exists,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'payment_id') as subs_payment_id,
  (SELECT COUNT(*) FROM information_schema.triggers WHERE event_object_schema = 'public' AND event_object_table = 'credit_buckets' AND trigger_name = 'trg_sync_credits') as sync_trigger,
  (SELECT COUNT(*) FROM public.credit_buckets WHERE status IN ('active', 'queued') AND remaining_credits = 0) as zombies_remaining,
  (SELECT COUNT(*) FROM public.credit_buckets cb1 WHERE status = 'queued' AND remaining_credits > 0 AND NOT EXISTS (SELECT 1 FROM public.credit_buckets cb2 WHERE cb2.user_id = cb1.user_id AND cb2.status = 'active' AND cb2.remaining_credits > 0)) as promotable_queued;
