import asyncio
import time
import uuid
import sys
import os

# Append backend to sys.path so imports work
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from backend.queue_manager import queue_manager
from backend.redis_client import redis_client
from backend.llm.quota_manager import quota_manager
from backend.worker import handle_parse_job

async def test_token_bucket():
    print("\n--- Testing Token Bucket Concurrency ---")
    provider = "test_provider"
    max_rpm = 15
    
    # Reset bucket
    await redis_client.delete(f"llm_quota:rpm:{provider}")
    
    async def request_token(worker_id):
        return await quota_manager.consume(provider, max_rpm=max_rpm, requested=1)
        
    # Simulate 20 concurrent workers asking for tokens simultaneously
    results = await asyncio.gather(*(request_token(i) for i in range(20)))
    
    success_count = sum(1 for r in results if r)
    print(f"Tokens requested: 20, Tokens granted: {success_count}, Max RPM: {max_rpm}")
    
    assert success_count == 15, f"Expected 15 successes, got {success_count}"
    print("✓ Token Bucket successfully clamped concurrency at max_rpm atomically.")

async def test_idempotency_concurrency():
    print("\n--- Testing Idempotency Concurrency ---")
    
    # Simulate the router code for idempotency
    async def simulate_router_request(payload_hash):
        idempotency_key = f"idempotency:test:{payload_hash}"
        existing_job = await redis_client.get(idempotency_key)
        if existing_job:
            return existing_job
            
        job_id = str(uuid.uuid4())
        is_first = await redis_client.setnx(idempotency_key, job_id)
        if not is_first:
            return await redis_client.get(idempotency_key)
            
        await redis_client.setex(idempotency_key, 3600, job_id)
        # Simulate enqueue wait
        await asyncio.sleep(0.01) 
        return job_id

    payload_hash = "fake_hash_12345"
    await redis_client.delete(f"idempotency:test:{payload_hash}")
    
    # 10 simultaneous identical requests
    results = await asyncio.gather(*(simulate_router_request(payload_hash) for _ in range(10)))
    
    unique_job_ids = set(results)
    print(f"Total concurrent requests: 10, Unique Job IDs created: {len(unique_job_ids)}")
    
    assert len(unique_job_ids) == 1, "Concurrency leak! Multiple jobs created for same hash."
    print("✓ Idempotency atomically prevented duplicate job creation.")

async def test_zombie_recovery():
    print("\n--- Testing Queue Zombie Recovery ---")
    # Clean queues
    from backend.queue_manager import QUEUE_PENDING, QUEUE_PROCESSING
    await redis_client.delete(QUEUE_PENDING)
    await redis_client.delete(QUEUE_PROCESSING)
    
    # Create a job
    job_id = await queue_manager.enqueue("dummy_task", {"test": True})
    
    # Worker A claims it
    claimed_job_id = await queue_manager.dequeue(timeout=1)
    assert claimed_job_id == job_id
    
    # Artificially modify picked_up_at to simulate a 10-minute old crash
    old_time = time.time() - 600
    await redis_client.hset(f"job:data:{job_id}", "picked_up_at", old_time)
    
    # Run recovery script
    await queue_manager.recover_zombies()
    
    # Check if job is back in PENDING
    pending_len = await redis_client.llen(QUEUE_PENDING)
    processing_len = await redis_client.llen(QUEUE_PROCESSING)
    
    print(f"Pending queue length: {pending_len}, Processing length: {processing_len}")
    assert pending_len == 1, "Zombie task was not moved back to PENDING!"
    assert processing_len == 0, "Zombie task was not removed from PROCESSING!"
    
    # Ensure retries incremented
    job_data = await queue_manager.get_job(job_id)
    assert job_data["retries"] == 1
    assert job_data["status"] == "RETRYING"
    print("✓ Zombie recovery successfully recovered the crashed task.")

async def test_claim_check():
    print("\n--- Testing Cross-Container Claim-Check ---")
    import base64
    
    file_bytes = b"fake pdf content"
    file_key = f"transient:file:{uuid.uuid4().hex}"
    b64_data = base64.b64encode(file_bytes).decode('utf-8')
    
    # API Container sets it
    await redis_client.setex(file_key, 300, b64_data)
    
    # Job payload
    payload = {"file_key": file_key, "filename": "test.pdf"}
    
    # We call the worker's handle function directly, passing only the payload.
    # Note: handle_parse_job expects real PDF, so extract_resume_text will fail.
    # Let's catch the ValueError/Exception to verify it successfully read and DELETED the key.
    
    key_exists_before = await redis_client.exists(file_key)
    assert key_exists_before == 1
    print("Transient file stored in Redis.")
    
    try:
        await handle_parse_job("fake_job_id", payload)
    except Exception as e:
        # We expect a PyMuPDF / PDFPlumber error because b"fake pdf content" is not a valid PDF.
        print(f"Worker naturally failed on fake PDF: {type(e).__name__}")
        
    key_exists_after = await redis_client.exists(file_key)
    print(f"Transient file exists after worker: {key_exists_after}")
    assert key_exists_after == 0, "Worker failed to clean up transient file!"
    print("✓ Claim-check transient payload successfully purged.")

async def run_all():
    await test_token_bucket()
    await test_idempotency_concurrency()
    await test_zombie_recovery()
    await test_claim_check()
    print("\nAll runtime proofs passed successfully.")

if __name__ == "__main__":
    asyncio.run(run_all())
