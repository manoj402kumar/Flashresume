# TRANSIENT_PDF_MISSING_INCIDENT.md

> **Current Status**: ✅ RESOLVED (2026-08-28)  
> **Resolution**: The architecture has been redesigned. PDFs are now stored in **Object Storage** (`storage_service.py`), not Redis. The `transient:file:*` Redis key pattern described below no longer exists in production. The worker now retrieves files via `storage_service.get_file_bytes(file_key)` and deletes them via `storage_service.delete_file(file_key)` only after confirmed `COMPLETE` status.  
> This document is preserved as historical record. Do not rewrite it as if the incident never happened.

---

## Exact Failure

```
FileNotFoundError: File data not found in Redis (expired or already processed):
transient:file:877963625cc54c59a8f5e8207a4acd32
```

Trace:
```
worker.py:180 → process_job()
worker.py:21  → handle_parse_job(job_id, payload)
             → FileNotFoundError
```

---

## Root Cause — Definitive

**Primary: Unconditional DELETE fires before the null-check, wiping the key on the first attempt. Every subsequent retry finds the key absent.**

The bug was in `worker.py`, `handle_parse_job()`:

```python
# OLD (BUGGY) code — lines 14–21
file_bytes = await redis_client.get(file_key)   # ← Step 1: GET (may return None)

# Aggressive purge — regardless of success/failure
await redis_client.delete(file_key)              # ← Step 2: DELETE fires UNCONDITIONALLY
                                                 #   Key is gone whether GET returned data or not.

if not file_bytes:                               # ← Step 3: check AFTER delete
    raise FileNotFoundError(...)                 # ← Step 4: raise (key already gone)
```

**The DELETE on line 18 ran before the null-check on line 20.** Regardless of whether `GET` returned the PDF bytes or `None`, the key was always deleted immediately.

This interacted fatally with the at-least-once delivery semantics of the queue:

```
Worker A → GET file_key → DELETE file_key (unconditional)
Worker A → crashes or encounters parse error
fail_job() → requeues the job (retries < MAX_RETRIES=3)
Worker B → GET file_key → None (deleted by Worker A)
Worker B → DELETE file_key (no-op)
Worker B → FileNotFoundError
... (repeats until DLQ)
```

Every retry was **guaranteed to fail** because the key was permanently deleted on the first attempt, before processing completed.

---

## Secondary Bug — parse.py Idempotency Race

In `parse.py`, the original code used `setnx` + `setex` as two separate commands:

```python
# OLD (BUGGY) — two-step, non-atomic
is_first = await redis_client.setnx(idempotency_key, job_id)  # Sets key WITH NO TTL
# ... crash window here ...
await redis_client.setex(idempotency_key, 3600, job_id)       # Overwrites with TTL
```

If the process crashed between `setnx` and `setex`, the idempotency key existed permanently (no TTL), blocking future uploads of the same file forever.

---

## Lifecycle Timeline (Exact Key)

```
transient:file:877963625cc54c59a8f5e8207a4acd32

PDF stored by API:         T+0s
  • setex(file_key, 300, b64_data)  ← TTL=300s starts

Job enqueued:              T+0s (same request)

Worker A claimed job:      T+Xs (X < 300)

Worker A: GET file_key     → bytes returned (success)
Worker A: DELETE file_key  → KEY GONE (unconditional, bug)
Worker A: processing fails → exception raised

fail_job() called:         → retries < 3, requeues job

Worker B claimed job:      T+Ys

Worker B: GET file_key     → None (key deleted by Worker A)
Worker B: DELETE file_key  → no-op
Worker B: check            → None → FileNotFoundError raised

→ After 3 retries: DLQ
→ Frontend SSE receives FAILED status
→ api.ts:77 → reject(new Error(errData.error))
```

---

## Deletion Map — Every Code Path That Can Delete `transient:file:*`

| Path | Function | When | Why |
|------|----------|------|-----|
| **worker.py:18** (OLD BUG) | `handle_parse_job()` | After first GET, before null-check | "Aggressive purge" — unconditional |
| **worker.py:99** (NEW FIX) | `handle_parse_job()` | After result persisted and status=COMPLETE | Correct lifecycle cleanup |
| **Redis TTL** | Automatic | 300s after `setex` | Auto-expiry if worker never claims |
| **Redis eviction** | Automatic | Only if maxmemory reached + eviction policy allows | Memory pressure |

No other code path deletes `transient:file:*` keys. The API, `queue_manager.py`, `jobs.py`, and all other routers do not touch these keys.

---

## Explicit Delete vs Expiration vs Eviction

| Mechanism | Source | Distinguishing evidence |
|-----------|--------|------------------------|
| **Explicit DELETE** | `worker.py` old bug | Key gone immediately after first worker claim; no TTL countdown |
| **TTL expiration** | Redis automatic | Key survives until exactly 300s after creation |
| **Memory eviction** | Redis | Only if `maxmemory` set AND eviction policy is LRU/LFU/volatile-* |

Local Redis (`redis://localhost:6379`) typically runs without `maxmemory` configuration, so memory eviction was **not** the cause. The deletion was explicit (the bug).

---

## Fix Applied

### Fix 1: worker.py — Correct Lifecycle Order

**File**: [`backend/worker.py`](file:///home/yenigandlamanojkumar/Desktop/Flashresume/backend/worker.py)

```python
# NEW (CORRECT) lifecycle
raw_value = await redis_client.get(file_key)    # Step 1: GET only

if not raw_value:                                # Step 2: check FIRST
    raise FileNotFoundError(...)                 # key truly absent (TTL expired or prev success deleted it)

file_bytes = base64.b64decode(raw_value)         # Step 3: decode

# Step 4: parse PDF (key still present in Redis — retry can still use it)
result = extract_resume_text(file_bytes)

# Step 5+6: persist result, then mark COMPLETE
await redis_client.hset(f"job:data:{job_id}", "result", json.dumps(final_result))
await queue_manager.update_job_status(job_id, "COMPLETE")

# Step 7: DELETE only after result is safely persisted
await redis_client.delete(file_key)              # safe to remove now
```

On any exception, the `except` block re-raises without deleting the key. The retry finds the key still present and can succeed.

### Fix 2: parse.py — Atomic Idempotency Claim

**File**: [`backend/routers/parse.py`](file:///home/yenigandlamanojkumar/Desktop/Flashresume/backend/routers/parse.py)

```python
# NEW (CORRECT) — single atomic SET NX EX
is_first = await redis_client.set(idempotency_key, job_id, nx=True, ex=3600)
```

Replaces the two-step `setnx` + `setex` that had a crash window between them.

**New API operation order**:
1. `setex(file_key, 300, b64_data)` — store file first
2. `SET idempotency_key job_id NX EX 3600` — claim slot atomically
3. `enqueue()` — only after both are committed

---

## Retry Semantics (Post-Fix)

| Scenario | Old behavior | New behavior |
|----------|-------------|--------------|
| Worker completes successfully | Key deleted immediately after GET (before process) | Key deleted after result persisted + COMPLETE status set |
| Worker crashes before parsing | Key deleted by crash → retry fails | Key **not** deleted → retry succeeds |
| Worker crashes after result saved | Key may linger up to TTL | Key deleted by next successful attempt or TTL expiry |
| Job retried 3 times, all fail | Always FileNotFoundError (key gone) | Only fails if TTL expired (300s > retry interval) |
| TTL expires before any worker | FileNotFoundError (same message) | FileNotFoundError (same message) — bounded, correct failure |

---

## Central Invariant (Now Satisfied)

> A valid queued job must retain access to its required PDF until the job has either:
> 1. Completed successfully, or
> 2. Been permanently classified as unrecoverable.

The key now survives across retries. It is only deleted after confirmed success, or naturally by TTL if all retries are exhausted (DLQ path).

---

## Test Results

```
============================================================
Transient PDF Lifecycle Test Suite
Redis URL: redis://localhost:6379
============================================================
Redis connection OK

[TEST 1] Normal lifecycle (store -> retrieve -> process -> delete)   PASSED
[TEST 2] Retry after worker crash (key survives crash)               PASSED
[TEST 3] OLD BUG reproduction: DELETE before check kills retry       PASSED (bug confirmed)
[TEST 4] TTL expiration — controlled failure                         PASSED
[TEST 5] Concurrent deduplication (10 parallel submissions)          PASSED
[TEST 6] SHA-256 integrity chain (API -> Redis b64 -> Worker decode) PASSED

Results: 6 passed, 0 failed
============================================================
```

---

## Acceptance Gates Status

| Gate | Status |
|------|--------|
| Exact failed `file_key` traced | ✅ |
| Root cause identified | ✅ DELETE before null-check on line 18 |
| API storage confirmed | ✅ `setex(file_key, 300, b64_data)` |
| Queue payload confirmed | ✅ `file_key` passed as-is in payload dict |
| Worker file_key confirmed | ✅ `payload.get("file_key")` — no transformation |
| API and Worker Redis config identical | ✅ Both use same `redis_client` module, same `REDIS_URL` |
| Key creation confirmed | ✅ `uuid4().hex`, cryptographically random, no reuse |
| TTL measured | ✅ 300s at creation |
| Deletion sources identified | ✅ Only worker (on success) or Redis TTL |
| Explicit vs TTL vs eviction distinguished | ✅ Was explicit (bug) |
| Retry semantics audited | ✅ Requeue via `fail_job → rpush QUEUE_PENDING` |
| Crash-after-retrieval tested | ✅ Test 2 |
| Idempotency interaction tested | ✅ Test 5, secondary fix applied |
| Worker retrieves exact PDF | ✅ Test 6 |
| SHA-256 chain intact | ✅ `e0abdde556e7ba8412eb72737aa69c9e244d699806d4e41110ce2f17d6cc9663` |
| Parser receives valid PDF | ✅ 2-layer orchestrator (pypdfium2 → pdfplumber) unchanged |
| Transient PDF eventually cleaned | ✅ On success or TTL expiry |
| Missing payload fails bounded | ✅ Max 3 retries → DLQ |
| Real browser workflow | ⬜ Pending — restart worker and test with browser |

---

## Files Modified

| File | Change |
|------|--------|
| [`backend/worker.py`](file:///home/yenigandlamanojkumar/Desktop/Flashresume/backend/worker.py) | Fixed `handle_parse_job` lifecycle: DELETE moved to after result persisted |
| [`backend/routers/parse.py`](file:///home/yenigandlamanojkumar/Desktop/Flashresume/backend/routers/parse.py) | Fixed `setnx+setex` race → single atomic `SET NX EX`; reordered file-first, then idempotency, then enqueue |
| [`backend/test_transient_pdf_lifecycle.py`](file:///home/yenigandlamanojkumar/Desktop/Flashresume/backend/test_transient_pdf_lifecycle.py) | New: 6-test lifecycle validation suite |
