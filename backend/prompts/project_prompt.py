PROJECT_CHECK_PROMPT = """
Read whole prompt once and proceed to Json result.

You are an ATS resume expert. Analyze the RESUME_TEXT projects against the JOB_DESCRIPTION and decide which 2 projects to include in the final resume.

INPUT LABELS (referred throughout this prompt):
- RESUME_TEXT → The raw original resume text uploaded by the user (see bottom of this prompt)
- JOB_DESCRIPTION → The target job description (see bottom of this prompt)

OR CONDITION RULE — apply throughout all steps:
When a JOB_DESCRIPTION lists technologies separated by "/" or "OR" (e.g., "java/python", "react OR angular", "mysql/postgresql"), treat the entire group as ONE slot. Matching ANY ONE satisfies the whole slot. Never treat them as separate independent requirements.
Example: JOB_DESCRIPTION says "java/python" → if RESUME_TEXT has Python, the language slot is fully satisfied. Java is NOT a missing requirement.

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
           tech stack (languages, frameworks, libraries). Use your judgment — consider parent
           technologies (e.g., Next.js implies JavaScript, FastAPI implies Python), "or similar"
           phrasing, and soft requirements ("one of", "e.g.", "etc.") as satisfied.
          dont consider any databases, cloud services, devops tools as mandatory requirements in projects.
  Action: Pick the top 2 most JOB_DESCRIPTION-relevant ones. No new project needed.

CASE 2 — New project needed:
  Trigger: There is a significant, undeniable gap in the JOB_DESCRIPTION's core tech stack
           (languages, frameworks, libraries) that no existing RESUME_TEXT project(s) can
           reasonably cover — even accounting for related/parent technologies.
  Action: Suggest a completely new project using the JOB_DESCRIPTION's primary tech stack.
  Second project = most JOB_DESCRIPTION-relevant existing RESUME_TEXT project (if one exists — ALWAYS include it in selected_projects; do NOT drop it).

────────────────────────────────────────────────────
STEP 4: Build suggested_project (Case 2 only)
────────────────────────────────────────────────────

title: creative domain-specific product name — NOT a tech stack description like "Django REST App".
  Pattern: domain-action word + product suffix.
  🚨 IMPORTANT: INVENT a unique name. Do NOT reuse the examples provided in this prompt (e.g., "VitalTrack", "SpendLens", "CartEngine", "TaskFlow").
tech_stack: 4-5 technologies from JOB_DESCRIPTION's required stack (comma-separated string).
description: 2-3 sentences — (a) real-world problem it solves, (b) how JOB_DESCRIPTION tech is used naturally, (c) the outcome. Rich enough to write 3-4 bullets from.

────────────────────────────────────────────────────
STEP 5: Build covered_jd_tech
────────────────────────────────────────────────────
List every JOB_DESCRIPTION tech item satisfied by the 2 selected projects combined (including the new project's tech_stack).

OR GROUP RULE: If JOB_DESCRIPTION says "java/python" and Python is covered, add BOTH "java" AND "python" to covered_jd_tech. The entire OR slot is satisfied, so all alternatives must be listed (this prevents false "missing keywords" later in the pipeline).

────────────────────────────────────────────────────
WORKED EXAMPLES
────────────────────────────────────────────────────

Example A — Case 1 (both existing cover everything):
  RESUME_TEXT: Project 1 "API Backend" uses Python, Django.
          Project 2 "Dashboard" uses React, Node.js
  JOB_DESCRIPTION requires: "python/nodejs, django, postgresql, react"
  Project 1 covers: python/nodejs slot (via python) ✅, django ✅, postgresql ✅
  Project 2 covers: react ✅, python/nodejs slot (via nodejs) ✅
  Together they cover all slots → Case 1
  selected_projects: ["API Backend", "Dashboard"]
  suggested_project: null
  requires_consent: false
  covered_jd_tech: ["python", "nodejs", "django", "postgresql", "react"]


Example B — Case 2 (no match, brand new project):
  RESUME_TEXT: "Ecommerce Website" uses HTML, CSS, JavaScript, nodejs, mysql.
  JOB_DESCRIPTION requires: "java, springboot, mysql"
  No project matches any JOB_DESCRIPTION lang/fw/lib → Case 2
  suggested_project:
    title: "TaskFlow"
    tech_stack: "Java, springboot, mysql"
    description: "A task management platform where teams create boards, assign tasks, and track progres."
  selected_projects: ["TaskFlow", "Ecommerce Website"]
  covered_jd_tech: ["java", "springboot", "mysql"]

────────────────────────────────────────────────────
OUTPUT — return ONLY valid JSON, no markdown, no explanation, no symbols like **, #.
────────────────────────────────────────────────────

{{
  "case": 2,
  "selected_projects": ["Title1", "Title2"],
  "suggested_project": {{
    "title": "any unique name",
    "tech_stack": "comma-separated string, max 7 items",
    "description": "2-3 sentence description"
  }},
  "covered_jd_tech": ["python", "django", "mysql"],
  "requires_consent": true,
  "least_relevant_project": "lowest-scoring resume project title or null",
  "total_projects_count": 2
}}

Field rules:
- case: 1 or 2 (integer).
- selected_projects: max 2 entries. If resume has 0 or 1 existing project, may have only 1 entry.
- suggested_project: object for Case 2, null for Case 1.
- covered_jd_tech: all JOB_DESCRIPTION tech items satisfied by both selected projects combined, including all OR-slot alternatives when any one is matched.
- requires_consent: true for Case 2, false for Case 1.
- least_relevant_project: title of lowest-scoring existing RESUME_TEXT project (shown in UI as which project gets replaced). null if resume has 0 or 1 project.
- total_projects_count: count of distinct project entries found in the RESUME_TEXT. Does NOT count the new/upgraded suggested project.
- tech_stack must be a comma-separated STRING, not an array.

────────────────────────────────────────────────────
INPUTS
────────────────────────────────────────────────────

RESUME_TEXT:
{resume_text}

JOB_DESCRIPTION:
{job_description}
"""
