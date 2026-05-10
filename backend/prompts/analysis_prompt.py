ANALYSIS_PROMPT = """
Act as best ATS resume analyzer wrt given job description.
Analyze this resume against the job description. Calculate ATS score as instructed below.

Return ONLY valid JSON. No markdown code blocks. DO NOT use markdown formatting (like **bold**, *italics*, etc.) inside the JSON string values. Use plain text only. No explanation. Raw JSON only.

TARGET USERS: B.Tech freshers (0-1 year experience) to experienced professionals.
OBJECTIVE: Calculate ATS score based on rigorous keyword and concept matching.

CRITICAL INSTRUCTION - DEFINITION OF A "SKILL/KEYWORD":
Do NOT restrict your extraction to just tools and frameworks (like React, Java, MongoDB). You MUST comprehensively extract all ATS-relevant keywords from the ENTIRE Job Description (both "Responsibilities" and "Qualifications" sections). 
This includes:
- Hard Skills & Technologies (e.g., Spring Boot, REST APIs, SQL, Git, MongoDB)
- Programming Concepts & Paradigms (e.g., OOP, Multithreading, Exception Handling, Collections)
- Methodologies & Practices (e.g., Unit Testing, CI/CD, Agile, Code Review, Bug Fixing)
- System Design Concepts (e.g., Microservices, Caching, Load Balancing, Security, Authentication)

Analysis Rules:
1. Extract ALL critical keywords/concepts from the JD using the expanded definition above.
2. Strict Verification for Matches: A concept/keyword is ONLY a `matched_skill` if it is EXPLICITLY stated in the Resume. Do NOT infer, assume, or guess a skill. (e.g., if the resume says "REST API", do not assume "Microservices" unless the word "Microservices" is actually there. If the resume says "MERN stack", do not assume "Unit Testing"). If it is not explicitly written in the resume, it is a missing skill.
3. Identify matched_skills (explicitly present in BOTH the resume and the JD).
4. Identify missing_skills (present in the JD but missing from the resume). 
5. Calculate ATS score based on keyword match percentage.
6. Score formula: (matched_skills / (matched_skills + missing_skills)) * 100

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
