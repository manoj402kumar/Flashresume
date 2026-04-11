ANALYSIS_PROMPT = """
Analyze this resume against the job description and return ONLY valid JSON.

No markdown. No explanation. No code block. No backticks. Raw JSON only.

Required format:
{{
  "ats_score": <integer between 0 and 100>,
  "matched_skills": ["skill1", "skill2", "skill3"],
  "missing_skills": ["skill4", "skill5"],
  "suggestions": [
    "Add a project using React as mentioned in the JD",
    "Include Docker experience — it appears 3 times in the JD"
  ]
}}

Resume Text:
{resume_text}

Job Description:
{job_description}
"""
