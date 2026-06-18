from pydantic import BaseModel
from typing import List, Dict, Any, Optional


class ExtractedLinks(BaseModel):
    """
    URLs extracted from a PDF's hyperlink annotation layer.
    Populated by pdf_link_extractor.extract_pdf_links().
    All URLs are normalized to https:// scheme with tracking params stripped.
    """
    all_urls:  List[str] = []        # ALL valid https:// URLs found — used by LLM to map to headings and projects


class ParseResponse(BaseModel):
    resume_text: str
    page_count: int
    parser_used: str
    extracted_links: ExtractedLinks = ExtractedLinks()  # Empty by default (DOCX / text paste paths)


class SuggestedProject(BaseModel):
    title: str
    tech_stack: str
    description: str

class CombinedAnalysisResponse(BaseModel):
    """Combined response with both ATS analysis and project check"""
    ats_score: int
    matched_skills: List[str]
    missing_skills: List[str]          # filtered (updated_missing_skills from LLM) — passed to generation
    all_missing_skills: List[str] = []  # full unfiltered — shown to user
    has_relevant_projects: bool
    relevant_projects: List[str]
    total_projects_count: int
    least_relevant_project: Optional[str]
    suggested_project: Optional[SuggestedProject]
    requires_consent: bool
    selected_projects: List[str] = []
    case: int = 1
    model_used: Optional[str] = None
