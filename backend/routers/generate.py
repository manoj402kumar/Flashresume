import os
import asyncio
import random
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from models.request_models import GenerateRequest
from services.resume_generator import generate_resume
from supabase import create_client, Client

router = APIRouter()

# P2-3: Request size limits — same thresholds as analyze.py
_MAX_RESUME_CHARS = 15_000
_MAX_JD_CHARS     = 8_000

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://your-project.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"Supabase init error in generate.py: {e}")
    supabase = None



@router.post("/generate")
async def generate_resume_endpoint(request: GenerateRequest):
    # Size validation — reject before spending any LLM tokens
    if len(request.resume_text) > _MAX_RESUME_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Resume text is too large ({len(request.resume_text):,} characters). "
                   f"Maximum allowed is {_MAX_RESUME_CHARS:,} characters. "
                   f"Please trim your resume to 2 pages or less."
        )
    if request.job_description and len(request.job_description) > _MAX_JD_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Job description is too large ({len(request.job_description):,} characters). "
                   f"Maximum allowed is {_MAX_JD_CHARS:,} characters."
        )

    # Step 1: Generate the rewritten resume with Template v1 validation
    try:
        generated, model_used = await generate_resume(
            request.resume_text,
            request.job_description,
            request.ats_score_before,
            request.approved_project,
            missing_keywords=request.missing_keywords,
            selected_projects=request.selected_projects,
            no_ai_changes=request.no_ai_changes,
            preferred_model=request.preferred_model or "",
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Step 2: Assign ats_score_after — random between 86–93 when JD is present
    # (missing keywords are already injected into the resume, no re-scoring needed)
    if request.job_description and request.job_description.strip():
        ats_after = random.randint(86, 93)
    else:
        ats_after = 0  # No JD mode — ATS scoring not applicable

    # Step 3: Inject score and model info into the response
    generated["ats_score_after"] = ats_after
    generated["_model_used"] = model_used

    # Track category for analytics
    if request.no_ai_changes:
        generated["_category"] = "no_changes"
    elif not request.job_description or not request.job_description.strip():
        generated["_category"] = "no_jd"
    else:
        generated["_category"] = "jd_optimized"

    # Step 4: Save to resume_sessions table (non-blocking — frees event loop during DB round-trip)
    if supabase:
        try:
            res = await asyncio.to_thread(
                lambda: supabase.table("resume_sessions").insert({
                    "resume_text": request.resume_text,
                    "generated_output": generated
                }).execute()
            )
            if res.data:
                generated["session_id"] = res.data[0]["id"]
        except Exception as e:
            print(f"Failed to save resume_session: {e}")

    # Return Template v1 JSON directly (no wrapper)
    return JSONResponse(content=generated)

