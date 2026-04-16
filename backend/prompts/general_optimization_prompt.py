GENERAL_OPTIMIZATION_PROMPT = """
You are optimizing a resume for ATS using the following algorithm.
This is GENERAL ATS OPTIMIZATION MODE (No Job Description provided).

GOAL: 0% Noise, 100% Signal. Improve resume structure, action verbs, bullet clarity, and general ATS readability.
OBJECTIVE: Clean formatting, professional tone, and preserving ALL authentic user content from RESUME_TEXT.

INPUT LABELS (referred throughout this prompt):
- RESUME_TEXT → The raw original resume text uploaded by the user (see bottom of this prompt)
- No JOB_DESCRIPTION is available in this mode. Do NOT invent or inject any target keywords.

⛔ ABSOLUTE RULE - ZERO FABRICATION:
1. DO NOT inject any keywords or technologies not present in RESUME_TEXT.
2. DO NOT invent, add, or create new jobs, internships, projects, degrees, or achievements not in RESUME_TEXT.
3. DO NOT invent skills (e.g. if RESUME_TEXT does not contain "Docker", do not add it).
4. DO NOT delete any legitimate skills from RESUME_TEXT (including HTML, CSS, VS Code, etc.).

STEP-BY-STEP ALGORITHM:

Step 1: Extract resume sections (already done — you have RESUME_TEXT below)

Step 2: Summary Evaluation
Evaluate the summary in RESUME_TEXT. REWRITE ONLY if it has ANY of these issues:
- Generic phrases: "hardworking", "passionate", "looking for opportunities"
- First-person: "I am", "My goal is", "I want to"
- More than 2 lines
- Mentions "fresher" or "entry-level"
If rewriting, format as: "[Current Role] with strong foundation in [Core Tech Stack from RESUME_TEXT], demonstrated through [X projects/internships]"

Step 3: Education
- Keep as-is, NO changes. Include all educational qualifications present in RESUME_TEXT (B.Tech, XII, Diploma, etc.)
- If CGPA, percentage, or score is present in RESUME_TEXT, make sure to include it in the "cgpa" field.

Step 3.5: Work Experience (includes Internships for Freshers)
- ONLY include work experience entries that EXIST in RESUME_TEXT. If 0 jobs → output empty array.
- DO NOT alter the user's authentic job title. If RESUME_TEXT has "Software Engineer", keep it exactly as "Software Engineer".
- Keep ALL bullet points from RESUME_TEXT.
- PRESERVE strong bullets from RESUME_TEXT verbatim.
- ENHANCE weak bullets: use strong action verbs (Developed, Built, Implemented), better sentence framing without changing the original meaning or data from RESUME_TEXT.

Step 4: Projects
- ALWAYS set "link": "Link" as default value for all projects.
- ONLY include projects that EXIST in RESUME_TEXT.
- Keep ALL bullet points from RESUME_TEXT.
- If bullets from RESUME_TEXT are already strong, keep them as-is verbatim.
- Enhance weak bullets with better action verbs and sentence framing without changing the original meaning or data from RESUME_TEXT.

Step 5: Certifications and Achievements
- ALWAYS output a single merged array named "certifications_and_achievements"
- Put certifications first, followed by achievements
- ⛔ ABSOLUTE RULE: If RESUME_TEXT has NO certifications or achievements, output an empty array: [].

ACHIEVEMENTS OPTIMIZATION:
For B.Tech Freshers — keep ONLY if present in RESUME_TEXT:
1. Competitive programming (LeetCode, CodeChef, Codeforces)
2. Hackathon wins/top placements
3. Open-source contributions
4. College achievements (if impressive)

Format:
✅ "Solved 300+ problems on LeetCode (Rating: 1650)"
✅ "Won 2nd place in XYZ Hackathon (50+ teams)"
✅ "Contributed to 3 open-source projects on GitHub (50+ commits)"
✅ "Participated in hackathon"
❌ "Good at problem solving" (generic — remove if in RESUME_TEXT)

Step 6: Skills Optimization (STRICT PRESERVATION)
Extract and categorize ALL skills from the skills section of RESUME_TEXT. Do NOT miss anything.
1. NEVER invent any skills not present in RESUME_TEXT.
2. NEVER delete skills to meet arbitrary limits. Include everything from RESUME_TEXT (including HTML, CSS, VS Code, Git, etc.).
3. Categorize them neatly:
   - Languages (Python, Java, JavaScript, etc.)
   - Frameworks & Libraries (React, Django, Pandas, etc.)
   - Databases
   - Cloud Services
   - Developer Tools & Methodologies (Git, Docker, Agile, VS Code)
4. If a skill from RESUME_TEXT doesn't fit standard categories, map it to "Miscellaneous" array.

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
  "summary": "2-line impactful summary based ONLY on skills present in RESUME_TEXT",
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
      "job_title": "<exact job title from RESUME_TEXT — do NOT alter>",
      "duration": "<exact duration from RESUME_TEXT>",
      "company": "<exact company name from RESUME_TEXT>",
      "location": "<exact location from RESUME_TEXT>",
      "bullets": [
        "<preserve strong bullets from RESUME_TEXT verbatim; rewrite only weak/vague ones using action verb + specific technology + scope>",
        "<second bullet: same rule>"
      ]
    }}
  ],
  "projects": [
    {{
      "title": "<exact project title from RESUME_TEXT>",
      "tech_stack": "<exact tech stack from RESUME_TEXT>",
      "link": "Link",
      "bullets": [
        "<preserve strong bullets from RESUME_TEXT verbatim; rewrite only weak/vague ones using action verb + specific technology + scope>"
      ]
    }}
  ],
  
  "certifications_and_achievements": [
    "<only include what is explicitly present in RESUME_TEXT, or empty array>"
  ],
  
  "technical_skills": {{
    "languages": ["<only extract from RESUME_TEXT>"],
    "frameworks": ["<only extract from RESUME_TEXT>"],
    "databases": ["<only extract from RESUME_TEXT>"],
    "cloud_services": ["<only extract from RESUME_TEXT>"],
    "developer_tools": ["<only extract from RESUME_TEXT>"],
    "miscellaneous": ["<only extract from RESUME_TEXT>"]
  }},
  "changes": [
    "Rewrote Summary: [old summary] → [new summary]",
    "Enhanced Experience bullet 1: 'Worked on backend' → 'Developed REST APIs using Node.js and Express'",
    "Preserved Project X bullets as-is (already strong)",
    "Categorized all skills from RESUME_TEXT without adding or removing any"
  ],
  "ats_score_before": {ats_score_before},
  "ats_score_after": 0
}}

RESUME_TEXT:
{resume_text}

ATS Score Before:
{ats_score_before}
"""
