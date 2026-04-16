from pydantic import BaseModel
from typing import List

class AnalyzeRequest(BaseModel):
    resume_text: str
    job_description: str
    preferred_model: str = "gemini"

class GenerateRequest(BaseModel):
    resume_text: str
    job_description: str
    ats_score_before: int
    approved_project: str = ""
    template_id: str = "v1"
    preferred_model: str = "gemini"
