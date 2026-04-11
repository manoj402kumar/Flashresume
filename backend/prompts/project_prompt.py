PROJECT_CHECK_PROMPT = """
You are analyzing a student's resume projects against a job description.

Task 1 — Relevance Check:
List which of the student's existing projects are relevant to the job description.
A project is relevant if it uses technologies, frameworks, or concepts mentioned in the JD.

Task 2 — Gap Analysis:
If NO relevant projects exist, suggest ONE new project the student could add.
The suggested project must be:
- Realistic for a student to have built
- Use technologies from the job description
- Be specific with tech stack and purpose

Return ONLY this JSON. No markdown. No explanation. Raw JSON only.

{{
  "has_relevant_projects": true/false,
  "relevant_projects": ["Project Name 1", "Project Name 2"],
  "suggested_projects": ["Project Name with tech stack — only if has_relevant_projects is false"],
  "requires_consent": true/false
}}

Resume Projects Section:
{resume_projects}

Job Description:
{job_description}
"""
