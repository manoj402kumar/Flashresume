import asyncio
import re
from fastapi import APIRouter, HTTPException
from models.request_models import AnalyzeRequest
from models.response_models import CombinedAnalysisResponse
from services.ats_scorer import score_resume
from services.project_checker import check_project_relevance

router = APIRouter()

def _is_skill_covered(skill: str, covered: set) -> bool:
    """
    Check if a skill (possibly an OR group like 'java/python') is covered.
    Splits on '/' or ' OR ' and checks if ANY alternative is in covered.
    """
    parts = re.split(r'\s*/\s*|\s+[Oo][Rr]\s+', skill)
    return any(p.strip().lower() in covered for p in parts)

@router.post("/analyze", response_model=CombinedAnalysisResponse)
async def analyze_resume(request: AnalyzeRequest):
    """
    Combined endpoint: Analyze resume against JD for ATS score AND check project relevance.

    Returns:
    - ATS score, matched skills, missing skills (pre-filtered using covered_jd_tech)
    - Project case (1/2), selected_projects, suggested_project (if needed)
    - requires_consent flag (true for Case 2)
    """
    try:
        # Run ATS scoring and project check concurrently
        ats_task = score_resume(request.resume_text, request.job_description, request.preferred_model or "")
        project_task = check_project_relevance(request.resume_text, request.job_description, request.preferred_model or "")

        ats_result, project_result = await asyncio.gather(ats_task, project_task)

        # Filter missing_skills: remove any skill already covered by the selected projects
        # This prevents injecting OR-alternative languages (e.g., "java" when user has "python")
        covered = {c.lower() for c in project_result.get("covered_jd_tech", [])}
        filtered_missing = [s for s in ats_result["missing_skills"] if not _is_skill_covered(s, covered)]

        return CombinedAnalysisResponse(
            # ATS fields
            ats_score=ats_result["ats_score"],
            matched_skills=ats_result["matched_skills"],
            missing_skills=filtered_missing,
            all_missing_skills=ats_result["missing_skills"],
            # Project check fields
            has_relevant_projects=project_result["has_relevant_projects"],
            relevant_projects=project_result["relevant_projects"],
            total_projects_count=project_result.get("total_projects_count", 0),
            least_relevant_project=project_result.get("least_relevant_project"),
            suggested_project=project_result.get("suggested_project"),
            requires_consent=project_result["requires_consent"],
            selected_projects=project_result.get("selected_projects", []),
            case=project_result.get("case", 1),
            model_used=ats_result.get("_model_used")
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
