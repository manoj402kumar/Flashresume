from fastapi import APIRouter, HTTPException
from models.request_models import AnalyzeRequest
from models.response_models import CombinedAnalysisResponse
from services.ats_scorer import score_resume
from services.project_checker import check_project_relevance

router = APIRouter()

@router.post("/analyze", response_model=CombinedAnalysisResponse)
async def analyze_resume(request: AnalyzeRequest):
    """
    Combined endpoint: Analyze resume against JD for ATS score AND check project relevance.
    
    Returns:
    - ATS score, matched skills, missing skills
    - Project relevance check with suggestion (only if no relevant projects exist)
    - Requires consent flag (true only if suggesting new project)
    
    This replaces the previous separate /analyze and /check-projects endpoints.
    """
    try:
        # Step 1: ATS Analysis
        ats_result = score_resume(request.resume_text, request.job_description)
        
        # Step 2: Project Relevance Check
        project_result = check_project_relevance(request.resume_text, request.job_description)
        
        # Combine both results into single response
        return CombinedAnalysisResponse(
            # ATS Analysis fields
            ats_score=ats_result["ats_score"],
            matched_skills=ats_result["matched_skills"],
            missing_skills=ats_result["missing_skills"],
            # Project Check fields
            has_relevant_projects=project_result["has_relevant_projects"],
            relevant_projects=project_result["relevant_projects"],
            total_projects_count=project_result.get("total_projects_count", 0),
            least_relevant_project=project_result.get("least_relevant_project"),
            suggested_project=project_result.get("suggested_project"),
            requires_consent=project_result["requires_consent"]
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
