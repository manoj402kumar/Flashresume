from pydantic import BaseModel
from typing import List

class AnalyzeRequest(BaseModel):
    resume_text: str
    job_description: str

class GenerateRequest(BaseModel):
    resume_text: str
    job_description: str
    ats_score_before: int
    approved_project: str = ""  # Only if user approved suggested project
    template_id: str = "v1"  # future: user picks template
