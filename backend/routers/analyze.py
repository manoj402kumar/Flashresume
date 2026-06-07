from fastapi import APIRouter, HTTPException, Request, Header
from models.request_models import AnalyzeRequest
from models.response_models import CombinedAnalysisResponse
from services.combined_analyzer import analyze_resume_combined
from rate_limiter import limiter

router = APIRouter()

# P2-3: Request size limits — prevents oversized inputs from consuming LLM quota
_MAX_RESUME_CHARS = 15_000   # ~4,000 tokens; a 2-page resume is ~3,000–6,000 chars
_MAX_JD_CHARS     = 8_000    # ~2,000 tokens; normal JDs are 1,000–4,000 chars

@router.post("/analyze", response_model=CombinedAnalysisResponse)
@limiter.limit("5/minute")
async def analyze_resume(request: Request, payload: AnalyzeRequest, authorization: str = Header(None)):
    """
    Combined endpoint: Analyze resume against JD for ATS score AND check project relevance.
    Uses a SINGLE LLM call (combined prompt) instead of two parallel calls.

    Returns:
    - ATS score, matched skills, missing skills (pre-filtered using covered_jd_tech)
    - Project case (1/2), selected_projects, suggested_project (if needed)
    - requires_consent flag (true for Case 2)
    """
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

    try:
        result = await analyze_resume_combined(
            payload.resume_text,
            payload.job_description,
            payload.preferred_model or ""
        )

        return CombinedAnalysisResponse(
            ats_score=result["ats_score"],
            matched_skills=result["matched_skills"],
            missing_skills=result["updated_missing_skills"],
            all_missing_skills=result.get("all_missing_skills", []),
            has_relevant_projects=result["has_relevant_projects"],
            relevant_projects=result["relevant_projects"],
            total_projects_count=result.get("total_projects_count", 0),
            least_relevant_project=result.get("least_relevant_project"),
            suggested_project=result.get("suggested_project"),
            requires_consent=result["requires_consent"],
            selected_projects=result.get("selected_projects", []),
            case=result.get("case", 1),
            model_used=result.get("_model_used")
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

