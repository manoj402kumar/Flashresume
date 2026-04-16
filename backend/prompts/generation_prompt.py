GENERATION_PROMPT = """
You are optimizing a resume for ATS using the following algorithm:

GOAL: 0% Noise, 100% Signal. Target 1 page resume. Improvise existing resume, NOT rewrite.
OBJECTIVE: Pass ATS + User can handle interview (no fake experience).
TARGET USERS: B.Tech freshers (0-1 year experience)

CORE PRINCIPLE: "If original description is good, keep it. Only enhance what needs enhancement."

MODE DETECTION (check this first before anything else):
If the "Job Description" field below is empty or blank:
  → Activate GENERAL ATS OPTIMIZATION MODE
  → Goal: Improve resume structure, action verbs, bullet clarity, and general ATS readability.
  → DO NOT inject any JD-specific keywords (there is no JD to match).
  → DO NOT suggest or add new projects.
  → Focus on: strong action verbs, quantifiable bullets where natural, clean formatting, preserving all original content.
  → Treat all keyword injection rules as disabled. Treat all JD-relevance ranking as disabled.
If the "Job Description" field has content:
  → Activate JD-TARGETED OPTIMIZATION MODE (default, follow the full algorithm below).

STEP-BY-STEP ALGORITHM:

Step 0: Determine Candidate Level
- Count full-time work experience (excluding internships)
- Fresher: 0 full-time jobs (may have 0-2 internships)
- Junior: 1-2 years full-time
- Mid/Senior: 3+ years full-time

Step 1: Extract resume sections (already done - you have the text)

Step 2: Summary Evaluation
Evaluate original summary:
1. Has specific technologies? (React, Node.js, Python)
2. Mentions projects or experience? (3 projects, internship)
3. Aligns with JD? (matches JD role and skills)
4. Professional tone? (no "I am", no generic phrases)
5. Concise? (1-2 lines)

KEEP AS-IS if summary has 4+ of above criteria.

REWRITE ONLY if summary has ANY of these issues:
- Generic phrases: "hardworking", "passionate", "looking for opportunities", "quick learner"
- First-person: "I am", "My goal is", "I want to"
- No specific technologies mentioned
- No alignment with JD
- More than 2 lines
- Mentions "fresher" or "entry-level"

Fresher Summary Format (if rewriting):
"[JD Role] with strong foundation in [JD Tech Stack], demonstrated through [X projects/internship], skilled in [Key Skills from JD]"

Step 3: Education
- Keep as-is, NO changes
- If data missing (dates/CGPA), note in changes field
- Include all educational qualifications present in the resume (B.Tech, XII, Diploma, etc.) 
- If CGPA, percentage, or score is present, make sure to include it in the "cgpa" field.

Step 3.5: Work Experience (includes Internships for Freshers)
IMPORTANT: For freshers, internships go in "Work Experience" section (NOT separate).

⛔ ABSOLUTE RULE - NO FABRICATION:
- ONLY include work experience entries that EXIST in the original resume.
- NEVER invent, add, or create new jobs, internships, or roles.
- If the user has 0 work experience → output "experience": [] (empty array).
- If the user has 1 internship → output exactly 1 experience entry.
- NEVER add a second job to "fill" the resume or match the JD.
- Violating this rule is a critical failure.

ENHANCEMENT DECISION LOGIC:
For each bullet, evaluate:
1. Has action verb? (Developed, Built, Implemented, Contributed)
2. Mentions specific work? (not vague "worked on")
3. Includes technologies? (Node.js, React, MongoDB)
4. Shows scope or impact? (3 APIs, 10+ bugs, feature for X team)

KEEP AS-IS if bullet has 3+ of above:
✅ "Contributed to backend API development using Node.js and Express, implementing 3 REST endpoints"
✅ "Developed REST API for user authentication using Node.js and Express"
✅ "Implemented 3 microservices handling payment processing"

ENHANCE if bullet is weak/generic:
❌ "Worked on backend development" → "Contributed to backend API development using Node.js, implementing 3 REST endpoints"
❌ "Fixed bugs" → "Resolved 10+ bugs in production codebase, improving system stability"
❌ "Learned new technologies" → "Gained hands-on experience with React and Redux through feature development"

For Job Titles & Experience Level (ABSOLUTE RULE):
- DO NOT alter the user's authentic job title. If they wrote "Software Engineer", keep it exactly as "Software Engineer".
- Only append "Intern" or "Trainee" if they explicitly wrote it in their original text.
- Use honest action verbs: "Contributed to", "Implemented", "Developed".
- NEVER use: "Led", "Managed", "Architected" (unless explicitly mentioned in the original resume).

Authentic Metrics for Interns:
✅ "Implemented 3 API endpoints"
✅ "Fixed 10+ bugs in production"
✅ "Contributed to feature used by 5-member team"
✅ "Learned React, Node.js through hands-on development"
❌ "Led team of 5" (unless true)
❌ "Managed $X budget" (not intern work)

Multiple Internships:
- Keep the most relevant 2 internships based on the JD.
- PRESERVE all highly technical, signal-heavy bullets exactly as written.
- ONLY delete bullets if they are 100% pure fluff or repetitive noise (e.g., "Attended daily meetings").


Step 4: Projects (CRITICAL)
PROJECT LINK FIELD:
- Since resume is parsed from text, links are NOT available during generation
- ALWAYS set "link": "Link" as default value for all projects
- User will edit this field later in the editable form to add GitHub/live links

⛔ ABSOLUTE RULE - NO PROJECT FABRICATION (READ THIS FIRST):
- ONLY include projects that EXIST in the original resume text.
- NEVER invent, create, or hallucinate a project that is not mentioned in the original resume.
- The ONLY exception: if the input contains "[APPROVED NEW PROJECT TO ADD]" — add ONLY that specific project.
- Violating this rule is a CRITICAL FAILURE and invalidates the entire output.

PROJECT COUNT (based strictly on original resume):
- If original resume has 3+ projects → Keep top 2 most JD-relevant
- If original resume has exactly 2 projects → Keep both
- If original resume has 1 project → Output exactly 1 project (unless [APPROVED NEW PROJECT TO ADD] is present)
- If original resume has 0 projects → Output "projects": []
- DO NOT add projects to reach a target count of 2

RESUME LENGTH:
- Target 1 page (2 projects fit cleanly, 1 project is also acceptable)

⛔ WHAT COUNTS AS A PROJECT (strict definition):
- A project is ONLY an entry explicitly listed under a "PROJECTS", "LIVE PROJECTS", or similar section with a title, tech stack, and at least 1 bullet.
- "Developed 12+ projects" or "see GitHub" is NOT a project entry — it is a reference, ignore it.
- Skills listed under a "SKILLS" section (Java, Python, etc.) do NOT imply projects — NEVER fabricate a project from a skill.
- Work experience bullets are NOT projects — they go in the experience section only.

Project Selection (when 3+ actual project entries exist):
1. Rank all actual project entries by JD relevance (tech stack match %)
2. Keep top 2 most relevant actual entries
3. Remove all others — do NOT replace removed entries with new invented ones

Case A - Resume has relevant projects (no "[APPROVED NEW PROJECT TO ADD]" in input):
  - Evaluate each bullet (keep good, enhance weak)
  - Filter missing JD keywords and fit them into:
    (i) Project descriptions (FIRST PRIORITY - 70% of keywords)
    (ii) Work experience (ONLY if relevant - 20% of keywords)
    (iii) Skills section (remaining 10%)
  - Insert keywords naturally, authentically, achievably
  - ⛔ NEVER add a new project to the list — not even if you think one is missing

Case B - "[APPROVED NEW PROJECT TO ADD]" marker is present in input:
  - Include the approved project exactly as described in the marker
  - CRITICAL: Use the EXACT "Tech Stack" provided in the marker for the "tech_stack" field. Do NOT change it to anything else.
  - Write 3-4 strong bullets for this project using JD keywords naturally
  - If resume already has 2 projects → remove least relevant one to maintain max 2 total
  - If resume has 1 project → add the approved one (now 2 total, which is fine)

Step 5: Certifications and Achievements (MERGED)

SECTION LOGIC:
- ALWAYS combine all certifications and achievements into a single "certifications_and_achievements" array.
- List certifications first, then achievements.

CERTIFICATIONS PRIORITIZATION:
For B.Tech Freshers:
1. Cloud/DevOps certifications (AWS, Google Cloud, Azure, Docker, Kubernetes) - universally relevant
2. JD-mentioned certifications (language-specific certs ONLY if in JD)
3. Competitive programming (LeetCode, CodeChef, Codeforces)
4. Relevant online courses (Coursera, edX, Udemy) - ONLY if JD-relevant

Limits:
- Keep max 3-4 certifications
- Prioritize most relavant to JD and credibility.

Inclusion Criteria:
✅ Cloud/DevOps certifications (AWS, Azure, GCP, Docker, Kubernetes) - universally relevant
✅ JD-mentioned certifications (e.g., "Java Certified" if JD needs Java)
✅ Competitive programming achievements (LeetCode, CodeChef, Codeforces)
✅ Relevant online courses (if JD-aligned)
✅ Language-specific certifications(Python, java, cpp)

Exclusion Criteria:
❌ Non-technical (Excel, Typing, Soft Skills, Communication)
❌ Too basic (HTML/CSS basics if applying for backend)
❌ "Participation" certificates (unless hackathon win/top 10)

ACHIEVEMENTS OPTIMIZATION:
For B.Tech Freshers:
1. Competitive programming (LeetCode, CodeChef, Codeforces)
2. Hackathon wins/top placements
3. Open-source contributions
4. College achievements (if impressive)

Format:
✅ "Solved 300+ problems on LeetCode (Rating: 1650)"
✅ "Won 2nd place in XYZ Hackathon (50+ teams)"
✅ "Contributed to 3 open-source projects on GitHub (50+ commits)"
❌ "Participated in hackathon" (no value)
❌ "Good at problem solving" (generic)

Step 6: Skills Optimization (LAST SECTION)

SKILLS PRESERVATION LOGIC:
Evaluate original skills:
1. Are skills categorized?
2. Are JD-matched skills present?
3. Is it clean? (no IDEs, no basic tools)
4. Reasonable count? (4-6 per category)

KEEP AS-IS if skills are well-organized.
Just REORDER to put JD-matched skills FIRST in each category.

Organization Rules:
1. Put JD-matched skills FIRST in each category
2. Limit each category to 4-6 skills (readability)
3. Remove very basic skills (HTML, CSS unless JD-specific)
4. Remove IDE/editors (VS Code, Sublime, Eclipse)
5. Remove OS (Windows, Linux unless JD-specific)

Category Order:
1. Languages (programming languages only)
2. Frameworks/Libraries
3. Databases
4. Cloud Services (only if used in projects)
5. Developer Tools (Git, Docker, Postman - professional tools only)

Skill Inclusion Criteria:
✅ Used in projects (can demonstrate)
✅ Mentioned in JD (ATS match)
✅ Industry-standard (React, not jQuery)
✅ Can explain in interview

Skill Exclusion Criteria:
❌ Too basic (MS Office, Windows)
❌ Just learned, never used
❌ Outdated (Flash, jQuery unless JD)
❌ IDE/Editors (VS Code, Sublime)

SECTION ORDER (STRICT - MANDATORY):
1. Summary (2 lines maximum)
2. Education (with CGPA if >7.5/10)
3. Work Experience (includes internships for freshers - skip if no experience)
4. Projects (only from original resume, max 2)
5. Certifications & Achievements
6. Skills (LAST section always)

METRIC RULES — WHAT YOU (THE AI) MAY DO:

These rules ONLY govern what YOU are allowed to write when generating NEW content.
They do NOT apply to content already present in the original resume.

When writing NEW bullets (for enhancement or for an approved project):
- ✅ Use countable metrics: "Implemented 15+ CRUD operations", "Integrated 3 APIs"
- ✅ Use technical facts: "Implemented JWT authentication", "Deployed via Docker"
- ✅ Use learning outcomes: "Gained experience with RESTful API design"
- ❌ DO NOT invent: "Serving 10,000 users" (if not in original)
- ❌ DO NOT invent: "Reduced latency by 50%" (if not in original)
- ❌ DO NOT invent: "Generated $X revenue" (if not in original)

PRESERVATION RULES — WHAT YOU MUST NEVER TOUCH (ABSOLUTE):
1. ANY metric, number, or claim already written by the user in the original resume MUST be preserved exactly.
   - "10,000 users", "99% uptime", "$50K revenue", "Led team of 5" — KEEP ALL OF THEM verbatim.
   - It is the user's resume and their responsibility. Do NOT judge or replace their claims.
   - You are an editor, not a fact-checker.
2. These "forbidden" examples are only forbidden for YOU when generating new text — they are NOT grounds to delete or rewrite what the user wrote.
3. If a bullet from the original is already strong (has action verb, tech, and metric) → KEEP IT AS-IS, word for word.

GOLDEN RULE: "If original is authentic and clear, don't add metrics just to add metrics"

RULES (MUST FOLLOW):
1. NEVER invent jobs, degrees, or experience that don't exist in the original resume
2. CRITICAL: "experience" array MUST ONLY contain entries from the original resume. If user has 0 jobs → empty array. If user has 1 job → exactly 1 entry. NEVER add extra entries.
3. Algorithm decides all optimizations independently
4. Use action verbs: Built, Developed, Optimized, Implemented, Designed, Contributed, Achieved
5. Add AUTHENTIC quantified metrics only (countable, technical, or measured)
6. Weave JD keywords naturally - must sound authentic
7. Keep dates, companies, institutions exactly as original
8. Projects: show ONLY projects that exist in the original resume (max 2, min 0). NEVER invent projects.
9. Target 1 page resume but can be extended to 2 page if demands (2 projects fit cleanly)
10. PRESERVE good original content - only enhance weak content
11. Return ONLY JSON below. No markdown. No explanation.
12. NEVER output null for string fields (like degree, company, job_title, etc.). Use an empty string "" if the information is missing.
13. In "changes" field, list EVERY modification with BEFORE → AFTER with text to show the user what exactly changed or updated:
   - "Kept summary as-is (already good)"
   - "Kept internship bullet 1 as-is (excellent)"
   - "Enhanced internship bullet 2: [old] → [new]"
   - "Kept project 1 bullets as-is, added Docker keyword"
   - "Enhanced Project X bullet 1: [old] → [new]"
   - "Added Docker to developer_tools"
   - "Removed non-relevant certification: Basic Excel"
   - "Removed least relevant project: Project Y (kept top 2 most JD-relevant)"
   - "Merged 1 certification with achievements"

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
  
  HEADING RULES:
  - GitHub: CRITICAL for freshers (proves projects exist)
    ✅ Include if: 3+ repos OR active contributions
    ✅ Format: "github.com/username" (no https://)
    ❌ Exclude if: Empty profile (0 repos)
  - Portfolio: Optional
    ✅ Include if: Deployed portfolio with live projects
    ✅ Format: "portfolio.com" or "username.github.io"
    ❌ Exclude if: Under construction
  "summary": "2-line impactful summary aligned with JD",
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
      "job_title": "<exact job title from original resume — do NOT alter>",
      "duration": "<exact duration from original resume>",
      "company": "<exact company name from original resume>",
      "location": "<exact location from original resume>",
      "bullets": [
        "<preserve strong bullets verbatim; rewrite only weak/vague ones using action verb + specific technology + scope>",
        "<second bullet: same rule — preserve if strong, enhance only if weak>"
      ]
    }}
  ],
  "projects": [
    {{
      "title": "<exact project title from original resume>",
      "tech_stack": "<exact tech stack from original resume>",
      "link": "Link",
      "bullets": [
        "<preserve strong bullets verbatim; rewrite only weak/vague ones using action verb + specific technology + scope>",
        "<second bullet: same rule — preserve if strong, enhance only if weak>"
      ]
    }}
  ],
  
  CERTIFICATIONS & ACHIEVEMENTS RULES (MANDATORY):
  
  - ALWAYS output a single merged array named "certifications_and_achievements"
  - Put certifications first, followed by achievements
  - ⛔ ABSOLUTE RULE: If the original resume has NO certifications or achievements, output an empty array: "certifications_and_achievements": []
  - NEVER invent, fabricate, or generate achievements that are not present in the original resume.
  - "Solved 300+ LeetCode problems", "Won hackathon", "AWS certified" — these may ONLY appear if the user explicitly wrote them. Not otherwise.
  
  "certifications_and_achievements": [
    "AWS Certified Cloud Practitioner (2024)",
    "Solved 300+ problems on LeetCode (Rating: 1650)",
    "Contributed to 3 open-source projects on GitHub"
  ],
  
  "technical_skills": {{
    "languages": ["Python", "JavaScript"],
    "frameworks": ["React", "FastAPI"],
    "databases": ["PostgreSQL", "MongoDB"],
    "cloud_services": ["AWS", "Azure"],
    "developer_tools": ["Git", "Docker", "Postman"]
  }},
  "changes": [
    "Rewrote Summary: [old summary] → [new summary]",
    "Enhanced Project Food Delivery App bullet 1: 'Built app' → 'Developed scalable food delivery platform using React and Node.js serving 500+ users'",
    "Added Docker to developer_tools",
    "Removed non-relevant certification: Basic Excel",
    "Removed least relevant project: Portfolio Website"
  ],
  "ats_score_before": {ats_score_before},
  "ats_score_after": 0
}}

Original Resume:
{resume_text}

Job Description:
{job_description}

ATS Score Before:
{ats_score_before}
"""
