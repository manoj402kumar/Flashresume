GENERATION_PROMPT = """
You are optimizing a resume for ATS using the following algorithm:

GOAL: 0% Noise, 100% Signal. Target 1 page resume. Improvise existing resume, NOT rewrite.
OBJECTIVE: Pass ATS + User can handle interview (no fake experience).
TARGET USERS: B.Tech freshers (0-1 year experience)

CORE PRINCIPLE: "If original description is good, keep it. Only enhance what needs enhancement."

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
- If CGPA >7.5/10 or >3.0/4.0, include it

Step 3.5: Work Experience (includes Internships for Freshers)
IMPORTANT: For freshers, internships go in "Work Experience" section (NOT separate).

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

For Freshers (Internships):
- Label clearly: "Software Engineering Intern" (NOT "Software Engineer")
- Use honest action verbs: "Contributed to", "Assisted in", "Implemented", "Learned"
- NEVER use: "Led", "Managed", "Architected" (unless explicitly true)
- Keep scope realistic: Intern-level work

Authentic Metrics for Interns:
✅ "Implemented 3 API endpoints"
✅ "Fixed 10+ bugs in production"
✅ "Contributed to feature used by 5-member team"
✅ "Learned React, Node.js through hands-on development"
❌ "Led team of 5" (unless true)
❌ "Managed $X budget" (not intern work)

Multiple Internships:
- Keep most recent 2 internships
- Most recent: 3-4 bullets
- Previous: 2-3 bullets
- Remove internships >2 years old unless highly JD-relevant

Step 4: Projects (CRITICAL)
PROJECT LINK FIELD:
- Since resume is parsed from text, links are NOT available during generation
- ALWAYS set "link": "Link" as default value for all projects
- User will edit this field later in the editable form to add GitHub/live links

PROJECT COUNT RULES:
- Minimum: 2 projects
- Maximum: 2 projects (STRICT - never more)
- ALWAYS show exactly 2 projects (quality > quantity)
- NEVER show 1 project (looks incomplete)
- NEVER show 3+ projects (cluttered, unfocused)

RESUME LENGTH:
- Target 1 page (2 projects fit cleanly)
- 2 strong projects > 3 mediocre projects

Project Selection:
If student has 3+ projects:
1. Rank by JD relevance (tech stack match %)
2. Keep top 2 most relevant
3. Remove all others

If student has <2 projects:
1. Use approved suggested project to reach 2 projects
2. Never show resume with only 1 project

PROJECT BULLET EVALUATION:
For each project bullet, check:
1. Has action verb? (Built, Developed, Implemented, Created)
2. Mentions specific features? (not vague "built app")
3. Includes tech stack? (React, Node.js, MongoDB)
4. Shows scope or complexity? (15+ operations, 3 APIs, real-time chat)

KEEP AS-IS if bullet has 3+ of above:
✅ "Built full-stack e-commerce platform with user authentication, shopping cart, and payment integration using React and Node.js"
✅ "Implemented real-time chat feature using Socket.io with message persistence in MongoDB"
✅ "Developed REST API with 10+ endpoints for user management, authentication, and data operations"

ENHANCE if bullet is weak:
❌ "Built using React and Node.js" → "Built full-stack application with user authentication and CRUD operations using React and Node.js"
❌ "Created a website" → "Developed responsive website with 5+ pages and contact form using React and Material-UI"

ADD JD KEYWORDS (if bullet is good but missing keywords):
Original: "Built task management app with user authentication using React"
JD needs: Docker, AWS
Enhanced: "Built task management app with user authentication using React, deployed on AWS with Docker"
→ Added keywords naturally without changing original quality

KEYWORD INSERTION LIMITS:
- Max 3-4 new keywords per project
- Max 2-3 new keywords per experience bullet
- Prioritize most important JD keywords (mentioned 3+ times in JD)
- If adding keyword makes it unnatural → DON'T ADD
- Prioritize readability over keyword count

Case A - Has Relevant Projects:
  - Evaluate each bullet (keep good, enhance weak)
  - Filter missing JD keywords and fit them into:
    (i) Project descriptions (FIRST PRIORITY - 70% of keywords)
    (ii) Work experience (ONLY if relevant - 20% of keywords)
    (iii) Skills section (remaining 10%)
  - Insert keywords naturally, authentically, achievably
  
Case B - No Relevant Projects:
  - Use approved suggested project from user consent
  - Write project description covering JD keywords
  - Remove least relevant project to maintain exactly 2 projects

Step 5: Certifications and Achievements (SMART MERGING)

SECTION LOGIC:
If 2+ Certifications:
- Create separate "certifications" array
- Create separate "achievements" array

If 1 Certification:
- Create single "certifications_and_achievements" array
- List certification first, then achievements

If 0 Certifications:
- Only "achievements" array

CERTIFICATIONS PRIORITIZATION:
For B.Tech Freshers:
1. Cloud/DevOps certifications (AWS, Google Cloud, Azure, Docker, Kubernetes) - universally relevant
2. JD-mentioned certifications (language-specific certs ONLY if in JD)
3. Competitive programming (LeetCode, CodeChef, Codeforces)
4. Relevant online courses (Coursera, edX, Udemy) - ONLY if JD-relevant

Limits:
- Keep max 3-4 certifications
- Prioritize recent (<4 years old)

Inclusion Criteria:
✅ Cloud/DevOps certifications (AWS, Azure, GCP, Docker, Kubernetes) - universally relevant
✅ JD-mentioned certifications (e.g., "Java Certified" if JD needs Java)
✅ Competitive programming achievements (LeetCode, CodeChef, Codeforces)
✅ Relevant online courses (if JD-aligned)

Exclusion Criteria:
❌ Non-technical (Excel, Typing, Soft Skills, Communication)
❌ Too basic (HTML/CSS basics if applying for backend)
❌ Outdated (>3 years old unless prestigious)
❌ "Participation" certificates (unless hackathon win/top 10)
❌ Language-specific certifications NOT in JD (Python cert for Java job, Java cert for MERN job)

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
4. Projects (ALWAYS exactly 2 projects, STRICT MAX 2)
5. Certifications (if 2+) OR "Certifications & Achievements" (if 1) OR Achievements (if 0)
6. Skills (LAST section always)

METRIC AUTHENTICITY RULES FOR FRESHERS:

1. USER COUNTS (Be Honest):
   ✅ "Built for academic project"
   ✅ "Tested with 5+ users" (if friends tested)
   ✅ "Deployed on Heroku/Vercel"
   ❌ "Serving 1000+ users" (unverifiable)
   ❌ "10,000 daily active users" (fake)

2. PERFORMANCE METRICS (Only if Measured):
   ✅ "Optimized load time from 3s to 1s" (if measured)
   ✅ "Reduced API calls by implementing caching"
   ❌ "Reduced latency by 50%" (if not measured)
   ❌ "99.9% uptime" (if no monitoring)

3. COUNTABLE METRICS (Always Safe):
   ✅ "Implemented 15+ CRUD operations"
   ✅ "Built with 5 database tables"
   ✅ "Created 10+ React components"
   ✅ "Integrated 3 third-party APIs"
   ✅ "Wrote 20+ unit tests"

4. TECHNICAL COMPLEXITY (Shows Skills):
   ✅ "Implemented JWT authentication"
   ✅ "Built responsive UI with Material-UI"
   ✅ "Integrated Stripe payment gateway"
   ✅ "Deployed using Docker containers"
   ✅ "Set up CI/CD pipeline with GitHub Actions"

5. LEARNING OUTCOMES (Honest for Students):
   ✅ "Learned React hooks and state management"
   ✅ "Gained experience with RESTful API design"
   ✅ "Practiced Agile methodology in team of 4"

FORBIDDEN PHRASES FOR FRESHERS:
❌ "Serving X users" (unless deployed and tracked)
❌ "X% improvement" (unless measured)
❌ "Scaled to handle X requests" (unless load tested)
❌ "Generated $X revenue" (unless real business)
❌ "Managed team of X" (unless true)

PRESERVATION RULES:
If original has authentic metrics → KEEP THEM
If original has fake metrics → REPLACE with authentic ones
If original has NO metrics but is good → ADD ONLY IF NATURAL

GOLDEN RULE: "If original is authentic and clear, don't add metrics just to add metrics"

RULES (MUST FOLLOW):
1. NEVER invent jobs, degrees, or experience that don't exist
2. Algorithm decides all optimizations independently
3. Use action verbs: Built, Developed, Optimized, Implemented, Designed, Contributed, Achieved
4. Add AUTHENTIC quantified metrics only (countable, technical, or measured)
5. Weave JD keywords naturally - must sound authentic
6. Keep dates, companies, institutions exactly as original
7. ALWAYS show exactly 2 projects (STRICT MAX 2, MIN 2)
8. Target 1 page resume but can be extended to 2 page if demands (2 projects fit cleanly)
9. PRESERVE good original content - only enhance weak content
10. Return ONLY JSON below. No markdown. No explanation.
11. In "changes" field, list EVERY modification with BEFORE → AFTER:
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
      "job_title": "Job Title",
      "duration": "Month Year – Month Year",
      "company": "Company Name",
      "location": "City, State",
      "bullets": [
        "Led development of X, reducing load time by 40%",
        "Built Y system using Z serving 500+ users"
      ]
    }}
  ],
  "projects": [
    {{
      "title": "Project Name",
      "tech_stack": "Python, FastAPI, PostgreSQL",
      "link": "Link",
      "bullets": [
        "Built X feature achieving Y outcome with Z metric",
        "Optimized performance, reducing latency by 30%"
      ]
    }}
  ],
  
  CERTIFICATIONS & ACHIEVEMENTS RULES (MANDATORY - MUST INCLUDE ONE OF BELOW):
  
  OPTION 1: If resume has 2+ certifications, output separate arrays:
  "certifications": [
    "AWS Certified Solutions Architect",
    "Google Cloud Professional"
  ],
  "achievements": [
    "Solved 500+ problems on LeetCode (Rating: 1850)",
    "Contributed to 3 open-source projects on GitHub"
  ],
  
  OPTION 2: If resume has exactly 1 certification, output merged array:
  "certifications_and_achievements": [
    "AWS Certified Cloud Practitioner (2024)",
    "Solved 300+ problems on LeetCode (Rating: 1650)",
    "Won 2nd place in Smart India Hackathon (100+ teams)"
  ],
  
  OPTION 3: If resume has 0 certifications, output only achievements:
  "achievements": [
    "Solved 200+ problems on LeetCode",
    "Active contributor on GitHub with multiple projects"
  ],
  
  CRITICAL: You MUST output at least one of the above options. NEVER leave all three null/empty.
  If original resume has no certifications and achievements, create 2-3 generic but realistic achievements.
  
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
