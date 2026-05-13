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
3. DO NOT extract skills from anywhere outside the explicitly labeled "Skills" section. Even if a tech is mentioned in a project/job, DO NOT add it to the technical_skills array if it isn't in the original Skills block.
4. DO NOT delete any legitimate skills explicitly listed in the Skills section of RESUME_TEXT.

STEP-BY-STEP ALGORITHM:

Step 1: Extract resume sections (already done — you have RESUME_TEXT below)

Step 2: Summary Evaluation
Evaluate the summary in RESUME_TEXT. REWRITE ONLY if it has ANY of these issues:
- Generic phrases: "hardworking", "passionate", "looking for opportunities"
- First-person: "I am", "My goal is", "I want to"
- More than 2 lines
- Mentions "fresher" or "entry-level" (when candidate has actual work experience)

First determine if the person is a FRESHER or EXPERIENCED:
- FRESHER: Has NO full-time work experience (only internships, projects, or coursework)
- EXPERIENCED: Has 1+ years of full-time work experience

If rewriting for FRESHER, format as:
"[Target Role] with a strong foundation in [Core Tech Stack from RESUME_TEXT], demonstrated through [X projects/internships]."

If rewriting for EXPERIENCED, format as:
"[Current/Target Role] with [X]+ years of experience in [Core Domain/Tech Stack from RESUME_TEXT]. [One sentence on key impact, achievements, or specialization backed by RESUME_TEXT only.]"
- Highlight years of experience, domain expertise, and measurable impact.
- DO NOT use fresher-style phrasing like 'strong foundation' or 'looking to contribute'.
- Keep it exactly 2 lines max, professional, and achievement-oriented.

Step 3: Education
- Keep as-is, NO changes. Include all educational qualifications present in RESUME_TEXT (B.Tech, XII, Diploma, etc.)
- If CGPA, percentage, or score is present in RESUME_TEXT, make sure to include it in the "cgpa" field.

Step 3.5: Work Experience (includes Internships for Freshers)
- ONLY include work experience entries that EXIST in RESUME_TEXT. If 0 jobs → output empty array.
- DO NOT alter the user's authentic job title. If RESUME_TEXT has "Software Engineer", keep it exactly as "Software Engineer".
- Keep ALL bullet points from RESUME_TEXT.
- PRESERVE strong bullets from RESUME_TEXT verbatim.
- ENHANCE weak bullets with better sentence framing, better words choice if required following resume writing principles without changing any meaning, data of original bullet points from resume_text and never invent non existing data or feature.

Step 4: Projects
- ALWAYS set "link": "Link" as default value for all projects.
- ONLY include projects that EXIST in RESUME_TEXT.
- Keep ALL bullet points from RESUME_TEXT.
- If bullets from RESUME_TEXT are already strong, keep them as-is.
- ENHANCE weak bullets with better sentence framing, better words choice if required following resume writing principles without changing any meaning, data of original bullet points from resume_text and never invent non existing data or feature.

Step 5: Skills Optimization (STRICT PRESERVATION)
Extract and categorize ALL skills ONLY from the dedicated "Skills" section of almost at the bottom of RESUME_TEXT.
1. ⛔ CRITICAL RULE: NEVER extract skills from the "Work Experience" or "Projects" sections. If a skill (e.g., "Docker") is mentioned in a project but not in the original Skills section, DO NOT add it.
2. NEVER invent any skills not present explicitly in the Skills section of RESUME_TEXT.
3. NEVER delete skills to meet arbitrary limits. Include everything from the Skills section.
3. Categorize them neatly:
   - Languages (Python, Java, JavaScript, C++, etc.)
   - Frameworks & Libraries (Springboot, Django, NodeJS, React, pandas etc.)
   - Databases
   - Cloud Services
   - Developer Tools & Methodologies (Git, Docker, Agile, VS Code)
   - Miscellaneous
4. If a skill from RESUME_TEXT doesn't fit standard categories, map it to "Miscellaneous" array.


Step 6: Certifications and Achievements
- ALWAYS output a single merged array named "certifications_and_achievements"
- Put certifications first, followed by achievements
- ⛔ ABSOLUTE RULE: If RESUME_TEXT has NO certifications or achievements, output an empty array: [].

ACHIEVEMENTS OPTIMIZATION:
For B.Tech Freshers — keep ONLY if present in RESUME_TEXT:
1. Competitive programming (LeetCode, CodeChef, Codeforces)
2. Hackathon wins/top placements
3. Open-source contributions
4. College achievements (if impressive)
5. Similar achievements as above which recruiters care.

Format:
✅ "Solved 300+ problems on LeetCode (Rating: 1650)"
✅ "Won 2nd place in XYZ Hackathon (50+ teams)"
✅ "Contributed to 3 open-source projects on GitHub (50+ commits)"
✅ "Participated in hackathon"
❌ "Good at problem solving" (generic — remove if in RESUME_TEXT)


81. OUTPUT FORMAT (Template v1):
82. - Return ONLY valid JSON below.
83. - DO NOT use markdown formatting (like **bold**, *italics*, # headers, etc.) inside the JSON string values. Use plain text only. No explanation.
84. {{
  "template_id": "v1",
  "heading": {{
    "name": "Full Name",
    "phone": "+91-XXXXXXXXXX",
    "email": "email@example.com",
    "linkedin_url": "linkedin.com/in/username",
    "github_url": "github.com/username",
    "portfolio_url": "portfolio.com"
  }},
  "summary": "Freshers: 2-line foundation-focused summary based on skills/projects in RESUME_TEXT. Experienced: 2-3 line impact-driven summary highlighting years of experience, domain expertise, and key achievements from RESUME_TEXT only.",
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
        "<follow step3.5>",
      ]
    }}
  ],
  "projects": [
    {{
      "title": "<exact project title from RESUME_TEXT>",
      "tech_stack": "<exact tech stack from RESUME_TEXT limit to 7 order by prioritized>",
      "link": "Link",
      "bullets": [
        "<follow step 4>"
      ]
    }}
  ],
  
  "certifications_and_achievements": [
    "<List of strings ONLY. NO DICTIONARIES OR OBJECTS. Extract EXACTLY as written in RESUME_TEXT.>",
    "<If none exist, use an empty array []>"
  ],
  
  "technical_skills": {{
    "languages": ["<only extract from dedicated Skills section of RESUME_TEXT, NEVER from projects/experience>"],
    "frameworks_and_libraries": ["<PUT BOTH FRAMEWORKS AND LIBRARIES HERE. only extract from dedicated Skills section of RESUME_TEXT, NEVER from projects/experience>"],
    "databases": ["<only extract from dedicated Skills section of RESUME_TEXT, NEVER from projects/experience>"],
    "cloud_services": ["<only extract from dedicated Skills section of RESUME_TEXT, NEVER from projects/experience>"],
    "developer_tools": ["<only extract from dedicated Skills section of RESUME_TEXT, NEVER from projects/experience>"],
    "miscellaneous": ["<only extract from dedicated Skills section of RESUME_TEXT, NEVER from projects/experience>"]
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
