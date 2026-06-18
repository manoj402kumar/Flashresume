from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class ExtractedLinksInput(BaseModel):
    """
    Subset of ExtractedLinks forwarded from the parse step into generation.
    Kept as a separate model (not imported from response_models) to avoid
    coupling the request/response layers together.
    """
    all_urls:  List[str] = []


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
    extracted_links: Optional[ExtractedLinksInput] = None  # URLs from PDF annotations
