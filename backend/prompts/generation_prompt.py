GENERATION_PROMPT = """
Read whole prompt and understand it properly before generating the JSON output.

Act as ATS Resume Expert and implement below algorithm in order to optimize RESUME_TEXT with respect to JOB_DESCRIPTION.

GOAL: 0% Noise, 100% Signal. Target 1 page resume. Improvise existing resume, NOT rewrite.
OBJECTIVE: Pass ATS + User can handle actual interview with minimal, achievable, provable edits.
TARGET USERS: All experience levels — Freshers (0-1 year) to Mid/Senior professionals (3+ years)

CORE PRINCIPLE: "If original description is good, keep it. Only enhance what needs enhancement."

OUTPUT SECTION ORDER (STRICT — MANDATORY, applies to the entire resume):
1. Summary (2 lines maximum)
2. Education (with CGPA if >7.5/10)
3. Work Experience (includes internships for freshers — skip if no experience)
4. Projects
5. Skills
6. Certifications & Achievements
Target length: 1 page. 2 projects fit cleanly; 1 project is also acceptable.

INPUT LABELS (referred throughout this prompt):
- RESUME_TEXT → The raw original resume text uploaded by the user (see bottom of this prompt)
- JOB_DESCRIPTION → The target job description (see bottom of this prompt)
- MISSING KEYWORDS TO INJECT → keywords missing in RESUME_TEXT but present in JOB_DESCRIPTION, which you must inject.(see bottom of this prompt)

KEYWORD DEFINITIONS (applies throughout this prompt):
- Tech Stack Keywords: Programming languages (Java, Python, C++), Frameworks (React, Spring Boot, Django, Express.js, node.js), Libraries (NumPy, Pandas), Databases (MongoDB, PostgreSQL), Cloud Services (AWS, Azure), and Developer Tools (Docker, Kubernetes).
- Non-Tech Stack Keywords: General concepts (REST APIs, Microservices, OOP, System Design), Methodologies (Agile, Scrum, CI/CD), and Practices (Debugging, Testing, Code Review, Error Handling).

STEP-BY-STEP ALGORITHM:

Step 0: Determine Candidate Level
- Count full-time work experience (excluding internships) from RESUME_TEXT
- Fresher: 0 full-time jobs (may have 0-2 internships)
- Junior: 1-2 years full-time
- Mid/Senior: 3+ years full-time

Step 1: Extract resume sections (already done — you have RESUME_TEXT below)

Step 2: Summary Evaluation
Write/rewrite a powerful summary highlighting why the candidate is the best fit for the JOB_DESCRIPTION based on RESUME_TEXT. It should impress the recruiters.
🚨 STRICT RULE: The summary MUST be exactly 16-20 words only. 

Step 3: Education
- Keep as-is, NO changes
- If data missing (dates/CGPA), note in changes field
- Include all educational qualifications present in RESUME_TEXT (B.Tech, XII, Diploma, etc.)
- If CGPA, percentage, or score is present, make sure to include it in the "cgpa" field.

Step 3.5: Work Experience (includes Internships for Freshers)
IMPORTANT: For freshers, internships go in "Work Experience" section (NOT separate).

⛔ NO FABRICATION:
- ONLY include work experience entries that EXIST in RESUME_TEXT.
- If RESUME_TEXT has 0 work experience → output "experience": [] (empty array).
- If RESUME_TEXT has 2+ entries, keep the most relevant 2 based on JOB_DESCRIPTION.
- NEVER invent, add, or create new jobs, internships, or roles.

BULLET RULES — keep it simple:
- Keep any bullet that is already good. Only reframe weak/vague sentences for better clarity.
- Do NOT change any facts, data, features, keywords, or technologies — just better sentence framing.
- Do NOT alter job titles, company names, dates, or locations.
- Do NOT invent numbers or performance claims the user didn't write.
- There is no scope to make significant changes in work experience — it is hard for the candidate to prove later.


Step 4: Projects (CRITICAL)

⛔ WHAT COUNTS AS A PROJECT (strict definition):
- A project is ONLY an entry explicitly listed under a "PROJECTS", "LIVE PROJECTS", or similar section with a title, tech stack, and at least 1 bullet.
- "Developed 12+ projects" or "see GitHub" is NOT a project entry — ignore it.
- Skills listed under SKILLS do NOT imply projects — NEVER fabricate a project from a skill.
- Work experience bullets are NOT projects.

PROJECT SELECTION — pre-determined:
The projects to include are listed in SELECTED_PROJECTS (at the bottom of this prompt).
Include ONLY projects whose titles appear in SELECTED_PROJECTS. Exclude all others.
If SELECTED_PROJECTS has 1 entry → output 1 project. If 2 → output 2.

PROJECT LINK FIELD: ALWAYS set "link": "Link" for all projects. User edits this later.


────────────────────────────────────────────────────
Case 2 — APPROVED_PROJECT is present (not "none"):
────────────────────────────────────────────────────

The approved project (new) is provided as APPROVED_PROJECT at the bottom of this prompt with title, tech_stack, and description.

For the APPROVED PROJECT:
  - Use the EXACT title and tech_stack from APPROVED_PROJECT. Do NOT change them.
  - This is a brand new project — it does NOT exist in RESUME_TEXT.
  - Write 3-4 strong, achievable, realistic bullets.
  - 🚨 MANDATORY: The FIRST bullet MUST clearly state the real-world problem or business domain the project solves (derived from the APPROVED_PROJECT description). Do NOT just list technical steps.
  - For all bullets, use this format: Action verb + tech stack/algorithm/methodology + outcome/scope/result.
      (achievable and realistic — never insert numbers forcefully where they don't fit naturally)
  - 🚨 INJECT 70-90% of MISSING KEYWORDS here — especially tech stack keywords.
    These are FRESH bullets, so you have full freedom to weave keywords naturally.

For the SECOND PROJECT (if present in SELECTED_PROJECTS):
  - This project already exists in RESUME_TEXT — preserve its original title, tech_stack, and bullets.
  - Only inject non-tech-stack missing keywords where they naturally fit (e.g., debugging, error handling, CI/CD, testing, code review).
  - Do NOT inject languages, frameworks, or libraries into this project if its tech stack does not match.

────────────────────────────────────────────────────
Case 1 — APPROVED_PROJECT is "none" (both projects already in resume):
────────────────────────────────────────────────────

Both selected projects already exist in RESUME_TEXT with their own bullets.

For BOTH projects:
  - Keep original title, tech_stack — do NOT rewrite them.
  - Only INSERT missing keywords(70-90%) into existing bullets where they naturally fit without changing the original meaning.
  - Inject tech-stack keywords into the project whose tech stack matches. Do NOT inject a language/framework/library into a project that uses a completely different stack.
  - Inject non-tech-stack keywords (debugging, testing, CI/CD, error handling) into either project where they fit naturally.
  - Do NOT change facts, data, or features — candidate must be able to prove every bullet later.
  - If a bullet already has numbers/metrics → keep them exactly.
  - if you think bullet point is weak rewrite it with better sentence framing without changing any data or feature but injecting missing keywords is must as mentioned.

────────────────────────────────────────────────────
MISSING KEYWORDS INJECTION (applies to ALL cases):
────────────────────────────────────────────────────

🚨🚨🚨 HIGHEST PRIORITY — OVERRIDES ALL OTHER BEFORE/AFTER INSTRUCTIONS 🚨🚨🚨
INJECT EVERY SINGLE KEYWORD from "MISSING KEYWORDS TO INJECT" list (bottom of this prompt).
Suppose missing keyword has aws/azure, injecting one aws or azure is sufficient(pick one which is more suitable to inject). follow this logic for injecting all missing keywords.
Distribution rules:
  (i) Project bullets — FIRST PRIORITY (70-90% of missing keywords).
      For Case 2: inject into the approved project's bullets. Second project gets only non-tech stack keywords.
      For Case 1: inject into the project whose tech stack matches. Non-tech stack keywords go into either.
  (ii) Work experience bullets — (10-20% of missing keywords) ONLY if missing keyword is directly matches exact work experience tech stack. Never add missing languages, frameworks, libraries into experience if the tech stack does not match — user cannot prove it later.
      For ex: If it is java based work experience you can add java related missing keywords but not python or react. 
      ↳ If RESUME_TEXT has 0 work experience → put all missing keywords into project bullets instead.
  (iii) Miscellaneous Skills — max 1-2 broad concepts only (e.g., Agile, Code Review). NEVER put languages/frameworks here.
  - If a keyword appears as an OR group (e.g., "java/python"), inject the specific alternative that fits the project's tech stack. NEVER write the literal slash string into a bullet.
  - Every keyword MUST appear at least once in the final output. Zero exceptions.
  - Keywords must be woven naturally — not awkwardly bolted on.
  - ⛔ NO FORMATTING: Write injected keywords as plain text. Do NOT wrap them in **bold**, *italics*, or any markdown. Output "REST APIs" not "**REST APIs**".

Step 5: Technical Skills (SIMPLE RULE — apply to EVERY category)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE FORMULA (same for all 6 categories):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. Put every skill of this category type from JOB_DESCRIPTION first.
  2. If count < 5, fill remaining slots with user's RESUME_TEXT skills section (same category), prioritized by JOB_DESCRIPTION relevance.
  3. Hard cap = 5 items per category. Never exceed 5.
  4. ⛔ Do NOT extract skills from "Work Experience" or "Projects" bullets — only from JOB_DESCRIPTION or RESUME_TEXT Skills section.

Apply this formula to each category:

LANGUAGES (programming languages only):
  → Put every language from JOB_DESCRIPTION first → append with user's resume languages → max 5.

FRAMEWORKS & LIBRARIES (⚠️ ONE EXTRA RULE — ecosystem filter):
  → Put every framework/library from JOB_DESCRIPTION first → append with user's resume frameworks ONLY if they belong to the SAME ecosystem as the JOB_DESCRIPTION.
  → REMOVE frameworks from a completely different ecosystem:
     - JOB_DESCRIPTION: Java/Spring Boot → REMOVE: Django, Flask, FastAPI, Laravel, Rails
     - JOB_DESCRIPTION: Python/Django → REMOVE: Spring Boot, Hibernate, Express.js
     - JOB_DESCRIPTION: Node.js/Express → REMOVE: Django, Spring Boot, Laravel
     - JOB_DESCRIPTION: React frontend → REMOVE: Angular OR Vue (keep only the JOB_DESCRIPTION one)
  → LOG every removal in "changes": e.g. "Removed Django from frameworks — not relevant to Java/Spring Boot JOB_DESCRIPTION"
  → Max 5.

DATABASES:
  → Put every database from JOB_DESCRIPTION first → append with user's resume databases → max 5.

CLOUD SERVICES:
  → Put every cloud service from JOB_DESCRIPTION first → append with user's resume cloud services → max 5.

DEVELOPER TOOLS (Git, Docker, Postman, Jenkins — professional tools only):
  → Put every developer tool from JOB_DESCRIPTION first → append with user's resume dev tools → max 5.

MISCELLANEOUS (broad concepts only — REST APIs, Agile, Microservices, System Design):
  → Put any broad concepts from JOB_DESCRIPTION that don't fit above categories → append with user's resume miscellaneous → max 5 total.
  → Of these 5, at most 1-2 may come from MISSING KEYWORDS TO INJECT. The rest must come from JOB_DESCRIPTION or RESUME_TEXT Skills section.
  → NEVER put languages, frameworks, or databases here.

Step 6: Certifications and Achievements (MERGED)

- ALWAYS combine all certifications and achievements into a single "certifications_and_achievements" array.
- List certifications FIRST, achievements SECOND.
- Keep max 3-4 total entries. Prioritize by JOB_DESCRIPTION relevance and credibility.
- ⛔ NEVER invent. Only include items explicitly written in RESUME_TEXT.

INCLUDE (in priority order):
✅ Cloud/DevOps certifications (AWS, Azure, GCP, Docker, Kubernetes) — universally relevant
✅ JOB_DESCRIPTION-mentioned certifications (e.g., "Java Certified" if JOB_DESCRIPTION needs Java and mentioned in RESUME_TEXT)
✅ Language-specific certifications (Python, Java, C++)
✅ Competitive programming achievements (LeetCode, CodeChef, Codeforces — with rating/count)
✅ Hackathon wins or top placements
✅ Open-source contributions (if measurable)
✅ Relevant online courses (Coursera, edX, Udemy) — only if JOB_DESCRIPTION-aligned

EXCLUDE:
❌ Non-technical (Excel, Typing, Soft Skills, Communication)
❌ Too basic (HTML/CSS basics if applying for backend role)
❌ Generic "Participation" certificates (unless hackathon win or top 10)
❌ Vague claims like "Good at problem solving"

Format examples:
✅ "Solved 300+ problems on LeetCode (Rating: 1650)"
✅ "Won 2nd place in XYZ Hackathon (50+ teams)"
✅ "Contributed to 3 open-source projects on GitHub (50+ commits)"



RULES (MUST FOLLOW):
1. Return ONLY valid JSON. No markdown code blocks. No **bold**, no *italics*, no # headers inside JSON string values. Plain text only. No explanation outside the JSON and inside it.
2. NEVER output null for string fields (degree, company, job_title, etc.). Use empty string "" if information is missing.
3. In "changes" field, list EVERY modification: "Enhanced [section] bullet X: [old] → [new]", "Injected 'keyword' into Project X bullet Y", "Added X to developer_tools", etc.

⚠️ MANDATORY SELF-VALIDATION (Run this BEFORE writing your JSON output):
Before you output the final JSON, you MUST mentally go through this checklist:

Check 1 — MISSING KEYWORDS COVERAGE CHECK:
  Take the "MISSING KEYWORDS TO INJECT" list from the bottom of this prompt.
  For each keyword in that list, ask yourself:
  - Is this keyword now present somewhere in my JSON output (projects, experience)?
  - If NOT → you MUST go back and insert it where it fits most naturally before finalizing.

Check 2 — MATCHED KEYWORDS PRESENCE CHECK:
  The JOB_DESCRIPTION keywords that were already matched should still be present in the output.
  Verify you did not accidentally delete them while rewriting bullets.

Check 3 — NO FABRICATION CHECK:
  - Did you add any job/degree/project not in RESUME_TEXT? If yes → remove it.
  - Did you add any skill not in RESUME_TEXT Skills section AND not in MISSING KEYWORDS? If yes → remove it.

Only proceed to output JSON after passing all three checks.

HEADING FIELD RULES (apply when filling the heading object below):
- github_url: Include if present in RESUME_TEXT and profile has 3+ repos or active contributions. Format: "github.com/username" (no https://). Omit if empty profile.
- portfolio_url: Optional — include only if deployed portfolio with live projects. Format: "portfolio.com" or "username.github.io". Omit if under construction.
- linkedin_url: Format: "linkedin.com/in/username" (no https://).

OUTPUT FORMAT (Template v1):
{{
  "template_id": "v1",
  "heading": {{
    "name": "Full Name",
    "phone": "+91-XXXXXXXXXX",
    "email": "email@example.com",
    "linkedin_url": "linkedin.com/in/username",
    "github_url": "github.com/username",
    "portfolio_url": "portfolio.com"
  }},
  "summary": "follow above rules",
  "education": [
    {{
      "institution": "University Name",
      "location": "City, State",
      "degree": "B.Tech Computer Science",
      "duration": "Aug 2018 -- May 2022",
      "cgpa": "8.5/10" or null
    }}
  ],
  "experience": [
    {{
      "job_title": "<exact job title from RESUME_TEXT — do NOT alter>",
      "duration": "<exact duration from RESUME_TEXT>",
      "company": "<exact company name from RESUME_TEXT>",
      "location": "<exact location from RESUME_TEXT>",
      "bullets": [
        "<follow what is mentioned in above algorithm>"
      ]
    }}
  ],
  "projects": [
    {{
      "title": "<exact project title from RESUME_TEXT>",
      "tech_stack": "<exact tech stack from RESUME_TEXT limit to 7 prioritized>",
      "link": "Link",
      "bullets": [
        "<follow the algprithm step4>"
      ]
    }}
  ],
  "technical_skills": {{
    "languages": ["Skill 1", "Skill 2", "...(STRICT MAX 5 ITEMS)"],
    "frameworks_and_libraries": ["Skill 1", "Skill 2", "...(STRICT MAX 5 ITEMS)"],
    "databases": ["Skill 1", "Skill 2", "...(STRICT MAX 5 ITEMS)"],
    "cloud_services": ["Skill 1", "Skill 2", "...(STRICT MAX 5 ITEMS)"],
    "developer_tools": ["Skill 1", "Skill 2", "...(STRICT MAX 5 ITEMS)"],
    "miscellaneous": ["Skill 1", "Skill 2", "...(STRICT MAX 5 ITEMS)"]
  }},
  
  CERTIFICATIONS & ACHIEVEMENTS RULES (MANDATORY):
  
  - ALWAYS output a single merged array named "certifications_and_achievements"
  - Put certifications first, followed by achievements
  - ⛔ ABSOLUTE RULE: If RESUME_TEXT has NO certifications or achievements, output an empty array: "certifications_and_achievements": []
  - NEVER invent, fabricate, or generate achievements or certifications that are not present in RESUME_TEXT.
  - "Solved 300+ LeetCode problems", "Won hackathon", "AWS certified" — these may ONLY appear if the user explicitly wrote them in RESUME_TEXT. Not otherwise.
  - ⛔ CRITICAL TYPE RULE: This MUST be a flat array of PLAIN STRINGS. DO NOT return dictionaries or objects like {{"type": "Certification", "name": "..."}}.
   "certifications_and_achievements": [
    "AWS Certified Cloud Practitioner (2024)",
    "Solved 300+ problems on LeetCode (Rating: 1650)",
    "Contributed to 3 open-source projects on GitHub"
  ],
  "changes": [
    "Rewrote Summary: [old summary] → [new summary]",
    "Enhanced Project Food Delivery App bullet 1: 'Built app' → 'Developed scalable food delivery platform using React and Node.js serving 500+ users'",
    "Added Docker to developer_tools",
    "Removed non-relevant skill: Basic Excel",
    "Removed least relevant project: Portfolio Website"
    "describe any changes that you made"
  ],
  "ats_score_before": {ats_score_before},
  "ats_score_after": 0
}}

RESUME_TEXT:
{resume_text}

JOB_DESCRIPTION:
{job_description}

ATS Score Before:
{ats_score_before}

MISSING KEYWORDS TO INJECT:
{missing_keywords}

SELECTED PROJECTS (include ONLY these in the final output — exclude all others):
{selected_projects}

APPROVED_PROJECT (for Case 2 — "none" means Case 1, no approved project):
{approved_project}
"""

