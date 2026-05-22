COMBINED_ANALYSIS_PROMPT = """
Read whole prompt once and proceed to Json result.
You must perform TWO analysis tasks on the same resume and job description below, and return ONE unified JSON object containing results from both tasks.

Return ONLY valid JSON. No markdown code blocks. DO NOT use markdown formatting (like **bold**, *italics*, etc.) inside the JSON string values. Use plain text only. No explanation. Raw JSON only.

INPUT LABELS (referred throughout this prompt):
- RESUME_TEXT → The raw original resume text uploaded by the user (see bottom of this prompt)
- JOB_DESCRIPTION → The target job description (see bottom of this prompt)
Note: Do both tasks independently.
--------------------------------------------------------------------------

════════════════════════════════════════════════════
TASK 1: ATS SCORE ANALYSIS
════════════════════════════════════════════════════

Act as best ATS resume analyzer wrt given job description.
Analyze this resume against the job description. Calculate ATS score and missing skills as instructed below.

TARGET USERS: B.Tech freshers (0-1 year experience) to experienced professionals.
OBJECTIVE: Calculate ATS score based on rigorous keyword and concept matching.

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
5. Identify all_missing_skills: (don't forget) ONLY skills extracted from JOB_DESCRIPTION that are NOT present in RESUME_TEXT. One entry per slot; OR groups shown as single "x/y" entry.
6. HARD EXCLUSION: A skill CANNOT appear in both matched_skills and all_missing_skills. If it matched, it is matched only. If it is missing, it is missing only.
7. HARD EXCLUSION: Do NOT add any skill to matched_skills that is not present in JOB_DESCRIPTION, even if it appears in RESUME_TEXT.
8. Calculate ATS score: (count of matched_skills / (count of matched_skills + count of all_missing_skills)) * 100

⚠️ MANDATORY SELF-VALIDATION (before outputting JSON):
For each skill in your all_missing_skills list, re-scan the ENTIRE RESUME_TEXT one more time.
If the skill (or any OR alternative) appears ANYWHERE in the resume — move it to matched_skills.
This catches accidental misses, especially for skills in the Technical Skills section or project tech stacks.

------------------------------------------------------------------

════════════════════════════════════════════════════
TASK 2: PROJECT RELEVANCE CHECK
════════════════════════════════════════════════════

You are an ATS resume expert. Analyze the RESUME_TEXT projects against the JOB_DESCRIPTION and decide which 2 projects to include in the final resume.

OR CONDITION RULE — apply throughout all steps:
When a JOB_DESCRIPTION lists technologies separated by "/", "OR", commas, or natural language like "proficiency in any one of Python, Java" or "one of React, Angular, Vue" — treat the entire group as ONE slot. Matching ANY ONE satisfies the whole slot. Never treat them as separate independent requirements.
Example: JOB_DESCRIPTION says "java/python" → if RESUME_TEXT has Python, the language slot is fully satisfied. Java is NOT a missing requirement.
Example: JOB_DESCRIPTION says "proficiency in any one of Python, Java" → if RESUME_TEXT has Python, the slot is fully satisfied.

────────────────────────────────────────────────────
STEP 1: Extract JOB_DESCRIPTION tech requirements
────────────────────────────────────────────────────
List every language, framework, library, database, and tool the JOB_DESCRIPTION requires.
Apply OR normalization: "java/python/nodejs" → one slot [java OR python OR nodejs].

────────────────────────────────────────────────────
STEP 2: Find all projects in the RESUME_TEXT
────────────────────────────────────────────────────
A project is a named entry with a title, tech stack, and at least 1 descriptive bullet.
Skills listed under SKILLS or phrases like "built 12+ projects" are NOT projects.

────────────────────────────────────────────────────
STEP 3: Decide the case — check in this EXACT order
────────────────────────────────────────────────────

MATCHING SCOPE — what counts as "language/framework/library" for Case triggers:
  ✅ COUNTS: Programming languages (Java, Python, JavaScript, C++, Go, TypeScript),
             Frameworks (Spring Boot, Django, React, Angular, Express.js, Flask, Node.js, Next.js),
             Libraries (NumPy, Pandas, jQuery, Mongoose, TensorFlow)
  ❌ DOES NOT COUNT: Databases (MongoDB, MySQL, PostgreSQL, Redis),
                     Concepts (REST APIs, Microservices, OOP, Multithreading),
                     DevOps/Tools (Docker, Git, Kubernetes, CI/CD, Postman),
                     Methodologies (Agile, Scrum, Code Review, Unit Testing)

CASE 1 — No new project needed:

  Trigger: RESUME_TEXT projects already cover the majority of the JOB_DESCRIPTION's primary
           tech stack (languages, frameworks, libraries only). Use your judgment — consider parent
           technologies (e.g., Next.js implies JavaScript, FastAPI implies Python), "or similar"
           phrasing, and soft requirements ("one of", "e.g.", "etc.") as satisfied.
           OR CONDITION: If JOB_DESCRIPTION lists alternatives such as "Java/Python" or
           "React OR Angular", matching ANY ONE fully satisfies that slot (e.g., Python alone
           satisfies "Java/Python") — do NOT treat unmatched alternatives as missing requirements.
           Dont consider Databases, cloud services, and DevOps tools or any concepts for project matching requirements.(strictly follow) - only consider languages, libraries, frameworks following OR codnition rule.
  Action: Pick the top 2 most JOB_DESCRIPTION-relevant projects. No new project needed.

CASE 2 — New project needed:
  Trigger only if case1 fails: There is a significant, undeniable gap in the JOB_DESCRIPTION's core tech stack
           (languages, frameworks, libraries) that no existing RESUME_TEXT project(s) can
           reasonably cover — even accounting for related/parent technologies (or) OR CONDITION applied.
  Action: Suggest a completely new project using the JOB_DESCRIPTION's primary tech stack.
  Second project = most JOB_DESCRIPTION-relevant existing RESUME_TEXT project (if one exists — ALWAYS include it in selected_projects; do NOT drop it).

────────────────────────────────────────────────────
STEP 4: Build suggested_project (for Case 2 only)
────────────────────────────────────────────────────
select project idea which is achievable by a fresher.
title: creative domain-specific product name — NOT a tech stack description like "Django REST App".
  Pattern: domain-action word + product suffix.
  🚨 IMPORTANT: INVENT a unique name. Do NOT reuse the examples provided in this prompt (e.g., "VitalTrack", "SpendLens", "CartEngine", "TaskFlow").
tech_stack: 4-5 technologies from JOB_DESCRIPTION's required stack (comma-separated string).
description: 2-3 sentences — (a) real-world problem it solves, (b) how JOB_DESCRIPTION tech is used naturally, (c) the outcome. Rich enough to write 3-4 bullets from.

────────────────────────────────────────────────────
STEP 5: Build the two missing-skills lists
────────────────────────────────────────────────────
You must produce TWO separate missing-skills lists:

a) all_missing_skills — every skill from JOB_DESCRIPTION that is NOT in RESUME_TEXT.
   This is the full unfiltered list shown to the user on the results page so they can cross-check.
   Use the exact same OR-group entries as Task 1 (e.g. "java/python" as one entry).

b) updated_missing_skills — the filtered list that will be passed to the resume generation step.
   Start from all_missing_skills, then REMOVE any OR-slot that is already covered by the 2 selected projects.
   A slot is covered if ANY alternative in the OR group appears in the tech stack of the 2 selected projects (including the suggested_project's tech_stack for Case 2).

   FILTERING RULE (apply the OR CONDITION):
   - If an OR slot such as "java/python" is covered by Python in a selected project → remove the entire "java/python" entry from updated_missing_skills.
   - If a slot is NOT covered by any selected project → keep it in updated_missing_skills.
   - Only remove TECH STACK slots (languages, frameworks, libraries, databases). Never remove concepts (REST APIs, OOP), DevOps tools (Docker, CI/CD), or methodologies (Agile) — those must stay in updated_missing_skills so the generation step can weave them into resume bullets.

   Example: JD has "java/python". Suggested new project uses Python. → "java/python" slot is covered → remove from updated_missing_skills. But "REST APIs" is still missing → keep it in updated_missing_skills.

────────────────────────────────────────────────────
WORKED EXAMPLES
────────────────────────────────────────────────────

Example A — Case 1 (both existing projects cover the core JD stack):
  RESUME_TEXT: Project 1 "API Backend" uses Python, Django.
          Project 2 "Dashboard" uses React, Node.js
  JD: "python/nodejs, django, postgresql, REST APIs, agile"
  ATS Task: all_missing_skills: ["postgresql"] (REST APIs and Agile are concepts/methodologies)
  Project Task: selected projects cover python/nodejs, django — Case 1.
  STEP 5: "python/nodejs" OR slot is covered by Project 1 (Python) AND Project 2 (Node.js) → remove from updated_missing_skills.
          "postgresql" is a database not covered by any project → keep in updated_missing_skills.
          "REST APIs" is a concept → keep in updated_missing_skills.
          "agile" is a methodology → keep in updated_missing_skills.
  all_missing_skills: ["postgresql", "REST APIs", "agile"]
  updated_missing_skills: ["postgresql", "REST APIs", "agile"]  ← same here since no OR tech slot was covered
  selected_projects: ["API Backend", "Dashboard"]
  suggested_project: null
  requires_consent: false


Example B — Case 2 (new project needed, OR-slot filtered from updated_missing_skills):
  RESUME_TEXT: "Ecommerce Website" uses HTML, CSS, JavaScript, nodejs, mysql.
  JD: "java/python, springboot, REST APIs, unit testing"
  ATS Task: all_missing_skills: ["java/python", "springboot", "REST APIs", "unit testing"]
  Project Task: no existing project covers java/python lang slot → Case 2.
  suggested_project: title "HireTrack", tech_stack: "Python, Spring Boot, MySQL"
  selected_projects: ["HireTrack", "Ecommerce Website"]
  STEP 5: "java/python" OR slot — suggested project uses Python → covered → REMOVE from updated_missing_skills.
          "springboot" covered by suggested project → REMOVE from updated_missing_skills.
          "REST APIs" is a concept → KEEP in updated_missing_skills.
          "unit testing" is a methodology → KEEP in updated_missing_skills.
  all_missing_skills: ["java/python", "springboot", "REST APIs", "unit testing"]
  updated_missing_skills: ["REST APIs", "unit testing"]

════════════════════════════════════════════════════
COMBINED OUTPUT — return ONLY valid JSON, no markdown, no explanation, no symbols like **, #.
════════════════════════════════════════════════════

{{
  "ats_score": <integer 0-100>,
  "matched_skills": ["javascript", "REST APIs", "docker"],
  "all_missing_skills": ["java/python", "spring boot", "REST APIs"],
  "updated_missing_skills": ["REST APIs"],
  "case": <1 or 2>,
  "selected_projects": ["Title1", "Title2"],
  "suggested_project": {{
    "title": "<unique creative name>",
    "tech_stack": "<comma-separated string, max 7 items>",
    "description": "<2-3 sentence description>"
  }},
  "requires_consent": true,
  "least_relevant_project": "<lowest-scoring resume project title or null>",
  "total_projects_count": 2
}}

Field rules:
- ats_score: integer 0-100. Formula: (count of matched_skills / (count of matched_skills + count of all_missing_skills)) * 100.
- matched_skills: skills from JOB_DESCRIPTION that are explicitly present in RESUME_TEXT.
- all_missing_skills: ALL skills from JOB_DESCRIPTION not in RESUME_TEXT. Full unfiltered list. One entry per OR slot. This is shown to the user on the results page.
- updated_missing_skills: Filtered version of all_missing_skills. Remove any OR tech-stack slot already covered by the 2 selected projects (including suggested_project). Concepts, DevOps, and methodologies are NEVER removed — they stay here for the generation step to inject into bullets.
- case: 1 or 2 (integer).
- selected_projects: max 2 entries. If resume has 0 or 1 existing project, may have only 1 entry.
- suggested_project: object for Case 2, null for Case 1.
- requires_consent: JSON boolean true for Case 2, JSON boolean false for Case 1. MUST be true or false — NOT the strings "true" or "false".
- least_relevant_project: title of lowest-scoring existing RESUME_TEXT project (shown in UI as which project gets replaced). null if resume has 0 or 1 project.
- total_projects_count: integer count of distinct project entries found in the RESUME_TEXT. Does NOT count the new/upgraded suggested project. Must be an integer, NOT a string.
- tech_stack must be a comma-separated STRING, not an array.

════════════════════════════════════════════════════
INPUTS
════════════════════════════════════════════════════

RESUME_TEXT:
{resume_text}

JOB_DESCRIPTION:
{job_description}
"""
