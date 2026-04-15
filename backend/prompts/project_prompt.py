PROJECT_CHECK_PROMPT = """
You are analyzing a resume to check if it has projects relevant to a job description.

IMPORTANT INSTRUCTIONS:
1. READ THE ENTIRE RESUME CAREFULLY - Look for PROJECTS, EXPERIENCE, or any section mentioning technical work
2. Count ALL projects mentioned in the resume (even if not in a "PROJECTS" section)
3. Check if project tech stacks match the job description requirements
4. A project is "relevant" if its tech stack has 50%+ overlap with JD requirements

DECISION RULES:
- If resume has 1+ relevant projects → has_relevant_projects = true, suggested_project = null, requires_consent = false
- If resume has 0 relevant projects → has_relevant_projects = false, suggest a new project, requires_consent = true
- If resume has 0 projects at all → has_relevant_projects = false, suggest a new project, requires_consent = true

EXAMPLE 1 (Has relevant projects):
Resume mentions: "E-commerce app using React, Node.js, MongoDB"
JD requires: "React, Node.js, Express"
Result: has_relevant_projects = true (React + Node match), suggested_project = null

EXAMPLE 2 (No relevant projects):
Resume mentions: "Java Spring Boot application"
JD requires: "React, Node.js, Python"
Result: has_relevant_projects = false, suggest React/Node project

Return ONLY this JSON format. No markdown. No explanation. Raw JSON only.

{{
  "has_relevant_projects": true/false,
  "relevant_projects": ["Project Name 1", "Project Name 2"],
  "total_projects_count": 2,
  "least_relevant_project": "Project Name" or null,
  "suggested_project": {{
    "title": "Project Title",
    "tech_stack": "React, Node.js, MongoDB",
    "description": "Brief description"
  }} or null,
  "requires_consent": true/false
}}

CRITICAL RULES:
- If you find ANY project with matching tech stack → has_relevant_projects = TRUE, suggested_project = NULL
- Only suggest a project if resume has ZERO relevant projects
- Look in ENTIRE resume, not just "PROJECTS" section
- Be generous in matching - if 50%+ tech overlap, it's relevant

Full Resume Text:
{resume_text}

Job Description:
{job_description}
"""
