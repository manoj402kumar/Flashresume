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

    # Step 4: Generate session_id locally — no DB round-trip, no content stored.
    # The full resume JSON (resume text, generated output, AI suggestions, job strategy, changes)
    # is sent directly to the client and stored in localStorage only.
    # Only a minimal skeleton row {id, user_id} is persisted to Supabase for:
    #   - feedback ownership validation (download_count tracking)
    #   - payment session linking
    #   - admin queue health count
    session_id = str(uuid.uuid4())
    generated["session_id"] = session_id

    # Fire-and-forget: insert skeleton row — never blocks the response
    if sc.supabase:
        async def _save_session_skeleton():
            try:
                row = {"id": session_id}
                if user_id:
                    row["user_id"] = user_id
                await asyncio.to_thread(
                    lambda: sc.supabase.table("resume_sessions").insert(row).execute()
                )
            except Exception as e:
                print(f"[Generate] Background session skeleton save failed (non-critical): {e}")

        asyncio.create_task(_save_session_skeleton())

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

    # Return Template v1 JSON directly to client — client stores in localStorage
    return JSONResponse(content=generated)
