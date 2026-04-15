from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from models.request_models import GenerateRequest
from services.resume_generator import generate_resume
from services.ats_scorer import score_resume

router = APIRouter()

@router.post("/generate")
async def generate_resume_endpoint(request: GenerateRequest):
    # Generate the rewritten resume with Template v1 validation
    try:
        generated = generate_resume(
            request.resume_text,
            request.job_description,
            request.ats_score_before,
            request.approved_project
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Step 2: Calculate ATS score on the newly generated resume
    # Convert the generated JSON back to plain text for scoring
    generated_text = str(generated)
    try:
        after_analysis = score_resume(generated_text, request.job_description)
        ats_after = after_analysis.get("ats_score", 0)
    except Exception:
        ats_after = 0   # Non-fatal — don't fail the whole request
    
    # Update ats_score_after in the generated resume
    generated["ats_score_after"] = ats_after

    # Return Template v1 JSON directly (no wrapper)
    return JSONResponse(content=generated)
