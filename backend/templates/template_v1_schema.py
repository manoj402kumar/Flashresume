from pydantic import BaseModel
from typing import Optional, Union

class Heading(BaseModel):
    name: str
    phone: str
    email: str
    linkedin_url: str
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None

class Education(BaseModel):
    institution: str
    location: Optional[str] = None  # User can add in editable form
    degree: str
    duration: Optional[str] = None  # User can add in editable form
    cgpa: Optional[str] = None

class Experience(BaseModel):
    job_title: str
    duration: Optional[str] = None  # User can add in editable form
    company: str
    location: Optional[str] = None  # User can add in editable form
    bullets: list[str]

class Project(BaseModel):
    title: str
    tech_stack: str
    link: Optional[str] = None  # Live link or GitHub link - user can add in editable form
    bullets: list[str]

class TechnicalSkills(BaseModel):
    languages: list[str]
    frameworks: list[str]
    databases: list[str]
    cloud_services: list[str]
    developer_tools: list[str]
    miscellaneous: list[str] = []

class TemplateV1(BaseModel):
    template_id: str = "v1"
    heading: Heading
    summary: Optional[str] = None
    education: list[Education]
    experience: list[Experience]
    projects: list[Project]
    certifications: Optional[list[str]] = None  # If 2+ certifications
    achievements: Optional[list[str]] = None  # If certifications separate OR no certs
    certifications_and_achievements: Optional[list[str]] = None  # If 1 certification (merged)
    technical_skills: TechnicalSkills
    changes: list[str]
    ats_score_before: int
    ats_score_after: int
