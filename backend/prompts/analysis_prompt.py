ANALYSIS_PROMPT = """
Act as best ATS resume analyzer wrt given job description.
Analyze this resume against the job description. Calculate ATS score and missing skills as instructed below.

Return ONLY valid JSON. No markdown code blocks. DO NOT use markdown formatting (like **bold**, *italics*, etc.) inside the JSON string values. Use plain text only. No explanation. Raw JSON only.

TARGET USERS: B.Tech freshers (0-1 year experience) to experienced professionals.
OBJECTIVE: Calculate ATS score based on rigorous keyword and concept matching.

OR CONDITION RULE — apply this FIRST before any matching:
When the JD lists technologies separated by "/" or "OR" (e.g., "java/python", "react OR angular", "mysql/postgresql"), treat the ENTIRE group as ONE slot.
- If resume matches ANY ONE alternative → slot is MATCHED. Add only the matched alternative (e.g., "python") to matched_skills. Do NOT add the other alternatives separately.
- If resume matches NONE → slot is MISSING. Add the full group as ONE entry (e.g., "java/python") to missing_skills. Do NOT split into separate items.
- NEVER add both "java" and "python" as two separate entries when they appear as "java/python" in the JD.

Examples of correct OR behavior:
  JD: "java/python", Resume has Python → matched_skills: ["python"]        (java is NOT listed in missing_skills)
  JD: "java/python", Resume has neither → missing_skills: ["java/python"]  (one entry, not two)
  JD: "react OR angular", Resume has React → matched_skills: ["react"]     (angular is NOT listed in missing_skills)
  JD: "mysql/postgresql", Resume has MySQL → matched_skills: ["mysql"]     (postgresql is NOT listed in missing_skills)

CRITICAL INSTRUCTION - DEFINITION OF A "SKILL/KEYWORD":
Do NOT restrict your extraction to just tools and frameworks (like React, Java, MongoDB). You MUST comprehensively extract all ATS-relevant keywords from the ENTIRE Job Description (both "Responsibilities" and "Qualifications" sections).
This includes:
- Hard Skills & Technologies (e.g., Spring Boot, REST APIs, SQL, Git, MongoDB)
- Programming Concepts & Paradigms (e.g., OOP, Multithreading, Exception Handling, Collections)
- Methodologies & Practices (e.g., Unit Testing, CI/CD, Agile, Code Review, Bug Fixing)
- System Design Concepts (e.g., Microservices, Caching, Load Balancing, Security, Authentication)

Analysis Rules:
1. Extract ALL critical keywords/concepts from the JD using the expanded definition above.
2. Apply OR CONDITION RULE first — normalize all slash/OR groups into single slots before matching.
3. Strict Verification for Matches: A concept/keyword is ONLY a matched_skill if it is EXPLICITLY stated in the Resume. Do NOT infer, assume, or guess a skill. (e.g., if the resume says "REST API", do not assume "Microservices" unless the word "Microservices" is actually there).
4. Identify matched_skills (explicitly present in BOTH the resume and the JD — one entry per slot).
5. Identify missing_skills (present in the JD but missing from the resume — one entry per slot, OR groups shown as single "x/y" entry).
6. Calculate ATS score based on keyword match percentage.
7. Score formula: (matched_skills / (matched_skills + missing_skills)) * 100

Required format:
{{
  "ats_score": <integer 0-100>,
  "matched_skills": ["python", "REST APIs", "docker"],
  "missing_skills": ["java/nodejs", "spring boot/django"]
}}

Resume Text:
{resume_text}

Job Description:
{job_description}
"""
