from pydantic import BaseModel
from typing import Optional

class Heading(BaseModel):
    name: str
    phone: str
    email: str
    linkedin_url: str

class Education(BaseModel):
    institution: str
    location: str
    degree: str
    duration: str

class Experience(BaseModel):
    job_title: str
    duration: str
    company: str
    location: str
    bullets: list[str]

class Project(BaseModel):
    title: str
    tech_stack: str
    duration: str
    bullets: list[str]

class TechnicalSkills(BaseModel):
    languages: list[str]
    frameworks: list[str]
    databases: list[str]
    cloud_services: list[str]
    developer_tools: list[str]

class TemplateV1(BaseModel):
    template_id: str = "v1"
    heading: Heading
    education: list[Education]
    experience: list[Experience]
    projects: list[Project]
    achievements: list[str]
    technical_skills: TechnicalSkills
    changes: list[str]        # list of what was added/changed (for highlight mode)
    ats_score_before: int
    ats_score_after: int
