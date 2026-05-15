PROJECT_CHECK_PROMPT = """
You are analyzing a resume to check if it has projects relevant to a job description.

IMPORTANT INSTRUCTIONS:
1. READ THE ENTIRE RESUME CAREFULLY - Look for PROJECTS, EXPERIENCE, or any section mentioning technical work
2. Count ALL projects mentioned in the resume (even if not in a "PROJECTS" section)
3. Check if project tech stacks match the JD requirements. FRAMEWORKS and LIBRARIES are the PRIMARY matching signal — not just languages.
4. A project is "relevant" ONLY if its tech stack includes the specific frameworks/libraries from the JD, not just the language.
   - JD requires Django → resume project must use Django (not just Python)
   - JD requires React → resume project must use React (not just JavaScript)
   - JD requires Spring Boot → resume project must use Spring Boot (not just Java)

EXAMPLE 1 (Has relevant projects):
Resume mentions: "E-commerce app using React, Node.js, MongoDB"
JD requires: "React, Node.js, Express"
Result: has_relevant_projects = true (React + Node match), suggested_project = null

EXAMPLE 2 (No relevant projects):
Resume mentions: "Java Spring Boot application"
JD requires: "React, Node.js, Python"
Result: has_relevant_projects = false, suggest React/Node project

EXAMPLE 3 (Framework mismatch — treat as NOT relevant):
Resume mentions: "Python CLI tool for data processing"
JD requires: "Python, Django, REST APIs"
Result: has_relevant_projects = false (Python alone is not enough — Django is missing), suggest a Django REST API project

DECISION RULES:
- If resume has 1+ relevant projects → has_relevant_projects = true, suggested_project = null, requires_consent = false
- If resume has 0 relevant projects → has_relevant_projects = false, suggest a new project, requires_consent = true
- If resume has 0 projects at all → has_relevant_projects = false, suggest a new project, requires_consent = true

SUGGESTED PROJECT QUALITY RULES (CRITICAL - follow these when suggesting a project):

1. PROJECT NAME: Must be a creative, specific product name tied to the DOMAIN of the job description.
   NAMING FORMULA: Combine a domain-specific action/concept word + a product suffix that fits the problem.
   Examples of the PATTERN (do NOT use these exact names):
     - Healthcare + tracking → something like "VitalTrack" or "CareSync"
     - Finance + budgeting → something like "SpendLens" or "CashFlow"
     - Dev tools + reviews → something like "PullPilot" or "MergeGuard"
   ✅ The name must reflect WHAT the app does and WHO it's for, based on the JD domain.
   ✅ Use words relevant to the JD's industry (e.g., for a Django/backend JD → think API, data, service, engine)
   ❌ BAD names: "MERN Stack Application", "Full-Stack Web App", "React Node Project", "Python Flask App"
   ❌ DO NOT reuse any example name from this prompt verbatim.

2. DESCRIPTION: Must describe a PROBLEM being solved, not just list technologies.
   ✅ GOOD: "A collaborative task management platform where teams can create boards, assign tasks, track progress with real-time updates, and generate productivity reports"
   ✅ GOOD: "A personal finance tracker that helps users categorize expenses, set budgets, visualize spending patterns with charts, and receive alerts when approaching budget limits"
   ❌ BAD: "A web application built using React and Node.js with MongoDB database"
   ❌ BAD: "A full-stack project demonstrating CRUD operations with authentication"
   
3. The project must be:
   - Achievable by a B.Tech student in 2-4 weeks
   - Demonstrable in an interview (can explain architecture, challenges, decisions)
   - Solving a real-world problem (not just a tech demo)
   - Using 60-80% of the JD's required tech stack naturally.

Return ONLY this JSON format. No markdown code blocks. DO NOT use markdown formatting (like **bold**, *italics*, etc.) inside the JSON string values. Use plain text only. No explanation. Raw JSON only.

{{
  "has_relevant_projects": true/false,
  "relevant_projects": ["Project Name 1", "Project Name 2"],
  "total_projects_count": 2,
  "least_relevant_project": "Project Name" or null,
  "suggested_project": {{
    "title": "TaskFlow",
    "tech_stack": "follow above guidelines",
    "description": "follow above guidelines"
  }} or null,
  "requires_consent": true/false
}}

CRITICAL RULES:
- If you find ANY project with matching frameworks/libraries from the JD → has_relevant_projects = TRUE, suggested_project = NULL
- Only suggest a project if resume has ZERO relevant projects
- Look in ENTIRE resume, not just "PROJECTS" section
- Framework/library match is REQUIRED — language alone is NOT sufficient (e.g. Python ≠ Django project)
- Suggested project name MUST be a creative product name (2-3 words max), NOT a tech stack description
- Suggested project description MUST explain what the app DOES for users.

Full Resume Text:
{resume_text}

Job Description:
{job_description}
"""

