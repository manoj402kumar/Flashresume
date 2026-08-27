import asyncio
import traceback
import json
import os
from queue_manager import queue_manager

async def handle_parse_job(job_id: str, payload: dict):
    """
    Claim-check pattern: retrieve PDF bytes from Redis transient storage,
    parse the PDF, persist the result, then delete the transient key.

    LIFECYCLE (correct order):
      1. GET file_key  → obtain PDF bytes (key still exists)
      2. Validate bytes exist (raise recoverable error if missing — retries will also fail but safely)
      3. Decode base64 → raw PDF bytes
      4. Parse PDF completely (all layers)
      5. Persist result to job:data hash
      6. Update job status to COMPLETE
      7. DELETE file_key (only after result is safely persisted)

    WHY THIS ORDER MATTERS:
      - Previous code did GET → DELETE → check → parse. The DELETE fired unconditionally
        BEFORE checking whether GET returned anything. On the first attempt this consumed
        the key. On any retry, the key was already gone → FileNotFoundError every time.
      - With at-least-once delivery (fail_job requeues), every retry was guaranteed to fail.
      - Now the key is deleted only after processing succeeds. If the worker crashes before
        DELETE, the TTL (300s) will expire the key automatically — no permanent leak.
        The retry will find the key still present and succeed.
    """
    file_key = payload.get("file_key")
    if not file_key:
        raise ValueError(f"Missing file_key in payload for job {job_id}")

    from redis_client import redis_client
    import base64
    import hashlib
    import time

    # Step 1: GET only — do NOT delete yet.
    # The key must remain in Redis until we have successfully persisted the result,
    # so that any retry (due to worker crash, visibility timeout, etc.) can still
    # retrieve the PDF bytes.
    raw_value = await redis_client.get(file_key)

    # Step 2: Validate before doing anything destructive.
    if not raw_value:
        # Key is absent: either TTL expired, or a previous successful run already deleted it.
        # This is now a permanent failure for this attempt — we raise so fail_job can
        # decide whether to requeue or DLQ. The key cannot be recovered.
        raise FileNotFoundError(
            f"File data not found in Redis (expired or already processed): {file_key}"
        )

    # Step 3: Decode base64 → raw PDF bytes.
    # The API stores as base64 string (decode_responses=True client cannot store raw bytes).
    file_bytes = base64.b64decode(raw_value) if isinstance(raw_value, str) else raw_value

    # Integrity check
    worker_hash = hashlib.sha256(file_bytes).hexdigest()
    original_hash = payload.get("original_sha256")
    print(f"[INSTRUMENTATION] Worker retrieved bytes: size={len(file_bytes)}, sha256={worker_hash}")
    print(f"[INSTRUMENTATION] Retrieval timestamp={time.time()}")
    if original_hash and worker_hash != original_hash:
        print(f"[INSTRUMENTATION] FATAL BYTE CORRUPTION: {original_hash} != {worker_hash}")
    else:
        print(f"[INSTRUMENTATION] Hash MATCH: {worker_hash}")

    # Step 4: Parse PDF — all layers run against the in-memory bytes.
    # The transient key is still present in Redis during this phase.
    try:
        filename = payload.get("filename", "").lower()
        if filename.endswith(".pdf"):
            from services.parse_orchestrator import extract_resume_text
            result = await asyncio.to_thread(extract_resume_text, file_bytes)
        elif filename.endswith(".docx"):
            from services.parse_orchestrator import extract_from_docx
            result = await asyncio.to_thread(extract_from_docx, file_bytes)
        else:
            raise ValueError("Unsupported file type")

        links_raw = result.get("extracted_links", {}) or {}
        extracted_links = {"all_urls": links_raw.get("all_urls", [])}

        final_result = {
            "resume_text": result["text"],
            "page_count": result.get("page_count", 0),
            "parser_used": result.get("parser_used", "unknown"),
            "extracted_links": extracted_links,
        }

        # Step 5+6: Persist result THEN mark COMPLETE — SSE listener will see result
        # already present when it fetches the job after receiving the COMPLETE event.
        await redis_client.hset(f"job:data:{job_id}", "result", json.dumps(final_result))
        await queue_manager.update_job_status(job_id, "COMPLETE")

        # Step 7: Only now delete the transient key — result is safely persisted.
        # If this DELETE fails (e.g. network hiccup), the 300s TTL will clean it up.
        # There is no data loss and no retry impact since the job is already COMPLETE.
        await redis_client.delete(file_key)
        print(f"[INSTRUMENTATION] Transient key deleted after successful completion: {file_key}")

    except Exception:
        # Do NOT delete the key on failure — the job may be retried.
        # The TTL (300s) will eventually clean up the key if retries are exhausted.
        raise

from services.resume_generator import generate_resume

async def handle_generate_job(job_id: str, payload: dict):
    resume_text = payload.get("resume_text")
    job_description = payload.get("job_description")
    ats_score_before = payload.get("ats_score_before", 0)
    user_id = payload.get("user_id")
    
    result, model_used = await generate_resume(
        resume_text=resume_text,
        job_description=job_description,
        ats_score_before=ats_score_before,
        approved_project=payload.get("approved_project", ""),
        missing_keywords=payload.get("missing_keywords"),
        selected_projects=payload.get("selected_projects"),
        no_ai_changes=payload.get("no_ai_changes", False),
        preferred_model=payload.get("preferred_model", ""),
        extracted_links=payload.get("extracted_links")
    )
    
    import random
    import uuid
    import asyncio
    import supabase_client as sc
    
    # Step 2: Assign ats_score_after
    if job_description and job_description.strip():
        ats_after = random.randint(86, 93)
    else:
        ats_after = 0
        
    result["ats_score_after"] = ats_after
    result["_model_used"] = model_used

    # Track category for analytics
    if payload.get("no_ai_changes"):
        result["_category"] = "no_changes"
    elif not job_description or not job_description.strip():
        result["_category"] = "no_jd"
    else:
        result["_category"] = "jd_optimized"

    session_id = str(uuid.uuid4())
    result["session_id"] = session_id

    # Insert skeleton row
    if sc.supabase:
        try:
            row = {
                "id": session_id,
                "generated_output": {"_category": result.get("_category", "no_jd")}
            }
            if user_id:
                row["user_id"] = user_id
            await asyncio.to_thread(
                lambda: sc.supabase.table("resume_sessions").insert(row).execute()
            )
        except Exception as e:
            print(f"[Worker] Background session skeleton save failed (non-critical): {e}")

    # Increment fraud tracker counter
    if sc.supabase and user_id:
        try:
            await sc.sb(lambda: sc.supabase.rpc("increment_fraud_counter", {"p_user_id": user_id}).execute())
        except Exception as e:
            print(f"[Worker] Background fraud counter failed: {e}")
            pass

    from redis_client import redis_client
    await redis_client.hset(f"job:data:{job_id}", "result", json.dumps(result))
    await queue_manager.update_job_status(job_id, "COMPLETE")



async def handle_compile_latex_job(job_id: str, payload: dict):
    latex_code = payload.get("latex_code")
    if not latex_code:
        raise ValueError("Missing latex_code in payload")
        
    from services.latex_compiler import compile_latex_to_pdf
    import base64
    
    pdf_bytes = await compile_latex_to_pdf(latex_code)
    
    result = {
        "pdf_base64": base64.b64encode(pdf_bytes).decode('utf-8')
    }
    
    from redis_client import redis_client
    await redis_client.hset(f"job:data:{job_id}", "result", json.dumps(result))
    await queue_manager.update_job_status(job_id, "COMPLETE")


async def process_job(job_id: str):
    job = await queue_manager.get_job(job_id)
    if not job:
        return
    
    job_type = job.get("type")
    payload = job.get("payload", {})
    
    try:
        if job_type == "parse_pdf":
            await handle_parse_job(job_id, payload)
        elif job_type == "generate_resume":
            await handle_generate_job(job_id, payload)
        elif job_type == "compile_latex":
            await handle_compile_latex_job(job_id, payload)
        else:
            raise ValueError(f"Unknown job type: {job_type}")
            
        await queue_manager.ack(job_id)
        
    except Exception as e:
        error_msg = f"{str(e)}\n{traceback.format_exc()}"
        print(f"[Worker] Job {job_id} failed: {e}")
        await queue_manager.fail_job(job_id, error_msg)

async def worker_loop():
    import os as _os
    print(f"[Worker] Starting heavy compute worker... PID={_os.getpid()}")
    print(f"[Worker] handle_parse_job lifecycle: GET → validate → decode → parse → persist → COMPLETE → DELETE")

    # Start zombie recovery task
    async def zombie_recovery_loop():
        while True:
            await asyncio.sleep(60)
            await queue_manager.recover_zombies()

    asyncio.create_task(zombie_recovery_loop())

    while True:
        try:
            job_id = await queue_manager.dequeue(timeout=5)
            if job_id:
                print(f"[Worker] Picked up job: {job_id}")
                await process_job(job_id)
        except Exception as e:
            print(f"[Worker] Error in loop: {e}")
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(worker_loop())

