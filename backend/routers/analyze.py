import hashlib
import json
import uuid
from fastapi import APIRouter, HTTPException, Request, Header, Depends
from auth_utils import verify_user
from fastapi.responses import JSONResponse
from models.request_models import AnalyzeRequest
from rate_limiter import limiter
from queue_manager import queue_manager, QueueCapacityError, UserJobLimitError
from redis_client import redis_client

router = APIRouter()

_MAX_RESUME_CHARS = 15_000
_MAX_JD_CHARS     = 8_000

@router.post("/analyze")
@limiter.limit("10/minute")
async def analyze_resume(request: Request, payload: AnalyzeRequest, user_id: str = Depends(verify_user)):
    """
    Asynchronous ATS Scoring & Project Check endpoint.
    Enqueues job to Redis and returns 202 Accepted with job_id for SSE streaming.
    """
    if len(payload.resume_text) > _MAX_RESUME_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Resume text is too large ({len(payload.resume_text):,} characters). Maximum allowed is {_MAX_RESUME_CHARS:,} characters."
        )
    if payload.job_description and len(payload.job_description) > _MAX_JD_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Job description is too large ({len(payload.job_description):,} characters). Maximum allowed is {_MAX_JD_CHARS:,} characters."
        )



    job_payload = {
        "resume_text": payload.resume_text,
        "job_description": payload.job_description,
        "preferred_model": payload.preferred_model or "",
        "user_id": user_id
    }

    # Idempotency hash
    hash_input = json.dumps(job_payload, sort_keys=True).encode("utf-8")
    payload_hash = hashlib.sha256(hash_input).hexdigest()
    idempotency_key = f"idempotency:analyze:{payload_hash}"

    existing_job = await redis_client.get(idempotency_key)
    if existing_job:
        return JSONResponse(status_code=202, content={"job_id": existing_job})

    job_id = str(uuid.uuid4())
    is_first = await redis_client.set(idempotency_key, job_id, nx=True, ex=3600)
    if not is_first:
        existing_job = await redis_client.get(idempotency_key)
        return JSONResponse(status_code=202, content={"job_id": existing_job})

    try:
        await queue_manager.enqueue(
            job_type="analyze_resume",
            payload=job_payload,
            job_id=job_id,
            user_id=user_id
        )
    except QueueCapacityError as e:
        raise HTTPException(status_code=503, detail=str(e), headers={"Retry-After": "30"})
    except UserJobLimitError as e:
        raise HTTPException(status_code=429, detail=str(e), headers={"Retry-After": "15"})
    except Exception as e:
        import logging
        logging.error(f"Failed to enqueue analysis job: {str(e)}", exc_info=True)
        raise HTTPException(status_code=503, detail="Service temporarily unavailable. Could not connect to the job queue.")

    return JSONResponse(status_code=202, content={"job_id": job_id})
