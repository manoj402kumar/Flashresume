from fastapi import APIRouter, HTTPException
from models.request_models import AnalyzeRequest
from models.response_models import AnalyzeResponse, ProjectCheckResponse
from services.ats_scorer import score_resume
from services.project_checker import check_project_relevance

router = APIRouter()

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_resume(request: AnalyzeRequest):
    try:
        result = score_resume(request.resume_text, request.job_description)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return AnalyzeResponse(
        ats_score=result["ats_score"],
        matched_skills=result["matched_skills"],
        missing_skills=result["missing_skills"],
        suggestions=result["suggestions"]
    )

@router.post("/check-projects", response_model=ProjectCheckResponse)
async def check_projects(request: AnalyzeRequest):
    """
    Check if resume projects are relevant to job description.
    This runs BETWEEN /api/analyze and /api/generate.
    
    Frontend shows results to user:
    - If has_relevant_projects: true → show which projects will be enhanced
    - If has_relevant_projects: false → show suggested project, ask for consent
    """
    try:
        result = check_project_relevance(request.resume_text, request.job_description)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return ProjectCheckResponse(
        has_relevant_projects=result["has_relevant_projects"],
        relevant_projects=result["relevant_projects"],
        suggested_projects=result["suggested_projects"],
        requires_consent=result["requires_consent"]
    )
