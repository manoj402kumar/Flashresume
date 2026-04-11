from pydantic import BaseModel
from typing import List

class AnalyzeRequest(BaseModel):
    resume_text: str
    job_description: str

class GenerateRequest(BaseModel):
    resume_text: str
    job_description: str
    approved_suggestions: List[str]
    ats_score_before: int
    template_id: str = "v1"  # future: user picks template
