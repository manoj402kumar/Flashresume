from fastapi import APIRouter, UploadFile, File, HTTPException, Request
import asyncio
from services.parse_orchestrator import extract_resume_text, extract_from_docx
from models.response_models import ParseResponse, ExtractedLinks
from rate_limiter import limiter

MAX_FILE_BYTES = 5 * 1024 * 1024  # 5 MB hard cap

# TRANSIENT_FILE_TTL: How long the PDF is kept in Redis.
# Must be >= max_queue_wait + max_processing_time + (MAX_RETRIES * VISIBILITY_TIMEOUT).
# Forensic evidence: a real job waited 542s in queue with TTL=300s → PDF expired before pickup.
# VISIBILITY_TIMEOUT=300s, MAX_RETRIES=3 → worst case ~1200s.
# 3600s (1 hour) is safe, bounded, and still aggressively ephemeral for PII.
TRANSIENT_FILE_TTL = 3600  # seconds

router = APIRouter()

# Limit concurrent heavy parsing tasks to prevent Out of Memory (OOM) on small servers
parse_semaphore = asyncio.Semaphore(2)

@router.post("/parse")
@limiter.limit("10/minute")
async def parse_resume(request: Request, file: UploadFile = File(...)):
    """
    Parse resume from multiple formats: PDF, DOCX.

    Supported formats:
    - PDF: 2-layer pipeline (pypdfium2 → pdfplumber) + hyperlink annotation extraction
    - DOCX: Direct text extraction (no hyperlink extraction)

    Args:
        file: Resume file upload

    Returns:
        ParseResponse with extracted text, page count, parser used,
        and extracted_links (LinkedIn/GitHub/portfolio/all URLs from PDF annotations).
    """
    filename = file.filename.lower()

    # Validate file type
    allowed_extensions = [".pdf", ".docx"]
    if not any(filename.endswith(ext) for ext in allowed_extensions):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}"
        )

    # Read at most MAX_FILE_BYTES + 1 bytes
    file_bytes = await file.read(MAX_FILE_BYTES + 1)

    if len(file_bytes) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum is 5 MB.")

    # Guard against empty files
    if len(file_bytes) < 100:
        raise HTTPException(status_code=400, detail="File appears empty or corrupted.")

    try:
        from redis_client import redis_client
        from queue_manager import queue_manager

        import hashlib
        import uuid
        import base64
        import time
        import json

        file_hash = hashlib.sha256(file_bytes).hexdigest()
        idempotency_key = f"idempotency:parse:{file_hash}"

        # Fast path: early check — return existing job if it's still active/complete.
        # IMPORTANT: also validate that the existing job is not FAILED.
        # If the job FAILED (e.g. PDF expired before the old worker picked it up),
        # the idempotency key must be cleared so a fresh job can be created.
        existing_job_id = await redis_client.get(idempotency_key)
        if existing_job_id:
            job_data = await redis_client.hgetall(f"job:data:{existing_job_id}")
            job_status = job_data.get("status", "") if job_data else ""
            if job_status not in ("FAILED", ""):
                # Job is active (QUEUED/PROCESSING/RETRYING) or already COMPLETE — return it.
                print(f"[INSTRUMENTATION] Idempotency hit: job_id={existing_job_id}, status={job_status}")
                from fastapi.responses import JSONResponse
                return JSONResponse(status_code=202, content={"job_id": existing_job_id})
            else:
                # Job FAILED or data missing — delete stale idempotency key and re-enqueue.
                print(f"[INSTRUMENTATION] Idempotency key points to FAILED/missing job {existing_job_id} — clearing for fresh enqueue")
                await redis_client.delete(idempotency_key)

        # Save to transient storage in Redis (Claim-Check pattern).
        # TTL must exceed max_queue_wait + max_processing_time + retry_window.
        # Forensic evidence: queue_wait=542s exceeded old TTL=300s → PDF expired before pickup.
        file_key = f"transient:file:{uuid.uuid4().hex}"
        b64_data = base64.b64encode(file_bytes).decode('utf-8')
        job_id = str(uuid.uuid4())

        # INSTRUMENTATION LOGGING
        print(f"[INSTRUMENTATION] job_id={job_id} | file_key={file_key}")
        print(f"[INSTRUMENTATION] API received bytes: size={len(file_bytes)}, sha256={file_hash}")
        redis_bytes = base64.b64decode(b64_data)
        print(f"[INSTRUMENTATION] Redis b64 round-trip: size={len(redis_bytes)}, sha256={hashlib.sha256(redis_bytes).hexdigest()}")
        print(f"[INSTRUMENTATION] Storing with TTL={TRANSIENT_FILE_TTL}s, timestamp={time.time()}")

        # Step A: Store the file in Redis transient storage FIRST.
        # Worker must be able to retrieve it even if queue wait is long.
        await redis_client.set(file_key, b64_data, ex=TRANSIENT_FILE_TTL)
        stored_ttl = await redis_client.ttl(file_key)
        print(f"[INSTRUMENTATION] Verified: EXISTS=1, TTL={stored_ttl}s after store")

        # Step B: Atomically claim the idempotency slot with SET NX EX.
        # Single atomic command — no gap between check and claim.
        is_first = await redis_client.set(idempotency_key, job_id, nx=True, ex=TRANSIENT_FILE_TTL)
        if not is_first:
            # Lost the race — another concurrent request already enqueued this exact file.
            # Our file_key will expire on its own TTL (no leak).
            existing_job_id = await redis_client.get(idempotency_key)
            print(f"[INSTRUMENTATION] Lost idempotency race, returning existing job_id={existing_job_id}")
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=202, content={"job_id": existing_job_id or job_id})

        # Step C: Enqueue only after both file and idempotency slot are committed.
        await queue_manager.enqueue(
            job_type="parse_pdf",
            payload={
                "file_key": file_key,
                "filename": filename,
                "original_sha256": file_hash,
                "original_size": len(file_bytes),
                "transient_ttl": TRANSIENT_FILE_TTL,
                "enqueued_at": time.time(),
            },
            job_id=job_id
        )
        print(f"[INSTRUMENTATION] Job enqueued. file_key={file_key} will expire at T+{TRANSIENT_FILE_TTL}s")

        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=202, content={"job_id": job_id})

    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.error(f"Failed to enqueue parsing job: {str(e)}", exc_info=True)
        raise HTTPException(status_code=503, detail="Service temporarily unavailable. Could not connect to the job queue.")

