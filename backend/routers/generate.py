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
        generated, model_used = generate_resume(
            request.resume_text,
            request.job_description,
            request.ats_score_before,
            request.approved_project,
            preferred_model=request.preferred_model
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Step 2: Calculate ATS score on the newly generated resume
    # Skip scoring if no JD was provided (no JD = no meaningful ATS match)
    if request.job_description and request.job_description.strip():
        generated_text = str(generated)
        try:
            after_analysis = score_resume(generated_text, request.job_description, preferred_model=request.preferred_model)
            ats_after = after_analysis.get("ats_score", 0)
        except Exception:
            ats_after = 0   # Non-fatal — don't fail the whole request
    else:
        ats_after = 0  # No JD mode — ATS scoring not applicable
    
    # Update ats_score_after and inject model info into the generated resume
    generated["ats_score_after"] = ats_after
    generated["_model_used"] = model_used

    # Return Template v1 JSON directly (no wrapper)
    return JSONResponse(content=generated)
