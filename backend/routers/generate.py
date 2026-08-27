import os
import uuid
import asyncio
import random
from fastapi import APIRouter, HTTPException, Request, Header
from fastapi.responses import JSONResponse
from models.request_models import GenerateRequest
from services.resume_generator import generate_resume
import supabase_client as sc
from rate_limiter import limiter

router = APIRouter()

# P2-3: Request size limits — same thresholds as analyze.py
_MAX_RESUME_CHARS = 15_000
_MAX_JD_CHARS     = 8_000

@router.post("/generate")
@limiter.limit("10/minute")
async def generate_resume_endpoint(request: Request, payload: GenerateRequest, authorization: str = Header(None)):
    # Size validation — reject before spending any LLM tokens
    if len(payload.resume_text) > _MAX_RESUME_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Resume text is too large ({len(payload.resume_text):,} characters). "
                   f"Maximum allowed is {_MAX_RESUME_CHARS:,} characters. "
                   f"Please trim your resume to 2 pages or less."
        )
    if payload.job_description and len(payload.job_description) > _MAX_JD_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Job description is too large ({len(payload.job_description):,} characters). "
                   f"Maximum allowed is {_MAX_JD_CHARS:,} characters."
        )

    # Decode the Supabase JWT to identify the user — used for fraud tracking and session ownership.
    # This is non-blocking and fully isolated from the generation path.
    user_id: str | None = None
    if authorization and authorization.startswith("Bearer ") and sc.supabase:
        token = authorization.split(" ", 1)[1]
        try:
            user_resp = await asyncio.to_thread(lambda: sc.supabase.auth.get_user(token))
            user_id = user_resp.user.id if user_resp and user_resp.user else None
        except Exception:
            pass  # Never block generation for auth decode failures

    # Step 0: Enforcement check — Reject blocked users (5+ consecutive generations without download & 0 credits)
    if user_id and sc.supabase:
        try:
            u_res = await asyncio.to_thread(
                lambda: sc.supabase.table("users").select("fraud_tracker_counter, credits_balance").eq("id", user_id).single().execute()
            )
            if u_res and u_res.data:
                fraud_cnt = u_res.data.get("fraud_tracker_counter", 0) or 0
                credits_bal = u_res.data.get("credits_balance", 0) or 0
                if fraud_cnt >= 5 and credits_bal <= 0:
                    raise HTTPException(
                        status_code=403,
                        detail="LIMIT_REACHED: You have reached the free resume generation limit of 5 without downloading. Please upgrade to continue."
                    )
        except HTTPException:
            raise
        except Exception as e:
            print(f"[Generate] Pre-check error (non-fatal): {e}")

    # Step 1: Enqueue the generate job
    from queue_manager import queue_manager
    job_payload = {
        "resume_text": payload.resume_text,
        "job_description": payload.job_description,
        "ats_score_before": payload.ats_score_before,
        "approved_project": payload.approved_project,
        "missing_keywords": payload.missing_keywords,
        "selected_projects": payload.selected_projects,
        "no_ai_changes": payload.no_ai_changes,
        "preferred_model": payload.preferred_model or "",
        "extracted_links": payload.extracted_links.model_dump() if payload.extracted_links else None,
        "user_id": user_id
    }
    import hashlib
    import json
    import uuid
    from redis_client import redis_client
    
    # Create deterministic hash for idempotency
    hash_input = json.dumps(job_payload, sort_keys=True).encode("utf-8")
    payload_hash = hashlib.sha256(hash_input).hexdigest()
    idempotency_key = f"idempotency:generate:{payload_hash}"
    
    existing_job = await redis_client.get(idempotency_key)
    if existing_job:
        return JSONResponse(status_code=202, content={"job_id": existing_job})
        
    job_id = str(uuid.uuid4())
    is_first = await redis_client.setnx(idempotency_key, job_id)
    if not is_first:
        existing_job = await redis_client.get(idempotency_key)
        return JSONResponse(status_code=202, content={"job_id": existing_job})
        
    await redis_client.setex(idempotency_key, 3600, job_id)
    
    try:
        await queue_manager.enqueue(
            job_type="generate_resume",
            payload=job_payload,
            job_id=job_id
        )
    except Exception as e:
        import logging; logging.error(f"Failed to enqueue generation job: {str(e)}", exc_info=True); raise HTTPException(status_code=503, detail="Service temporarily unavailable. Could not connect to the job queue.")

    return JSONResponse(status_code=202, content={"job_id": job_id})

