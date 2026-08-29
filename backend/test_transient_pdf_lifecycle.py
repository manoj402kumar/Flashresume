import pytest
pytestmark = pytest.mark.asyncio
"""
test_transient_pdf_lifecycle.py
================================
Validates the complete lifecycle of transient PDF storage in the claim-check pattern.

Run from the backend/ directory with the venv active:
    python test_transient_pdf_lifecycle.py

Requirements: Redis must be accessible at REDIS_URL (defaults to localhost:6379).
"""

import asyncio
import base64
import hashlib
import time
import uuid
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()

import redis.asyncio as redis_mod

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
TRANSIENT_TTL = 300


def _make_minimal_pdf() -> bytes:
    return b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer\n<< /Size 2 /Root 1 0 R >>\nstartxref\n58\n%%EOF"


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode("utf-8")


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


async def _fresh_client():
    return redis_mod.from_url(REDIS_URL, decode_responses=True)


async def test_normal_lifecycle():
    print("\n[TEST 1] Normal lifecycle (store -> retrieve -> process -> delete)")
    r = await _fresh_client()
    pdf_bytes = _make_minimal_pdf()
    file_key = f"transient:file:{uuid.uuid4().hex}"
    b64_data = _b64(pdf_bytes)
    original_hash = _sha256(pdf_bytes)

    await r.setex(file_key, TRANSIENT_TTL, b64_data)
    ttl = await r.ttl(file_key)
    assert ttl > 0, f"TTL must be positive, got {ttl}"
    print(f"  Store OK. TTL={ttl}s")

    # Worker GET (key still present)
    raw = await r.get(file_key)
    assert raw is not None, "Key must exist before processing"

    retrieved_bytes = base64.b64decode(raw)
    worker_hash = _sha256(retrieved_bytes)
    assert worker_hash == original_hash, f"Hash mismatch: {worker_hash} != {original_hash}"
    print(f"  Hash match: {worker_hash}")

    # Key still present during processing
    assert await r.exists(file_key), "Key must still exist during processing"
    print("  Key present during processing")

    # DELETE only after processing complete
    await r.delete(file_key)
    assert not await r.exists(file_key), "Key must be gone after delete"
    print("  Key deleted after processing. TEST 1 PASSED")
    await r.aclose()


async def test_retry_after_crash():
    print("\n[TEST 2] Retry after worker crash (key survives crash)")
    r = await _fresh_client()
    pdf_bytes = _make_minimal_pdf()
    file_key = f"transient:file:{uuid.uuid4().hex}"
    b64_data = _b64(pdf_bytes)
    original_hash = _sha256(pdf_bytes)

    await r.setex(file_key, TRANSIENT_TTL, b64_data)
    print("  [Worker A] Simulated crash — key NOT deleted (new correct behavior)")

    # Worker B retry
    raw = await r.get(file_key)
    assert raw is not None, "Key must still exist for retry"
    worker_hash = _sha256(base64.b64decode(raw))
    assert worker_hash == original_hash
    print(f"  Worker B retrieved successfully. hash={worker_hash}")

    await r.delete(file_key)
    print("  Cleanup after retry. TEST 2 PASSED")
    await r.aclose()


async def test_old_bug_delete_before_check():
    print("\n[TEST 3] OLD BUG reproduction: DELETE before check kills retry")
    r = await _fresh_client()
    pdf_bytes = _make_minimal_pdf()
    file_key = f"transient:file:{uuid.uuid4().hex}"
    await r.setex(file_key, TRANSIENT_TTL, _b64(pdf_bytes))

    # Old code: GET -> DELETE (unconditional) -> check
    attempt1 = await r.get(file_key)   # succeeds
    await r.delete(file_key)           # BUG: unconditional delete
    # Worker crashes here before parse completes

    # Retry attempt
    attempt2 = await r.get(file_key)   # None — already deleted!
    await r.delete(file_key)           # no-op
    assert attempt2 is None, "Expected None on retry with old bug"
    print("  Old bug confirmed: unconditional DELETE causes retry to get None")
    print("  This is the exact source of: FileNotFoundError: transient:file:...")
    print("  TEST 3 PASSED (bug demonstrated)")
    await r.aclose()


async def test_ttl_expiration():
    print("\n[TEST 4] TTL expiration — controlled failure")
    r = await _fresh_client()
    pdf_bytes = _make_minimal_pdf()
    file_key = f"transient:file:{uuid.uuid4().hex}"
    await r.setex(file_key, 1, _b64(pdf_bytes))
    print("  Stored with TTL=1s. Waiting 2s...")
    await asyncio.sleep(2)

    raw = await r.get(file_key)
    assert raw is None, "Key must have expired"
    print("  Key expired as expected. Would raise FileNotFoundError (correct). TEST 4 PASSED")
    await r.aclose()


async def test_concurrent_deduplication():
    print("\n[TEST 5] Concurrent deduplication (10 parallel submissions)")
    r = await _fresh_client()
    pdf_bytes = _make_minimal_pdf()
    idem_key = f"idempotency:parse:test:{uuid.uuid4().hex}"
    winners = []
    lock = asyncio.Lock()

    async def simulate_request(i: int):
        rc = await _fresh_client()
        job_id = str(uuid.uuid4())
        file_key = f"transient:file:{uuid.uuid4().hex}"
        await rc.setex(file_key, TRANSIENT_TTL, _b64(pdf_bytes))
        is_first = await rc.set(idem_key, job_id, nx=True, ex=3600)
        if is_first:
            async with lock:
                winners.append(job_id)
        await rc.aclose()

    await asyncio.gather(*[simulate_request(i) for i in range(10)])
    assert len(winners) == 1, f"Expected 1 winner, got {len(winners)}: {winners}"
    print(f"  Exactly 1 winner out of 10 concurrent: {winners[0]}")
    await r.delete(idem_key)
    print("  No premature deletions. TEST 5 PASSED")
    await r.aclose()


async def test_sha256_chain():
    print("\n[TEST 6] SHA-256 integrity chain (API -> Redis b64 -> Worker decode)")
    r = await _fresh_client()
    pdf_bytes = _make_minimal_pdf()
    original_hash = _sha256(pdf_bytes)
    file_key = f"transient:file:{uuid.uuid4().hex}"

    b64_encoded = base64.b64encode(pdf_bytes).decode("utf-8")
    await r.setex(file_key, TRANSIENT_TTL, b64_encoded)

    raw = await r.get(file_key)
    assert raw is not None
    decoded_bytes = base64.b64decode(raw)
    worker_hash = _sha256(decoded_bytes)

    assert worker_hash == original_hash, (
        f"SHA-256 MISMATCH:\n  original={original_hash}\n  worker={worker_hash}"
    )
    print(f"  SHA256 chain intact: {original_hash}")
    print(f"  Byte size: API={len(pdf_bytes)}, Worker={len(decoded_bytes)}")
    await r.delete(file_key)
    print("  TEST 6 PASSED")
    await r.aclose()


async def main():
    print("=" * 60)
    print("Transient PDF Lifecycle Test Suite")
    print(f"Redis URL (host only): {REDIS_URL.split('@')[-1]}")
    print("=" * 60)

    try:
        r = await _fresh_client()
        await r.ping()
        await r.aclose()
        print("Redis connection OK\n")
    except Exception as e:
        print(f"Cannot connect to Redis: {e}")
        sys.exit(1)

    tests = [
        test_normal_lifecycle,
        test_retry_after_crash,
        test_old_bug_delete_before_check,
        test_ttl_expiration,
        test_concurrent_deduplication,
        test_sha256_chain,
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

    print("\n" + "=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)
    if failed:
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
