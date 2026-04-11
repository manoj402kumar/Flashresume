GENERATION_PROMPT = """
You are rewriting a student's resume to be ATS-optimized for the target job.

RULES — MUST FOLLOW:
1. Never invent experience, jobs, or degrees that do not exist in the original resume
2. Only include approved suggestions: {approved_suggestions}
3. Use strong action verbs: Built, Developed, Optimized, Implemented, Designed, Led
4. Add quantified metrics wherever possible (%, numbers, scale)
5. Weave job description keywords naturally into bullets
6. Keep all dates, companies, institutions exactly as in original
7. Return ONLY the JSON below. No markdown. No explanation.
8. In the "changes" field, list every modification you made (e.g., "Enhanced project X bullet with Docker keyword", "Added AWS to skills")

OUTPUT FORMAT (Template v1 — strict):
{{
  "template_id": "v1",
  "heading": {{
    "name": "Full Name",
    "phone": "+91-XXXXXXXXXX",
    "email": "email@example.com",
    "linkedin_url": "linkedin.com/in/username"
  }},
  "education": [
    {{
      "institution": "University Name",
      "location": "City, State",
      "degree": "B.Tech Computer Science",
      "duration": "Aug 2018 -- May 2022"
    }}
  ],
  "experience": [
    {{
      "job_title": "Job Title",
      "duration": "Month Year – Month Year",
      "company": "Company Name",
      "location": "City, State",
      "bullets": [
        "Led development of X feature, reducing load time by 40%",
        "Built Y system using Z technology serving N users"
      ]
    }}
  ],
  "projects": [
    {{
      "title": "Project Name",
      "tech_stack": "Python, FastAPI, PostgreSQL",
      "duration": "Month Year – Month Year",
      "bullets": [
        "Built X feature that achieves Y outcome",
        "Reduced Z metric by N%"
      ]
    }}
  ],
  "achievements": [
    "Achievement 1",
    "Achievement 2"
  ],
  "technical_skills": {{
    "languages": ["Python", "JavaScript"],
    "frameworks": ["React", "FastAPI"],
    "databases": ["PostgreSQL", "MongoDB"],
    "cloud_services": ["AWS", "Azure"],
    "developer_tools": ["Git", "Docker", "Postman"]
  }},
  "changes": [
    "Added Docker to technical skills",
    "Enhanced project X bullet 1 with AWS keyword",
    "Quantified experience bullet 2 with 40% metric"
  ],
  "ats_score_before": {ats_score_before},
  "ats_score_after": 0
}}

Original Resume:
{resume_text}

Job Description:
{job_description}

Approved Suggestions:
{approved_suggestions}

ATS Score Before:
{ats_score_before}
"""
