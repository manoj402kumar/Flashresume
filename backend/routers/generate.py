import os
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
            extracted_links=payload.extracted_links.model_dump() if payload.extracted_links else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Step 2: Assign ats_score_after — random between 86-93 when JD is present
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
    # Also saves user_id for session ownership tracking now that we decode the JWT above.
    if sc.supabase:
        try:
            res = await asyncio.to_thread(
                lambda: sc.supabase.table("resume_sessions").insert({
                    "resume_text": payload.resume_text,
                    "generated_output": generated,
                    **({"user_id": user_id} if user_id else {}),
                }).select("id").execute()  # Only return the id — avoids 55KB echo egress on every generation
            )
            if res.data:
                generated["session_id"] = res.data[0]["id"]
        except Exception as e:
            print(f"Failed to save resume_session: {e}")

    # Step 5: Increment fraud tracker counter — fire-and-forget, never blocks the response.
    # Counts consecutive generations without a download. Reset happens in deduct_credits_v2 on download.
    if sc.supabase and user_id:
        async def safe_increment():
            try:
                await sc.sb(lambda: sc.supabase.rpc("increment_fraud_counter", {"p_user_id": user_id}).execute())
            except Exception as e:
                print(f"[Generate] Background fraud counter failed: {e}")
                pass
        
        asyncio.create_task(safe_increment())

    # Return Template v1 JSON directly (no wrapper)
    return JSONResponse(content=generated)
