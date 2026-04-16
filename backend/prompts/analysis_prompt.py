ANALYSIS_PROMPT = """
Analyze this resume against the job description. Calculate ATS score based on number of keywords matched from job description and identify keyword matches.

Return ONLY valid JSON. No markdown. No explanation. No code block. Raw JSON only.

TARGET USERS: B.Tech freshers (0-1 year experience)
OBJECTIVE: Calculate ATS score based on keyword matching

Analysis Rules:
1. Identify matched skills (present in both resume and JD)
2. Identify missing skills (in JD but not in resume)
3. Calculate ATS score based on keyword match percentage
4. Score formula: (matched_skills / total_jd_skills) * 100

Required format:
{{
  "ats_score": <integer 0-100>,
  "matched_skills": ["skill1", "skill2"],
  "missing_skills": ["skill3", "skill4"]
}}

Resume Text:
{resume_text}

Job Description:
{job_description}
"""
