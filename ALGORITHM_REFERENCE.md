# FlashResume Algorithm - Quick Reference
## Core Algorithm Flow (generation_prompt.py)

---

## 🎯 OBJECTIVE
**"Get shortlisted in ATS + Prove claims in real interview"**
- 0% Noise, 100% Signal
- Target: 1-page resume
- Improvise existing resume, NOT rewrite

---

## 📊 TARGET USERS
**B.Tech Freshers (0-1 year experience)**
- Majority users are students with limited work experience
- May have 0-2 internships
- Need authentic, interview-ready content

---

## 🔄 ALGORITHM STEPS

### Step 0: Determine Candidate Level
```
Count full-time work experience (excluding internships):
- Fresher: 0 full-time jobs (may have 0-2 internships)
- Junior: 1-2 years full-time
- Mid/Senior: 3+ years full-time
```

### Step 2: Summary Evaluation
**KEEP AS-IS if summary has 4+ criteria:**
1. Has specific technologies? (React, Node.js, Python)
2. Mentions projects or experience? (3 projects, internship)
3. Aligns with JD? (matches JD role and skills)
4. Professional tone? (no "I am", no generic phrases)
5. Concise? (1-2 lines)

**REWRITE ONLY if summary has issues:**
- Generic phrases: "hardworking", "passionate", "looking for opportunities"
- First-person: "I am", "My goal is"
- No specific technologies
- More than 2 lines

### Step 3: Education
- Keep as-is, NO changes
- If CGPA >7.5/10 or >3.0/4.0, include it

### Step 3.5: Work Experience (Internships for Freshers)
**IMPORTANT**: For freshers, internships go in "Work Experience" section

**Enhancement Decision Logic** (for each bullet):
Evaluate:
1. Has action verb? (Developed, Built, Implemented)
2. Mentions specific work? (not vague "worked on")
3. Includes technologies? (Node.js, React, MongoDB)
4. Shows scope or impact? (3 APIs, 10+ bugs)

**KEEP AS-IS if bullet has 3+ criteria**

**ENHANCE if bullet is weak/generic:**
- ❌ "Worked on backend development" → ✅ "Contributed to backend API development using Node.js, implementing 3 REST endpoints"
- ❌ "Fixed bugs" → ✅ "Resolved 10+ bugs in production codebase"

**Authentic Metrics for Interns:**
- ✅ "Implemented 3 API endpoints"
- ✅ "Fixed 10+ bugs in production"
- ✅ "Contributed to feature used by 5-member team"
- ❌ "Led team of 5" (unless true)
- ❌ "Managed $X budget" (not intern work)

### Step 4: Projects (CRITICAL)
**PROJECT COUNT RULES:**
- Minimum: 2 projects
- Maximum: 2 projects (STRICT - never more)
- ALWAYS show exactly 2 projects
- NEVER show 1 project (looks incomplete)
- NEVER show 3+ projects (cluttered)

**Project Selection:**
- If 3+ projects: Keep top 2 most JD-relevant
- If <2 projects: Use approved suggested project

**Enhancement Decision Logic** (for each bullet):
Evaluate:
1. Has action verb? (Built, Developed, Implemented)
2. Mentions specific features? (not vague "built app")
3. Includes tech stack? (React, Node.js, MongoDB)
4. Shows scope or complexity? (15+ operations, 3 APIs)

**KEEP AS-IS if bullet has 3+ criteria**

**ENHANCE if bullet is weak**

**Keyword Insertion Limits:**
- Max 3-4 new keywords per project
- Max 2-3 new keywords per experience bullet
- Prioritize most important JD keywords (mentioned 3+ times)
- If adding keyword makes it unnatural → DON'T ADD

### Step 5: Certifications and Achievements (Smart Merging)
**Section Logic:**
- If 2+ Certifications: Separate "certifications" + "achievements" arrays
- If 1 Certification: Single "certifications_and_achievements" array
- If 0 Certifications: Only "achievements" array

**Prioritization for Freshers:**
1. Industry certifications (AWS, Google Cloud, Azure)
2. Relevant online courses (Coursera, edX) - ONLY if JD-relevant
3. Competitive programming (LeetCode, CodeChef)

**Limits:**
- Keep max 3-4 certifications
- Prioritize recent (<4 years old)

**Exclusion Criteria:**
- ❌ Non-technical (Excel, Typing, Soft Skills)
- ❌ Too basic (HTML/CSS basics if applying for backend)
- ❌ Outdated (>3 years old unless prestigious)
- ❌ "Participation" certificates

### Step 6: Skills Optimization (LAST SECTION)
**Preservation Logic:**
Evaluate original skills:
1. Are skills categorized?
2. Are JD-matched skills present?
3. Is it clean? (no IDEs, no basic tools)
4. Reasonable count? (4-6 per category)

**KEEP AS-IS if well-organized**  
Just REORDER to put JD-matched skills FIRST

**Organization Rules:**
1. Put JD-matched skills FIRST in each category
2. Limit each category to 4-6 skills
3. Remove very basic skills (HTML, CSS unless JD-specific)
4. Remove IDE/editors (VS Code, Sublime)
5. Remove OS (Windows, Linux unless JD-specific)

**Category Order:**
1. Languages
2. Frameworks/Libraries
3. Databases
4. Cloud Services (only if used in projects)
5. Developer Tools (Git, Docker, Postman - professional tools only)

---

## 🚫 FORBIDDEN FOR FRESHERS

### Fake Metrics
- ❌ "Serving X users" (unless deployed and tracked)
- ❌ "X% improvement" (unless measured)
- ❌ "Scaled to handle X requests" (unless load tested)
- ❌ "Generated $X revenue" (unless real business)
- ❌ "Managed team of X" (unless true)

### Fake Experience
- ❌ Inventing jobs, degrees, or experience
- ❌ Claiming "Led" or "Managed" without proof
- ❌ Adding certifications not earned
- ❌ Exaggerating internship responsibilities

---

## ✅ AUTHENTIC METRICS (Allowed)

### Countable Metrics (Always Safe)
- ✅ "Implemented 15+ CRUD operations"
- ✅ "Built with 5 database tables"
- ✅ "Created 10+ React components"
- ✅ "Integrated 3 third-party APIs"
- ✅ "Wrote 20+ unit tests"

### Technical Complexity (Shows Skills)
- ✅ "Implemented JWT authentication"
- ✅ "Built responsive UI with Material-UI"
- ✅ "Integrated Stripe payment gateway"
- ✅ "Deployed using Docker containers"
- ✅ "Set up CI/CD pipeline with GitHub Actions"

### Performance Metrics (Only if Measured)
- ✅ "Optimized load time from 3s to 1s" (if measured)
- ✅ "Reduced API calls by implementing caching"
- ❌ "Reduced latency by 50%" (if not measured)

---

## 📋 SECTION ORDER (MANDATORY)

1. **Summary** (2 lines maximum)
2. **Education** (with CGPA if >7.5/10)
3. **Work Experience** (includes internships for freshers - skip if no experience)
4. **Projects** (ALWAYS exactly 2 projects, STRICT MAX 2)
5. **Certifications** (if 2+) OR "Certifications & Achievements" (if 1) OR Achievements (if 0)
6. **Skills** (LAST section always)

---

## 🎨 PRESERVATION PHILOSOPHY

**"If original is good, keep it. Only enhance what needs enhancement."**

### Evaluation Before Modification
- Check if bullet has action verb
- Check if bullet mentions specific work
- Check if bullet includes technologies
- Check if bullet shows scope/impact

### Keep Good Content
- ✅ "Contributed to backend API development using Node.js and Express, implementing 3 REST endpoints"
- ✅ "Built full-stack e-commerce platform with user authentication using React and Node.js"

### Enhance Weak Content
- ❌ "Worked on backend development"
- ❌ "Built using React and Node.js"
- ❌ "Fixed bugs"

---

## 🔒 GOLDEN RULES

1. **NEVER** invent jobs, degrees, or experience
2. Algorithm decides all optimizations independently
3. Use action verbs: Built, Developed, Optimized, Implemented
4. Add AUTHENTIC quantified metrics only
5. Weave JD keywords naturally
6. Keep dates, companies, institutions exactly as original
7. **ALWAYS** show exactly 2 projects (STRICT MAX 2, MIN 2)
8. Target 1-page resume
9. **PRESERVE** good original content
10. Return ONLY JSON (no markdown, no explanation)

---

## 📊 OUTPUT FORMAT

**Template V1 JSON Structure:**
```json
{
  "template_id": "v1",
  "heading": {
    "name": "Full Name",
    "phone": "+91-XXXXXXXXXX",
    "email": "email@example.com",
    "linkedin_url": "linkedin.com/in/username",
    "github_url": "github.com/username",  // CRITICAL for freshers
    "portfolio_url": "portfolio.com"      // Optional
  },
  "summary": "2-line impactful summary",
  "education": [...],
  "experience": [...],
  "projects": [...],  // ALWAYS exactly 2
  "certifications": [...] OR "certifications_and_achievements": [...] OR "achievements": [...],
  "technical_skills": {...},
  "changes": [
    "Kept summary as-is (already good)",
    "Enhanced Project X bullet 1: [old] → [new]",
    "Added Docker to developer_tools",
    "Removed least relevant project: Project Y"
  ],
  "ats_score_before": 65,
  "ats_score_after": 0  // Calculated after generation
}
```

---

## 🎯 SUCCESS CRITERIA

### For Freshers
- Resume fits on 1 page
- Exactly 2 high-quality projects
- Authentic metrics only
- Interview-ready content
- ATS score improvement of 20-30 points
- All claims can be defended in interview

### Quality Checks
- No fake experience
- No fake metrics
- No generic phrases
- No first-person language
- Professional tone throughout
- JD keywords naturally integrated

---

**Remember**: The goal is to help freshers get shortlisted while ensuring they can confidently handle the interview. Authenticity > Keyword stuffing.
