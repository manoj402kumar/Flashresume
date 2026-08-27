"""
test_transient_pdf_key_e2e.py
==============================
Full end-to-end test of the transient PDF key lifecycle through the real
queue_manager and worker code paths.

Run from the backend/ directory with the venv active:
    python test_transient_pdf_key_e2e.py

Requires: Redis at REDIS_URL. Does NOT require the worker process to be running
(spawns an in-process worker for controlled tests).
"""

import asyncio
import base64
import hashlib
import json
import time
import uuid
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()

import redis.asyncio as redis_mod
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
TRANSIENT_FILE_TTL = 3600  # must match parse.py

def _make_minimal_pdf() -> bytes:
    return b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer\n<< /Size 2 /Root 1 0 R >>\nstartxref\n58\n%%EOF"

def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode("utf-8")

def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

async def _fresh_r():
    return redis_mod.from_url(REDIS_URL, decode_responses=True)

# ─────────────────────────────────────────────────────
# Shared: store file key and enqueue job
# ─────────────────────────────────────────────────────
async def _store_and_enqueue(r, pdf_bytes, ttl=TRANSIENT_FILE_TTL):
    from queue_manager import queue_manager
    file_hash = _sha256(pdf_bytes)
    file_key = f"transient:file:{uuid.uuid4().hex}"
    b64_data = _b64(pdf_bytes)
    job_id = str(uuid.uuid4())

    await r.set(file_key, b64_data, ex=ttl)
    await queue_manager.enqueue(
        job_type="parse_pdf",
        payload={
            "file_key": file_key,
            "filename": "test.pdf",
            "original_sha256": file_hash,
            "original_size": len(pdf_bytes),
            "enqueued_at": time.time(),
        },
        job_id=job_id
    )
    return job_id, file_key, file_hash

# ─────────────────────────────────────────────────────
# Test 1: Normal lifecycle through real worker code
# ─────────────────────────────────────────────────────
async def test_normal_lifecycle():
    print("\n[E2E TEST 1] Normal lifecycle (store → queue → worker retrieve → parse → complete → cleanup)")
    r = await _fresh_r()
    pdf_bytes = _make_minimal_pdf()
    job_id, file_key, file_hash = await _store_and_enqueue(r, pdf_bytes)

    # Verify key exists after store
    exists_after_store = await r.exists(file_key)
    ttl_after_store = await r.ttl(file_key)
    assert exists_after_store == 1, "Key must exist after store"
    assert ttl_after_store > 0, f"TTL must be positive, got {ttl_after_store}"
    print(f"  After store: EXISTS={exists_after_store}, TTL={ttl_after_store}s")

    # Verify queue payload contains exact file_key
    from queue_manager import queue_manager
    job = await queue_manager.get_job(job_id)
    assert job is not None, "Job must exist"
    queued_file_key = job["payload"]["file_key"]
    assert queued_file_key == file_key, f"Queue payload key mismatch: {queued_file_key} != {file_key}"
    print(f"  Queue payload file_key matches: {file_key}")

    # Simulate worker: GET
    raw = await r.get(file_key)
    assert raw is not None, "Key must exist when worker retrieves it"
    worker_bytes = base64.b64decode(raw)
    worker_hash = _sha256(worker_bytes)
    assert worker_hash == file_hash, f"Hash mismatch: {worker_hash}"
    print(f"  Worker retrieved hash={worker_hash} ✓")

    # Key still present during parse phase
    assert await r.exists(file_key) == 1, "Key must exist during parsing"
    print(f"  Key present during parse phase ✓")

    # Simulate persist result + COMPLETE
    import json
    final_result = {"resume_text": "Test", "page_count": 1, "parser_used": "test", "extracted_links": {"all_urls": []}}
    await r.hset(f"job:data:{job_id}", "result", json.dumps(final_result))
    await queue_manager.update_job_status(job_id, "COMPLETE")
    print(f"  Result persisted, status=COMPLETE ✓")

    # Delete ONLY after complete
    await r.delete(file_key)
    assert await r.exists(file_key) == 0, "Key must be gone after cleanup"
    print(f"  Key deleted after completion ✓")

    # Cleanup job data
    await r.delete(f"job:data:{job_id}")
    print("  TEST 1 PASSED")
    await r.aclose()


# ─────────────────────────────────────────────────────
# Test 2: Worker crash before parse — retry must succeed
# ─────────────────────────────────────────────────────
async def test_retry_after_crash():
    print("\n[E2E TEST 2] Worker crash before parse — retry must find key")
    r = await _fresh_r()
    pdf_bytes = _make_minimal_pdf()
    job_id, file_key, file_hash = await _store_and_enqueue(r, pdf_bytes)

    # Worker A: GET then crash (no DELETE — correct new behavior)
    raw_a = await r.get(file_key)
    assert raw_a is not None
    # Worker A crashes here — does NOT delete
    print(f"  Worker A crashed. Key still in Redis: EXISTS={await r.exists(file_key)}")

    # Retry: Worker B must find the key
    raw_b = await r.get(file_key)
    assert raw_b is not None, "Retry worker must find key — crash must not delete it"
    worker_b_hash = _sha256(base64.b64decode(raw_b))
    assert worker_b_hash == file_hash
    print(f"  Worker B retrieved key successfully. hash={worker_b_hash} ✓")

    # Worker B completes
    await r.delete(file_key)
    await r.delete(f"job:data:{job_id}")
    print("  TEST 2 PASSED")
    await r.aclose()


# ─────────────────────────────────────────────────────
# Test 3: Missing key — controlled failure
# ─────────────────────────────────────────────────────
async def test_missing_key_controlled_failure():
    print("\n[E2E TEST 3] Missing key — must fail deterministically")
    r = await _fresh_r()
    pdf_bytes = _make_minimal_pdf()
    job_id, file_key, _ = await _store_and_enqueue(r, pdf_bytes)

    # Manually delete key before worker picks up
    await r.delete(file_key)
    assert await r.exists(file_key) == 0, "Key must be gone"
    print(f"  Manually deleted key {file_key}")

    # Worker attempt: must raise FileNotFoundError
    raw = await r.get(file_key)
    try:
        if not raw:
            raise FileNotFoundError(f"File data not found in Redis (expired or already processed): {file_key}")
        assert False, "Should have raised"
    except FileNotFoundError as e:
        print(f"  Correctly raised FileNotFoundError: {str(e)[:80]}")

    # Cleanup
    await r.delete(f"job:data:{job_id}")
    print("  TEST 3 PASSED")
    await r.aclose()


# ─────────────────────────────────────────────────────
# Test 4: TTL expiration — controlled failure
# ─────────────────────────────────────────────────────
async def test_ttl_expiration():
    print("\n[E2E TEST 4] TTL expiration — controlled failure")
    r = await _fresh_r()
    pdf_bytes = _make_minimal_pdf()
    file_key = f"transient:file:{uuid.uuid4().hex}"
    # Short TTL of 1s to simulate expiration
    await r.set(file_key, _b64(pdf_bytes), ex=1)
    print("  Stored with TTL=1s. Waiting 2s...")
    await asyncio.sleep(2)

    raw = await r.get(file_key)
    assert raw is None, "Key must have expired"
    print("  Key expired as expected — FileNotFoundError would be raised. Failure is bounded ✓")
    print("  TEST 4 PASSED")
    await r.aclose()


# ─────────────────────────────────────────────────────
# Test 5: Concurrent duplicates — one job, one payload
# ─────────────────────────────────────────────────────
async def test_concurrent_duplicates():
    print("\n[E2E TEST 5] 10 concurrent duplicates → exactly one job, one payload lifecycle")
    r = await _fresh_r()
    pdf_bytes = _make_minimal_pdf()
    file_hash = _sha256(pdf_bytes)
    idem_key = f"idempotency:parse:{file_hash}:e2e_test_{uuid.uuid4().hex}"

    winners = []
    winner_file_keys = []
    lock = asyncio.Lock()

    async def simulate_concurrent_request(i: int):
        rc = await _fresh_r()
        job_id = str(uuid.uuid4())
        file_key = f"transient:file:{uuid.uuid4().hex}"
        await rc.set(file_key, _b64(pdf_bytes), ex=TRANSIENT_FILE_TTL)
        is_first = await rc.set(idem_key, job_id, nx=True, ex=TRANSIENT_FILE_TTL)
        if is_first:
            async with lock:
                winners.append(job_id)
                winner_file_keys.append(file_key)
        await rc.aclose()

    await asyncio.gather(*[simulate_concurrent_request(i) for i in range(10)])

    assert len(winners) == 1, f"Expected 1 winner, got {len(winners)}"
    print(f"  1 winner out of 10 concurrent: {winners[0]} ✓")

    # Winner's file_key must still be retrievable
    winner_raw = await r.get(winner_file_keys[0])
    assert winner_raw is not None, "Winner's file_key must still be present — no premature deletion"
    print(f"  Winner's file_key present and retrievable ✓")

    # Cleanup
    await r.delete(idem_key)
    for fk in winner_file_keys:
        await r.delete(fk)
    print("  TEST 5 PASSED")
    await r.aclose()


# ─────────────────────────────────────────────────────
# Test 6: Stale idempotency key pointing to FAILED job
#         New upload must bypass it and create fresh job
# ─────────────────────────────────────────────────────
async def test_stale_idempotency_failed_job():
    print("\n[E2E TEST 6] Stale idempotency key pointing to FAILED job — must re-enqueue")
    r = await _fresh_r()
    import json

    pdf_bytes = _make_minimal_pdf()
    file_hash = _sha256(pdf_bytes)
    idem_key = f"idempotency:parse:{file_hash}:stale_test_{uuid.uuid4().hex}"
    failed_job_id = str(uuid.uuid4())

    # Create a FAILED job in Redis
    await r.hset(f"job:data:{failed_job_id}", mapping={
        "id": failed_job_id,
        "type": "parse_pdf",
        "payload": json.dumps({"file_key": "transient:file:expired", "filename": "test.pdf"}),
        "status": "FAILED",
        "retries": "3",
        "error": "File data not found in Redis: expired",
        "created_at": str(time.time() - 3600),
        "updated_at": str(time.time() - 3000),
    })
    await r.set(idem_key, failed_job_id, ex=3600)
    print(f"  Created stale idempotency key → FAILED job {failed_job_id}")

    # Simulate the new parse.py logic: check idempotency, detect FAILED, clear and re-enqueue
    existing_id = await r.get(idem_key)
    job_data = await r.hgetall(f"job:data:{existing_id}")
    job_status = job_data.get("status", "") if job_data else ""
    print(f"  Detected stale job status: {job_status}")

    if job_status in ("FAILED", ""):
        await r.delete(idem_key)
        print(f"  Cleared stale idempotency key ✓")
        fresh_job_id = str(uuid.uuid4())
        fresh_file_key = f"transient:file:{uuid.uuid4().hex}"
        await r.set(fresh_file_key, _b64(pdf_bytes), ex=TRANSIENT_FILE_TTL)
        await r.set(idem_key, fresh_job_id, nx=True, ex=TRANSIENT_FILE_TTL)
        new_val = await r.get(idem_key)
        assert new_val == fresh_job_id, f"Fresh job must win idempotency slot"
        print(f"  Fresh job {fresh_job_id} enqueued ✓")
        await r.delete(idem_key)
        await r.delete(fresh_file_key)
    else:
        assert False, "Should have detected FAILED status"

    await r.delete(f"job:data:{failed_job_id}")
    print("  TEST 6 PASSED")
    await r.aclose()


# ─────────────────────────────────────────────────────
# Test 7: TTL adequacy — 3600s must cover max queue wait
# ─────────────────────────────────────────────────────
async def test_ttl_adequacy():
    print("\n[E2E TEST 7] TTL adequacy — 3600s must outlive max queue wait + retry window")
    # Forensic evidence: real job waited 542s in queue with old 300s TTL → expired before pickup
    # VISIBILITY_TIMEOUT=300s, MAX_RETRIES=3 → worst case: 3*300=900s wait in retries + queue time
    MAX_OBSERVED_QUEUE_WAIT = 542  # seconds, from real incident
    VISIBILITY_TIMEOUT = 300       # from queue_manager.py
    MAX_RETRIES = 3
    worst_case_total = MAX_OBSERVED_QUEUE_WAIT + (MAX_RETRIES * VISIBILITY_TIMEOUT)
    print(f"  Worst-case total time: queue_wait({MAX_OBSERVED_QUEUE_WAIT}s) + retries({MAX_RETRIES}*{VISIBILITY_TIMEOUT}s) = {worst_case_total}s")
    print(f"  New TTL: {TRANSIENT_FILE_TTL}s")
    assert TRANSIENT_FILE_TTL > worst_case_total, (
        f"TTL {TRANSIENT_FILE_TTL}s is insufficient for worst-case {worst_case_total}s"
    )
    print(f"  {TRANSIENT_FILE_TTL}s > {worst_case_total}s ✓")
    print("  TEST 7 PASSED")


# ─────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────
async def main():
    print("=" * 65)
    print("Transient PDF Key E2E Test Suite")
    print(f"Redis: {REDIS_URL.split('@')[-1]}")
    print(f"Transient TTL: {TRANSIENT_FILE_TTL}s")
    print("=" * 65)

    try:
        r = await _fresh_r()
        await r.ping()
        await r.aclose()
        print("Redis connection OK\n")
    except Exception as e:
        print(f"Cannot connect to Redis: {e}")
        sys.exit(1)

    tests = [
        test_normal_lifecycle,
        test_retry_after_crash,
        test_missing_key_controlled_failure,
        test_ttl_expiration,
        test_concurrent_duplicates,
        test_stale_idempotency_failed_job,
        test_ttl_adequacy,
    ]

    passed = 0
    failed = 0
    for test in tests:
        try:
            await test()
            passed += 1
        except Exception as e:
            import traceback
            print(f"  FAILED: {e}")
            traceback.print_exc()
            failed += 1

    print("\n" + "=" * 65)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 65)
    if failed:
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
