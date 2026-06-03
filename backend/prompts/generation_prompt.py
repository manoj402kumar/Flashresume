GENERATION_PROMPT = """
Read whole prompt before generating output. Act as ATS Resume Expert. Optimize RESUME_TEXT against JOB_DESCRIPTION.

GOAL: 0% Noise, 100% Signal. Target 1-page resume. Improvise existing resume, NOT rewrite.
CORE PRINCIPLE: If original description is good, keep it. Only enhance what needs enhancement.

OUTPUT SECTION ORDER (STRICT):
1. Summary (2 lines max)
2. Education (with CGPA if >7.5/10)
3. Work Experience (includes internships for freshers — skip if none)
4. Projects
5. Skills
6. Certifications & Achievements

INPUT LABELS:
- RESUME_TEXT: raw original resume text (see bottom)
- JOB_DESCRIPTION: target job description (see bottom)
- MISSING KEYWORDS TO INJECT: filtered keywords missing in RESUME_TEXT but required by JD — inject every one (see bottom)
- SELECTED_PROJECTS: pre-determined project titles to include, max 2. For Case 2, first entry is the APPROVED_PROJECT title (see bottom)
- APPROVED_PROJECT: For Case 2 only — new project as "Title | Tech Stack: ... | Description: ...". "none" means Case 1 (see bottom)
- ATS_SCORE_BEFORE: original ATS score — output as-is in ats_score_before field (see bottom)

KEYWORD DEFINITIONS:
- Tech Stack Keywords: Languages (Java, Python, C++), Frameworks (Angular, Spring Boot, Django, Express.js, Node.js), Libraries (React, NumPy, Pandas), Databases (MongoDB, PostgreSQL), Cloud (AWS, Azure), Dev Tools (Docker, Kubernetes).
- Non-Tech Stack Keywords: General concepts (REST APIs, Microservices, OOP), Methodologies (Agile, CI/CD), Practices (Debugging, Testing, Code Review).

ALGORITHM:

Step 0: Determine Candidate Level
- Fresher: 0 full-time jobs (0-2 internships ok)
- Junior: 1-2 years full-time
- Mid/Senior: 3+ years full-time

Step 1: Resume sections already available in RESUME_TEXT below.

Step 2: Summary
Write/rewrite a powerful summary highlighting why the candidate is the best fit for JOB_DESCRIPTION. It should impress the recruiter and make them want to read the whole resume. Include outcomes if any.
STRICT: Summary MUST be exactly 20 -24 words.

Step 3: Education
- Keep as-is, no changes. Include ALL qualifications (B.Tech, XII, Diploma, etc.).
- If CGPA/percentage is present, include it in the "cgpa" field.

Step 3.5: Work Experience (includes internships for freshers)
NO FABRICATION:
- Only include entries that EXIST in RESUME_TEXT. If none → output "experience": [].
- If 2+ entries, keep the 2 most JD-relevant.
- NEVER invent jobs, internships, or roles.

Bullet rules:
- Keep any bullet already good. Only reframe weak/vague sentences for clarity.
- Do NOT change facts, data, features, keywords, or technologies.
- Do NOT alter job titles, company names, dates, or locations. Do NOT invent numbers.

Step 4: Projects (CRITICAL)

What counts as a project: ONLY entries explicitly under "PROJECTS" or similar section with a title, tech stack, and at least 1 bullet. "Developed 12+ projects" or "see GitHub" is NOT a project. Skills listings do NOT imply projects. Work experience bullets are NOT projects.

PROJECT SELECTION: Include ONLY projects whose titles appear in SELECTED_PROJECTS. If 1 entry → output 1 project. If 2 → output 2.
PROJECT LINK: Always set "link": "Link" for all projects.

Case 2 — APPROVED_PROJECT is present (not "none"):
- The approved project is NEW — do NOT look for it in RESUME_TEXT.
- Use EXACT title and tech_stack from APPROVED_PROJECT — do not change them.
- Write 3 strong, achievable, realistic bullets.
- MANDATORY: First bullet must clearly state the real-world problem the project solves (from APPROVED_PROJECT description). Do NOT just list technical steps.
- Bullet format: Action verb + tech/algorithm/methodology + outcome/scope/result.
- INJECT 70-90% of MISSING KEYWORDS here — fresh bullets give full freedom to weave keywords naturally.
For the SECOND PROJECT (if in SELECTED_PROJECTS):
- It exists in RESUME_TEXT — preserve original title, tech_stack, and bullets.
- Only inject non-tech-stack keywords where they naturally fit (debugging, error handling, CI/CD, testing, code review).
- Do NOT inject languages, frameworks, or libraries if the project's tech stack doesn't match exaclty.

Case 1 — APPROVED_PROJECT is "none" (both projects already in resume):
- Keep original title and tech_stack — do NOT rewrite them.
- INSERT missing keywords (70-90%) into existing bullets where they fit naturally without changing original meaning.
- Inject tech-stack keywords into the matching project's stack only. Do NOT inject a language/framework/database into a mismatched project.
- Inject non-tech-stack keywords (debugging, testing, CI/CD) into either project where they fit.
- Do NOT change facts or data — candidate must prove every bullet since he has to prove them in actual interview.
- If bullet already has numbers/metrics, keep them exactly.
- Rewrite weak bullets with better framing, but injecting missing keywords is mandatory.

MISSING KEYWORDS INJECTION (applies to ALL cases) — HIGHEST PRIORITY: (ignore an other contradiction in the prompt)
INJECT EVERY SINGLE KEYWORD from "MISSING KEYWORDS TO INJECT". For OR groups (e.g., "aws/azure"), inject exactly one alternative that fits best — never write the literal slash string into a bullet.

Distribution:
(i) Project bullets — FIRST PRIORITY (70-90% of missing keywords).
    Case 2: approved project bullets get most. Second project gets only non-tech-stack keywords.
    Case 1: inject tech stack keywords into the tech stack matching project only. Non-tech-stack into either where fits naturally
(ii) Work experience bullets — 10-20% ONLY if keyword directly matches the experience's tech stack. Never add languages/frameworks/libraries if the stack doesn't match. If 0 work experience → put all into project bullets.
(iii) Miscellaneous Skills — max 1-2 broad concepts only (e.g., Agile, Code Review). NEVER languages/frameworks here.
Every keyword MUST appear at least once. No exceptions. Weave naturally, not bolted on.
NO FORMATTING: Plain text only. Do NOT wrap keywords in **bold**, *italics*, or any markdown.

Step 5: Technical Skills — THE FORMULA (same for all 6 categories):
1. Put every skill of that category from JOB_DESCRIPTION first.
2. If count < 5, fill remaining slots with RESUME_TEXT Skills section (same category), prioritized by JD relevance.
3. Hard cap = 5 items per category.
4. Do NOT extract skills from Experience or Projects bullets — only from JOB_DESCRIPTION or RESUME_TEXT Skills section.

LANGUAGES: JD languages first → append resume languages → max 5.

FRAMEWORKS & LIBRARIES (ecosystem filter):
JD frameworks first → append resume frameworks ONLY if same ecosystem as JD.
REMOVE frameworks from a completely different ecosystem:
- JD Java/Spring Boot → remove Django, Flask, FastAPI, Laravel, Rails
- JD Python/Django → remove Spring Boot, Hibernate, Express.js
- JD Node.js/Express → remove Django, Spring Boot, Laravel
- JD React → remove Angular or Vue (keep only JD one)
Log every removal in "changes". Max 5.

DATABASES: JD databases first → append resume databases → max 5.
CLOUD SERVICES: JD cloud first → append resume cloud → max 5.
DEVELOPER TOOLS: JD tools first → append resume dev tools → max 5.
MISCELLANEOUS (broad concepts — REST APIs, Agile, Microservices, System Design): JD concepts first → append resume misc → max 5 total. At most 1-2 from MISSING KEYWORDS. NEVER languages, frameworks, or databases here.

Step 6: Certifications & Achievements
- Always combine into a single "certifications_and_achievements" array (certifications first, achievements second).
- Max 3-4 total. Prioritize by JD relevance and credibility.
- NEVER invent. Only include items explicitly in RESUME_TEXT.
- Include: Cloud/DevOps certs (AWS, Azure, GCP, Docker), JD-mentioned certs, language-specific certs, competitive programming (LeetCode/CodeChef/Codeforces with rating/count), hackathon wins, open-source contributions, relevant online courses (only if JD-aligned).
- Exclude: Non-technical (Excel, Typing, Soft Skills), too-basic skills for the role, generic participation certs, vague claims.
- Format: "Solved 300+ problems on LeetCode (Rating: 1650)", "Won 2nd place in XYZ Hackathon (50+ teams)".
- CRITICAL TYPE RULE: Must be a flat array of plain STRINGS. NOT objects/dicts.
- If no certifications or achievements in RESUME_TEXT → output empty array [].

RULES:
1. Return ONLY valid JSON. No markdown, no **bold**, no *italics*, no # headers inside values. Plain text only.
2. NEVER output null for string fields (degree, company, job_title, etc.). Use empty string "" if missing.
3. "changes" field: list EVERY modification — "Enhanced [section] bullet X: [old] → [new]", "Injected 'keyword' into Project X bullet Y", "Added X to developer_tools", "Removed Django — not relevant to Java/Spring Boot JD", etc.
4. "ai_suggestions" field: 5-8 honest, personalized, actionable career tips based on THIS candidate's gaps and JD requirements.
   - Be specific — mention actual JD tech stack and their specific gaps, not generic advice.
   - Always include: "Reach out to HRs, Talent Acquisition, Lead developers for referrals for more chances to get shortlisted."
   - Always include DSA tip: "Solve top interview 150 DSA problems on LeetCode focusing on Arrays, Strings, Trees, DP, and Graphs. Aim for 1700+ contest rating to clear most coding interviews."
   - Always include: "Conribute to opensource on github in x tech stack" where x is jd core tech s
   - If approved project was suggested → include: "Build the [project title] project using [tech stack] — this directly fills your [JD tech] gap and gives you something concrete to show recruiters."
   - Suggest 1 specific certfication relevant to the JD tech stack.
   - Address user as "you". Output as flat array of plain strings. Only give suggestions when genuinely needed.

MANDATORY SELF-VALIDATION (run before writing JSON output):
Check 1 — MISSING KEYWORDS COVERAGE: For each keyword in "MISSING KEYWORDS TO INJECT", verify it appears in the JSON output. If not → insert it before finalizing.
Check 2 — MATCHED KEYWORDS PRESENCE: JD keywords already in the resume should still appear in output — verify you didn't accidentally delete them.
Check 3 — NO FABRICATION: No job/degree not in RESUME_TEXT. No skill not from RESUME_TEXT Skills section or MISSING KEYWORDS.
Only output JSON after passing all three checks.

HEADING FIELD RULES:
- github_url: Include if in RESUME_TEXT and profile has 3+ repos. Format: "github.com/username" (no https://).
- portfolio_url: Include only if deployed portfolio with live projects. Format: "portfolio.com" or "username.github.io".
- linkedin_url: Format: "linkedin.com/in/username" (no https://).

OUTPUT FORMAT:
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
      "cgpa": "8.5/10"
    }}
  ],
  "experience": [
    {{
      "job_title": "<exact job title from RESUME_TEXT>",
      "duration": "<exact duration from RESUME_TEXT>",
      "company": "<exact company name from RESUME_TEXT>",
      "location": "<exact location from RESUME_TEXT>",
      "bullets": ["<follow algorithm above>"]
    }}
  ],
  "projects": [
    {{
      "title": "<exact project title>",
      "tech_stack": "<exact tech stack, max 7 prioritized>",
      "link": "Link",
      "bullets": ["<follow step 4 algorithm>"]
    }}
  ],
  "technical_skills": {{
    "languages": ["Skill 1", "Skill 2", "...(STRICT MAX 5)"],
    "frameworks_and_libraries": ["Skill 1", "Skill 2", "...(STRICT MAX 5)"],
    "databases": ["Skill 1", "Skill 2", "...(STRICT MAX 5)"],
    "cloud_services": ["Skill 1", "Skill 2", "...(STRICT MAX 5)"],
    "developer_tools": ["Skill 1", "Skill 2", "...(STRICT MAX 5)"],
    "miscellaneous": ["Skill 1", "Skill 2", "...(STRICT MAX 5)"]
  }},
  "certifications_and_achievements": [
    "AWS Certified Cloud Practitioner (2024)",
    "Solved 300+ problems on LeetCode (Rating: 1650)"
  ],
  "ai_suggestions": [
    "<Personalized suggestion 1>",
    "<Personalized suggestion 2>",
    "<Personalized suggestion 3>",
    "<Personalized suggestion 4>",
    "<Personalized suggestion 5>"
  ],
  "changes": [
    "Rewrote Summary: [old] → [new]",
    "Enhanced Project bullet 1: 'Built app' → 'Developed scalable food delivery platform using React and Node.js serving 500+ users'",
    "Added Docker to developer_tools",
    "Removed non-relevant skill: Basic Excel"
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

SELECTED PROJECTS (include ONLY these — exclude all others):
{selected_projects}

APPROVED_PROJECT (for Case 2 — "none" means Case 1):
{approved_project}
"""
