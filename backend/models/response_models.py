from pydantic import BaseModel
from typing import List, Dict, Any

class ParseResponse(BaseModel):
    resume_text: str
    page_count: int
    parser_used: str  # "pdfplumber" or "gemini_vision" - useful for debugging

class AnalyzeResponse(BaseModel):
    ats_score: int
    matched_skills: List[str]
    missing_skills: List[str]
    suggestions: List[str]

class ProjectCheckResponse(BaseModel):
    has_relevant_projects: bool
    relevant_projects: List[str]
    suggested_projects: List[str]
    requires_consent: bool

class GenerateResponse(BaseModel):
    generated_resume: Dict[str, Any]
    ats_score_after: int
