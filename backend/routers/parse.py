from fastapi import APIRouter, UploadFile, File, HTTPException, Request, Depends
from auth_utils import verify_user
import asyncio
import hashlib
import uuid
import time
from services.parse_orchestrator import extract_resume_text, extract_from_docx
from models.response_models import ParseResponse, ExtractedLinks
from rate_limiter import limiter
from storage_service import storage_service
from queue_manager import queue_manager, QueueCapacityError, UserJobLimitError
from redis_client import redis_client

MAX_FILE_BYTES = 5 * 1024 * 1024  # 5 MB hard cap
TRANSIENT_FILE_TTL = 3600  # seconds

router = APIRouter()

@router.post("/parse")
@limiter.limit("10/minute")
async def parse_resume(request: Request, file: UploadFile = File(...), user_id: str = Depends(verify_user)):
    """
    Parse resume from multiple formats: PDF, DOCX.
    Saves file binary to private storage (never Base64 in Redis) and enqueues thin job reference.
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

    if len(file_bytes) < 100:
        raise HTTPException(status_code=400, detail="File appears empty or corrupted.")

    try:
        file_hash = hashlib.sha256(file_bytes).hexdigest()
        idempotency_key = f"idempotency:parse:{file_hash}"

        # Fast path: return existing job if active/complete
        existing_job_id = await redis_client.get(idempotency_key)
        if existing_job_id:
            job_data = await redis_client.hgetall(f"job:data:{existing_job_id}")
            job_status = job_data.get("status", "") if job_data else ""
            if job_status not in ("FAILED", ""):
                from fastapi.responses import JSONResponse
                return JSONResponse(status_code=202, content={"job_id": existing_job_id})
            else:
                await redis_client.delete(idempotency_key)

        # 1. Save file to Private Storage (Opaque file_key, zero binary bloat in Redis)
        file_key = await storage_service.save_file(file_bytes, filename)
        job_id = str(uuid.uuid4())

        # 2. Atomically claim idempotency slot
        is_first = await redis_client.set(idempotency_key, job_id, nx=True, ex=TRANSIENT_FILE_TTL)
        if not is_first:
            existing_job_id = await redis_client.get(idempotency_key)
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=202, content={"job_id": existing_job_id or job_id})

        # 3. Enqueue thin reference
        await queue_manager.enqueue(
            job_type="parse_pdf",
            payload={
                "file_key": file_key,
                "filename": filename,
                "original_sha256": file_hash,
                "original_size": len(file_bytes),
                "enqueued_at": time.time(),
                "user_id": user_id
            },
            job_id=job_id,
            user_id=user_id
        )

        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=202, content={"job_id": job_id})

    except QueueCapacityError as e:
        raise HTTPException(status_code=503, detail=str(e), headers={"Retry-After": "30"})
    except UserJobLimitError as e:
        raise HTTPException(status_code=429, detail=str(e), headers={"Retry-After": "15"})
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.error(f"Failed to enqueue parsing job: {str(e)}", exc_info=True)
        raise HTTPException(status_code=503, detail="Service temporarily unavailable. Could not connect to the job queue.")
