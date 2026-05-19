from pydantic import BaseModel
from typing import List, Optional

class AnalyzeRequest(BaseModel):
    resume_text: str
    job_description: str
    preferred_model: Optional[str] = ""

class GenerateRequest(BaseModel):
    resume_text: str
    job_description: str
    ats_score_before: int
    approved_project: str = ""
    missing_keywords: List[str] = []
    selected_projects: List[str] = []
    template_id: str = "v1"
    no_ai_changes: bool = False
    preferred_model: Optional[str] = ""
