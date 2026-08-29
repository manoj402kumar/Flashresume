# Gap Report

1. **Storage Concurrency & Scalability**
   - **Current**: `storage_service.py` falls back to `/tmp/flashresume_storage/transient`.
   - **Gap**: High. In a horizontally scaled API, node A writes to its `/tmp`, but worker on node B cannot read it.
   - **Fix**: Mount a shared volume or strictly use Supabase async storage with generous timeout (not 0.8s thread pool). We should use `create_async_client` for Supabase storage in `storage_service.py` to prevent thread-pool blocking.

2. **Fraud Check DB Latency**
   - **Current**: `generate.py` does a synchronous `asyncio.to_thread` for fraud checks.
   - **Gap**: High. Contributes to 4.7s API p95 ingestion.
   - **Fix**: Cache the user fraud data in Redis for 60s to absorb burst traffic.

3. **SSE as notification transport (No durable state)**
   - **Current**: `jobs.py` correctly handles SSE and cleans up.
   - **Gap**: Low. Already implemented.

4. **Worker / Queue configuration through ENV vars**
   - **Current**: `supervisor.py` hardcodes `WORKER_COUNT = 3`. `worker.py` uses `WORKER_CONCURRENCY = int(os.getenv("WORKER_CONCURRENCY", "4"))`.
   - **Gap**: Medium. Hardcoded worker count.
   - **Fix**: Update `supervisor.py` to read `WORKER_COUNT` from env.

5. **LLM configuration through ENV vars**
   - **Current**: LLM quotas are hardcoded in `llm/quota_manager.py` or `master_llm_caller.py`. Let's verify this.

6. **Alerting / Observability**
   - **Current**: No formalized alerting thresholds.
   - **Gap**: Medium.
   - **Fix**: Add structured JSON logging and basic metrics counting in Redis (e.g. `INCR metrics:api_5xx`).

7. **Idempotency**
   - **Current**: `/generate` is idempotent. `/parse` and `/analyze`? Let's check.
   - **Fix**: Add idempotency to `/parse` and `/analyze`.

8. **Test Suite Organization & Capacity Gates**
   - **Current**: Scripts in `scratch/`.
   - **Gap**: Medium. Need to move to `tests/`.

