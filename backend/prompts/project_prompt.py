PROJECT_CHECK_PROMPT = """
You are an ATS resume expert. Analyze the resume projects against the job description and decide which 2 projects to include in the final resume.

OR CONDITION RULE — apply throughout all steps:
When a JD lists technologies separated by "/" or "OR" (e.g., "java/python", "react OR angular", "mysql/postgresql"), treat the entire group as ONE slot. Matching ANY ONE satisfies the whole slot. Never treat them as separate independent requirements.
Example: JD says "java/python" → if resume has Python, the language slot is fully satisfied. Java is NOT a missing requirement.

────────────────────────────────────────────────────
STEP 1: Extract JD tech requirements
────────────────────────────────────────────────────
List every language, framework, library, database, and tool the JD requires.
Apply OR normalization: "java/python/nodejs" → one slot [java OR python OR nodejs].

────────────────────────────────────────────────────
STEP 2: Find all projects in the resume
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

CASE 1 — check FIRST:
  Trigger: Resume projects together cover ALL JD language/framework/library slots (using MATCHING SCOPE above, OR condition applied). dont consider databases for matching.
  Action: Pick the top 2 most JD-relevant ones. No new project needed.

CASE 2 — check ONLY if Case 1 did not trigger:
  Trigger: Not all JD language/framework/library slots are covered by existing resume projects.
  Action: Suggest a completely new project using the JD's primary tech stack.
  Second project = most JD-relevant existing resume project (if one exists — ALWAYS include it in selected_projects; do NOT drop it).

────────────────────────────────────────────────────
STEP 4: Build suggested_project (Case 2 only)
────────────────────────────────────────────────────

title: creative domain-specific product name — NOT a tech stack description like "Django REST App".
  Pattern: domain-action word + product suffix. E.g., "VitalTrack", "SpendLens", "CartEngine", "TaskFlow".
tech_stack: 4-7 technologies from JD's required stack (comma-separated string).
description: 2-3 sentences — (a) real-world problem it solves, (b) how JD tech is used naturally, (c) the outcome. Rich enough to write 3-4 bullets from.

────────────────────────────────────────────────────
STEP 5: Build covered_jd_tech
────────────────────────────────────────────────────
List every JD tech item satisfied by the 2 selected projects combined (including the new project's tech_stack).

OR GROUP RULE: If JD says "java/python" and Python is covered, add BOTH "java" AND "python" to covered_jd_tech. The entire OR slot is satisfied, so all alternatives must be listed (this prevents false "missing keywords" later in the pipeline).

────────────────────────────────────────────────────
WORKED EXAMPLES
────────────────────────────────────────────────────

Example A — Case 1 (both existing cover everything):
  Resume: Project 1 "API Backend" uses Python, Django.
          Project 2 "Dashboard" uses React, Node.js
  JD requires: "python/nodejs, django, postgresql, react"
  Project 1 covers: python/nodejs slot (via python) ✅, django ✅, postgresql ✅
  Project 2 covers: react ✅, python/nodejs slot (via nodejs) ✅
  Together they cover all slots → Case 1
  selected_projects: ["API Backend", "Dashboard"]
  suggested_project: null
  requires_consent: false
  covered_jd_tech: ["python", "nodejs", "django", "postgresql", "react"]


Example B — Case 2 (no match, brand new project):
  Resume: "Ecommerce Website" uses HTML, CSS, JavaScript, nodejs, mysql.
  JD requires: "java, springboot, mysql"
  No project matches any JD lang/fw/lib → Case 2
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
    "title": "...",
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
- covered_jd_tech: all JD tech items satisfied by both selected projects combined, including all OR-slot alternatives when any one is matched.
- requires_consent: true for Case 2, false for Case 1.
- least_relevant_project: title of lowest-scoring existing resume project (shown in UI as which project gets replaced). null if resume has 0 or 1 project.
- total_projects_count: count of distinct project entries found in the resume. Does NOT count the new/upgraded suggested project.
- tech_stack must be a comma-separated STRING, not an array.

────────────────────────────────────────────────────
INPUTS
────────────────────────────────────────────────────

Full Resume Text:
{resume_text}

Job Description:
{job_description}
"""
