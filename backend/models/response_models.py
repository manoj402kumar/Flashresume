from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class ParseResponse(BaseModel):
    resume_text: str
    page_count: int
    parser_used: str

class SuggestedProject(BaseModel):
    title: str
    tech_stack: str
    description: str

class CombinedAnalysisResponse(BaseModel):
    """Combined response with both ATS analysis and project check"""
    ats_score: int
    matched_skills: List[str]
    missing_skills: List[str]
    all_missing_skills: List[str] = []
    has_relevant_projects: bool
    relevant_projects: List[str]
    total_projects_count: int
    least_relevant_project: Optional[str]
    suggested_project: Optional[SuggestedProject]
    requires_consent: bool
    selected_projects: List[str] = []
    case: int = 1
    model_used: Optional[str] = None
