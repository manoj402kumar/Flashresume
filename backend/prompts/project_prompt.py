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
STEP 3: Decide the case — check in this order
────────────────────────────────────────────────────

CASE 1 — Suggest a brand new project:
  Trigger: No resume project matches even ONE JD language, framework, or library.
  Action: Suggest a completely new project using the JD's primary tech stack.
  Second project = most JD-relevant existing resume project (if one exists — ALWAYS include it in selected_projects; do NOT drop it).

CASE 2 — Upgrade an existing project:
  Trigger: At least 1 resume project matches at least 1 JD language, framework, or library.
  Action: Take the most JD-relevant matching project and upgrade it — add the missing JD tech to
  its tech_stack and write an upgrade description. Title stays the same.
  Second project = next most JD-relevant resume project (if one exists).

CASE 3 — Use 2 existing projects (no upgrade):
  Trigger: 2 or more resume projects together cover ALL JD tech slots (OR condition applied).
  Action: Pick the top 2 most JD-relevant ones. No new project needed.


────────────────────────────────────────────────────
STEP 4: Build suggested_project (Cases 1 and 2 only)
────────────────────────────────────────────────────

For Case 2 (upgrade existing):
  title: exact same title as the original resume project — do NOT rename it.
  tech_stack: original project's tech stack + missing JD frameworks/libraries appended (max 7 total, comma-separated string).
  description: 2-3 sentences — (a) what the project originally does, (b) how the JD tech integrates as a realistic extension, (c) the outcome. Must be achievable for a B.Tech student in 1-2 weeks.

For Case 1 (brand new):
  title: creative domain-specific product name — NOT a tech stack description like "Django REST App".
    Pattern: domain-action word + product suffix. E.g., "VitalTrack", "SpendLens", "CartEngine", "TaskFlow".
  tech_stack: 4-7 technologies from JD's required stack (comma-separated string).
  description: 2-3 sentences — (a) real-world problem it solves, (b) how JD tech is used naturally, (c) the outcome. Rich enough to write 3-4 bullets from.

────────────────────────────────────────────────────
STEP 5: Build covered_jd_tech
────────────────────────────────────────────────────
List every JD tech item satisfied by the 2 selected projects combined (including the upgraded/new project's tech_stack).

OR GROUP RULE: If JD says "java/python" and Python is covered, add BOTH "java" AND "python" to covered_jd_tech. The entire OR slot is satisfied, so all alternatives must be listed (this prevents false "missing keywords" later in the pipeline).

────────────────────────────────────────────────────
WORKED EXAMPLES
────────────────────────────────────────────────────

Example A — Case 3 (both existing cover everything):
  Resume: Project 1 "API Backend" uses Python, Django, PostgreSQL
          Project 2 "Dashboard" uses React, Node.js
  JD requires: "python/nodejs, django, postgresql, react"
  Project 1 covers: python/nodejs slot (via python) ✅, django ✅, postgresql ✅
  Project 2 covers: react ✅, python/nodejs slot (via nodejs) ✅
  Together they cover all slots → Case 3
  selected_projects: ["API Backend", "Dashboard"]
  suggested_project: null
  requires_consent: false
  covered_jd_tech: ["python", "nodejs", "django", "postgresql", "react"]

Example B — Case 2 (upgrade existing project):
  Resume: "Expense Tracker" uses Python, Flask, SQLite
  JD requires: "python/nodejs, REST APIs, MySQL"
  Project matches python/nodejs slot (via Python) → Case 2
  Upgrade: add REST APIs, MySQL to tech_stack
  suggested_project:
    title: "Expense Tracker"
    tech_stack: "Python, Flask, SQLite, MySQL, REST APIs"
    description: "An expense tracking app that lets users log and categorize spending built with Python and Flask. Extended with a Flask-RESTful API layer and MySQL backend replacing SQLite, enabling multi-user data persistence and mobile client integration via REST endpoints."
  covered_jd_tech: ["python", "nodejs", "REST APIs", "MySQL"]

Example C — Case 1 (no match, brand new project):
  Resume: "Portfolio Website" uses HTML, CSS, JavaScript
  JD requires: "python/nodejs, django, postgresql"
  No project matches any JD lang/fw/lib → Case 1
  suggested_project:
    title: "TaskFlow"
    tech_stack: "Python, Django, PostgreSQL, REST APIs"
    description: "A task management platform where teams create boards, assign tasks, and track progress. Built with Django REST framework for the API layer, PostgreSQL for persistent multi-user data storage. Provides role-based access control and generates weekly productivity reports for team leads."
  selected_projects: ["TaskFlow", "Portfolio Website"]
  covered_jd_tech: ["python", "nodejs", "django", "postgresql"]

────────────────────────────────────────────────────
OUTPUT — return ONLY valid JSON, no markdown, no explanation, no symbols like **, #.
────────────────────────────────────────────────────

{{
  "case": 1,
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
- case: 1, 2, or 3 (integer).
- selected_projects: max 2 entries. If resume has 0 or 1 existing project, may have only 1 entry.
- suggested_project: object for Case 1 and 2, null for Case 3.
- covered_jd_tech: all JD tech items satisfied by both selected projects combined, including all OR-slot alternatives when any one is matched.
- requires_consent: true for Case 1 and 2, false for Case 3.
- least_relevant_project: title of lowest-scoring existing resume project (shown in UI as which project gets replaced). null if resume has 0 or 1 project. In Case 2, NEVER set this to the same project as suggested_project.title.
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
