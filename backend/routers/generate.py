import os
import uuid
import asyncio
import random
import hashlib
import json
from fastapi import APIRouter, HTTPException, Request, Header, Depends
from auth_utils import verify_user
from fastapi.responses import JSONResponse
from models.request_models import GenerateRequest
import supabase_client as sc
from rate_limiter import limiter
from queue_manager import queue_manager, QueueCapacityError, UserJobLimitError
from redis_client import redis_client

router = APIRouter()

_MAX_RESUME_CHARS = 15_000
_MAX_JD_CHARS     = 8_000

@router.post("/generate")
@limiter.limit("10/minute")
async def generate_resume_endpoint(request: Request, payload: GenerateRequest, user_id: str = Depends(verify_user)):
    # Size validation
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

    if not user_id and payload.user_id:
        user_id = payload.user_id

    # Fraud tracker check
    if user_id and sc.supabase:
        try:
            cache_key = f"fraud_tracker:{user_id}"
            cached_val = await redis_client.get(cache_key)
            
            if cached_val:
                fraud_data = json.loads(cached_val)
                fraud_cnt = fraud_data.get("fraud_cnt", 0)
                credits_bal = fraud_data.get("credits_bal", 0)
            else:
                u_res = await asyncio.to_thread(
                    lambda: sc.supabase.table("users").select("fraud_tracker_counter, credits_balance").eq("id", user_id).single().execute()
                )
                fraud_cnt = 0
                credits_bal = 0
                if u_res and u_res.data:
                    fraud_cnt = u_res.data.get("fraud_tracker_counter", 0) or 0
                    credits_bal = u_res.data.get("credits_balance", 0) or 0
                
                # Cache for 60 seconds
                await redis_client.setex(
                    cache_key, 60, json.dumps({"fraud_cnt": fraud_cnt, "credits_bal": credits_bal})
                )
                
            if fraud_cnt >= 5 and credits_bal <= 0:
                raise HTTPException(
                    status_code=403,
                    detail="LIMIT_REACHED: You have reached the free resume generation limit of 5 without downloading. Please upgrade to continue."
                )
        except HTTPException:
            raise
        except Exception as e:
            pass

    # Job payload construction
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

    # Deterministic hash for idempotency
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
            job_id=job_id,
            user_id=user_id
        )
    except QueueCapacityError as e:
        raise HTTPException(status_code=503, detail=str(e), headers={"Retry-After": "30"})
    except UserJobLimitError as e:
        raise HTTPException(status_code=429, detail=str(e), headers={"Retry-After": "15"})
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.error(f"Failed to enqueue generation job: {str(e)}", exc_info=True)
        raise HTTPException(status_code=503, detail="Service temporarily unavailable. Could not connect to the job queue.")

    return JSONResponse(status_code=202, content={"job_id": job_id})
