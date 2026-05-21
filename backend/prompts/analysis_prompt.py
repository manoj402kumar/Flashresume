ANALYSIS_PROMPT = """
Read whole prompt once and proceed to Json result.
Act as best ATS resume analyzer wrt given job description.
Analyze this resume against the job description. Calculate ATS score and missing skills as instructed below.

Return ONLY valid JSON. No markdown code blocks. DO NOT use markdown formatting (like **bold**, *italics*, etc.) inside the JSON string values. Use plain text only. No explanation. Raw JSON only.

TARGET USERS: B.Tech freshers (0-1 year experience) to experienced professionals.
OBJECTIVE: Calculate ATS score based on rigorous keyword and concept matching.

INPUT LABELS (referred throughout this prompt):
- RESUME_TEXT → The raw resume text (see bottom of this prompt)
- JOB_DESCRIPTION → The target job description (see bottom of this prompt)

OR CONDITION RULE — apply this FIRST before any matching:
When the JD lists alternative technologies — whether using "/", "OR", commas, or natural language like
"Proficiency in Java or Python", "one of React, Angular, Vue", "Java/Python/Go",
"proficiency in any one of Python, Java" — treat the ENTIRE group as ONE slot.
- If resume matches ANY ONE alternative → slot is MATCHED. Add only the matched alternative
  (e.g., "python") to matched_skills. Do NOT add the other unmatched alternatives to missing_skills.
- If resume matches NONE → slot is MISSING. Add the full group as ONE entry (e.g., "java/python")
  to missing_skills. Do NOT split into separate items.
- NEVER add both "java" and "python" as two separate entries when they come from the same OR group.

Examples of correct OR behavior:
  JD: "java/python", Resume has Python → matched_skills: ["python"]        (java is NOT in missing_skills)
  JD: "Proficiency in Java or Python", Resume has Python → matched_skills: ["python"]  (java is NOT in missing_skills)
  JD: "java/python", Resume has neither → missing_skills: ["java/python"]  (one entry, not two)
  JD: "react OR angular", Resume has React → matched_skills: ["react"]     (angular is NOT in missing_skills)
  JD: "mysql/postgresql", Resume has MySQL → matched_skills: ["mysql"]     (postgresql is NOT in missing_skills)
  JD: "proficiency in any one of Python, Java", Resume has Python → matched_skills: ["python"]  (java is NOT in missing_skills)
  JD: "proficiency in any one of Python, Java", Resume has neither → missing_skills: ["python/java"]  (one entry, not two)
  JD: "REST API deployment (Flask or FastAPI)", Resume has FastAPI → matched_skills: ["fastapi"]  (flask is NOT in missing_skills)

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
3. Strict Verification for Matches: A concept/keyword is ONLY a matched_skill if it is EXPLICITLY stated in RESUME_TEXT. Do NOT infer, assume, or guess a skill. (e.g., if RESUME_TEXT says "REST API", do not assume "Microservices" unless that word is actually in RESUME_TEXT).
   SCAN ALL SECTIONS: Read RESUME_TEXT top to bottom — Summary, Skills, Projects (titles, tech stacks, bullets), Work Experience (bullets), Education, and Certifications. A keyword found in ANY section counts as matched.
4. Identify matched_skills: (don't forget) ONLY skills that are (a) extracted from JOB_DESCRIPTION AND (b) explicitly present in RESUME_TEXT (any section). Source is always JOB_DESCRIPTION — never add a RESUME_TEXT-only skill here.
5. Identify missing_skills: (don't forget)ONLY skills extracted from JOB_DESCRIPTION that are NOT present in RESUME_TEXT. One entry per slot; OR groups shown as single "x/y" entry.
6. HARD EXCLUSION: A skill CANNOT appear in both matched_skills and missing_skills. If it matched, it is matched only. If it is missing, it is missing only.
7. HARD EXCLUSION: Do NOT add any skill to matched_skills that is not present in JOB_DESCRIPTION, even if it appears in RESUME_TEXT.
8. Calculate ATS score: (count of matched_skills / (count of matched_skills + count of missing_skills)) * 100

⚠️ MANDATORY SELF-VALIDATION (before outputting JSON):
For each skill in your missing_skills list, re-scan the ENTIRE RESUME_TEXT one more time.
If the skill (or any OR alternative) appears ANYWHERE in the resume — move it to matched_skills.
This catches accidental misses, especially for skills in the Technical Skills section or project tech stacks.

Required format:
{{
  "ats_score": <integer 0-100>,
  "matched_skills": ["python", "REST APIs", "docker"],
  "missing_skills": ["java/nodejs", "spring boot/django"]
}}

RESUME_TEXT:
{resume_text}

JOB_DESCRIPTION:
{job_description}
"""
