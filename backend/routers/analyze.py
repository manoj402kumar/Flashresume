from fastapi import APIRouter, HTTPException
from models.request_models import AnalyzeRequest
from models.response_models import CombinedAnalysisResponse
from services.combined_analyzer import analyze_resume_combined

router = APIRouter()

@router.post("/analyze", response_model=CombinedAnalysisResponse)
async def analyze_resume(request: AnalyzeRequest):
    """
    Combined endpoint: Analyze resume against JD for ATS score AND check project relevance.
    Uses a SINGLE LLM call (combined prompt) instead of two parallel calls.

    Returns:
    - ATS score, matched skills, missing skills (pre-filtered using covered_jd_tech)
    - Project case (1/2), selected_projects, suggested_project (if needed)
    - requires_consent flag (true for Case 2)
    """
    try:
        result = await analyze_resume_combined(
            request.resume_text,
            request.job_description,
            request.preferred_model or ""
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
