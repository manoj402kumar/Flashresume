COMBINED_ANALYSIS_PROMPT = """
Read whole prompt once then output JSON. Perform TWO tasks on the resume and job description below. Return ONE unified JSON object. Return ONLY valid JSON. No markdown, no bold/italic formatting inside values, no explanation.

INPUT LABELS:
- RESUME_TEXT: raw resume text (see bottom)
- JOB_DESCRIPTION: target job description (see bottom)
Do both tasks independently.

OR CONDITION RULE (apply throughout both tasks):
When JD lists alternatives via "/", "OR", commas, or natural language (ex: "one of React, Angular, Vue", "proficient in java/python") — treat the entire group as ONE slot.
- Resume matches ANY ONE → slot is MATCHED. Add only the matched alternative to matched_skills. Do NOT add unmatched alternatives to missing_skills.
- Resume matches NONE → slot is MISSING. Add the full group as ONE entry (e.g. "java/python") to missing_skills.
- NEVER split one OR group into separate entries.

---- TASK 1: ATS SCORE ANALYSIS ----

Act as an ATS resume analyzer. TARGET USERS: freshers to experienced professionals.

DEFINITION OF A SKILL/KEYWORD — extract ALL ATS-relevant keywords from the entire JD:
- Hard Skills & Technologies (Spring Boot, REST APIs, SQL, Git, MongoDB)
- Programming Concepts & Paradigms (OOP, Multithreading, Exception Handling)
- Methodologies & Practices (Unit Testing, CI/CD, Agile, Code Review)
- System Design Concepts (Microservices, Caching, Authentication)

Rules:
1. Extract ALL critical keywords from the JD using the definition above.
2. Apply OR CONDITION RULE — normalize slash/OR groups into single slots before matching.
3. STRICT VERBATIM MATCHING ONLY: A skill counts as matched ONLY if its EXACT TERM (or a universally accepted abbreviation, e.g. "REST API" = "RESTful API") appears literally as a word or phrase in RESUME_TEXT. Do NOT infer from context, do NOT assume that using a technology implies knowing related concepts.
   - FORBIDDEN inferences (examples of what NOT to do):
     • Resume mentions "Spring Boot" → do NOT auto-match "REST APIs" unless the words "REST API" / "RESTful" appear literally.
     • Resume mentions a project built with Django → do NOT auto-match "OOP" unless resume explicitly says OOP/object-oriented.
     • Resume lists "MySQL" → do NOT auto-match "SQL" unless the word "SQL" also appears literally.
     • Resume mentions "Docker" → do NOT auto-match "CI/CD" or "DevOps" unless those exact words appear.
   - Each skill must pass this test: "Does the exact skill keyword appear as a recognizable token in the resume text?" — YES → matched, NO → missing. No exceptions.
4. matched_skills: skills from JOB_DESCRIPTION whose EXACT TERM is literally present in RESUME_TEXT.
5. all_missing_skills: skills from JOB_DESCRIPTION whose exact term is NOT literally present in RESUME_TEXT. One entry per slot; OR groups as single "x/y" entry.
6. A skill cannot appear in both lists.
7. Do NOT add any skill to matched_skills that is not in JOB_DESCRIPTION.
8. ATS score = (matched_skills count / (matched + missing) count) * 100.

MANDATORY SELF-VALIDATION: For each skill in all_missing_skills, scan ENTIRE RESUME_TEXT one final time for the EXACT TERM only. Move to matched_skills ONLY if the verbatim keyword appears — do NOT move based on related terms, synonyms, or implied usage.

---- TASK 2: PROJECT RELEVANCE CHECK ----

Analyze RESUME_TEXT projects against JOB_DESCRIPTION. Decide which 2 projects to include.

STEP 1: Extract JD tech requirements (languages, frameworks, libraries, databases, tools). Apply OR normalization.

STEP 2: Find all projects in RESUME_TEXT. A project = named entry with title, tech stack, and at least 1 bullet. Skills-only sections or phrases like "built 12+ projects" are NOT projects.

STEP 3: Decide the case:

MATCHING SCOPE for case triggers — ONLY consider:
  COUNTS: Programming languages, Frameworks, Libraries
  DOES NOT COUNT: Databases, Concepts (REST APIs, OOP), DevOps/Tools (Docker, Git), Methodologies (Agile)

CASE 1 — No new project needed:
  Trigger: Resume projects already cover the majority of JD's primary tech stack (languages, frameworks, libraries only). Consider parent technologies (Next.js implies JavaScript), "or similar" phrasing, OR CONDITION. Do NOT count databases, cloud, DevOps, or concepts.
  Action: Pick top 2 most JD-relevant existing projects.

CASE 2 — New project needed:
  Trigger only if Case 1 fails: Significant, undeniable gap in JD's core tech stack (languages, frameworks, libraries) that no existing project can reasonably cover.
  Action: Suggest a new project using JD's primary tech stack that solves real world problem. Second project = most relevant existing resume project (always include it).

STEP 4: Build suggested_project (for Case 2 only):
  select a project idea that solves real world problem and aligns with JD's tech stack and requirements.
  title: write a short unique creative name — do NOT reuse examples from this prompt.
  tech_stack: 4-5 technologies from JD's required stack (comma-separated string).
  description: 2-3 sentences — (a) real-world problem solved, (b) how JD tech is used naturally, (c)achievable outcome/metric/scope/result for a fresher. Rich enough to write 3 bullets from.

STEP 5: Build the two missing-skills lists:
a) all_missing_skills — same list from Task 1. Full unfiltered list shown to user.
b) updated_missing_skills — start from all_missing_skills, then REMOVE any OR-slot already covered by the 2 selected projects' tech stacks.
   - If "java/python" slot is covered by Python in a selected project → remove the entire "java/python" entry.
   - Only remove tech stack slots (languages, frameworks, libraries, databases). NEVER remove concepts (REST APIs, OOP), DevOps tools (Docker, CI/CD), or methodologies (Agile) — keep those for the generation step.

WORKED EXAMPLES:

Example A — Case 1:
  Resume: Project1 "API Backend" (Python, Django), Project2 "Dashboard" (React, Node.js)
  JD: "python/nodejs, django, postgresql, REST APIs, agile"
  all_missing_skills: ["postgresql", "REST APIs", "agile"]
  "python/nodejs" OR slot covered by existing projects → no OR-tech entry to remove.
  updated_missing_skills: ["postgresql", "REST APIs", "agile"]
  selected_projects: ["API Backend", "Dashboard"], suggested_project: null, requires_consent: false

Example B — Case 2:
  Resume: "Ecommerce Website" (HTML, CSS, JavaScript, nodejs, mysql)
  JD: "java/python, springboot, REST APIs, unit testing"
  all_missing_skills: ["java/python", "springboot", "REST APIs", "unit testing"]
  No existing project covers java/python → Case 2.
  suggested_project: title "Shoecart", tech_stack: "java, Spring Boot, MySQL"
  "java/python" covered by suggested project (Java) → remove. "springboot" covered → remove. "REST APIs" concept → keep. "unit testing" methodology → keep.
  updated_missing_skills: ["REST APIs", "unit testing"]

---- COMBINED OUTPUT ----

Return ONLY valid JSON, no markdown, no explanation:

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
- ats_score: integer 0-100. Formula: (matched count / (matched + missing) count) * 100.
- matched_skills: JD skills explicitly present in RESUME_TEXT.
- all_missing_skills: ALL JD skills not in RESUME_TEXT. One entry per OR slot. Shown to user.
- updated_missing_skills: Filtered all_missing_skills — remove OR tech-stack slots covered by 2 selected projects. Concepts, DevOps, methodologies are NEVER removed.
- case: 1 or 2 (integer).
- selected_projects: max 2 entries.
- suggested_project: object for Case 2, null for Case 1.
- requires_consent: JSON boolean true/false (NOT strings).
- least_relevant_project: title of lowest-scoring existing project, or null if 0-1 projects.
- total_projects_count: integer count of distinct projects in RESUME_TEXT (does NOT include suggested_project).
- tech_stack must be a comma-separated STRING, not an array.

---- INPUTS ----

RESUME_TEXT:
{resume_text}

JOB_DESCRIPTION:
{job_description}
"""
