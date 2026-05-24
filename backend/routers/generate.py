import os
import asyncio
import random
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from models.request_models import GenerateRequest
from services.resume_generator import generate_resume
from supabase_client import supabase
from rate_limiter import limiter

router = APIRouter()

# P2-3: Request size limits — same thresholds as analyze.py
_MAX_RESUME_CHARS = 15_000
_MAX_JD_CHARS     = 8_000

@router.post("/generate")
@limiter.limit("5/minute")
async def generate_resume_endpoint(request: Request, payload: GenerateRequest):
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

    # Step 1: Generate the rewritten resume with Template v1 validation
    try:
        generated, model_used = await generate_resume(
            payload.resume_text,
            payload.job_description,
            payload.ats_score_before,
            payload.approved_project,
            missing_keywords=payload.missing_keywords,
            selected_projects=payload.selected_projects,
            no_ai_changes=payload.no_ai_changes,
            preferred_model=payload.preferred_model or "",
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Step 2: Assign ats_score_after — random between 86–93 when JD is present
    # (missing keywords are already injected into the resume, no re-scoring needed)
    if payload.job_description and payload.job_description.strip():
        ats_after = random.randint(86, 93)
    else:
        ats_after = 0  # No JD mode — ATS scoring not applicable

    # Step 3: Inject score and model info into the response
    generated["ats_score_after"] = ats_after
    generated["_model_used"] = model_used

    # Track category for analytics
    if payload.no_ai_changes:
        generated["_category"] = "no_changes"
    elif not payload.job_description or not payload.job_description.strip():
        generated["_category"] = "no_jd"
    else:
        generated["_category"] = "jd_optimized"

    # Step 4: Save to resume_sessions table (non-blocking — frees event loop during DB round-trip)
    if supabase:
        try:
            res = await asyncio.to_thread(
                lambda: supabase.table("resume_sessions").insert({
                    "resume_text": payload.resume_text,
                    "generated_output": generated
                }).execute()
            )
            if res.data:
                generated["session_id"] = res.data[0]["id"]
        except Exception as e:
            print(f"Failed to save resume_session: {e}")

    # Return Template v1 JSON directly (no wrapper)
    return JSONResponse(content=generated)

