# Certification Section Implementation

## Problem
The LaTeX template (`template_v1.tex`) only had an `ACHIEVEMENTS_SECTION` placeholder and didn't support the conditional certification logic defined in the schema and generation prompt.

## Solution Implemented

### 1. **Schema** (Already Correct)
```python
certifications: Optional[list[str]] = None  # If 2+ certifications
achievements: Optional[list[str]] = None  # If certifications separate OR no certs
certifications_and_achievements: Optional[list[str]] = None  # If 1 certification (merged)
```

### 2. **LaTeX Template** (`template_v1.tex`)
**Changed:**
```latex
%-----------CERTIFICATIONS & ACHIEVEMENTS-----------
{{CERTIFICATIONS_SECTION}}
```

**Before:**
```latex
%-----------ACHIEVEMENTS-----------
{{ACHIEVEMENTS_SECTION}}
```

### 3. **LaTeX Compiler** (`latex_compiler.py`)

**New Function:** `format_certifications_and_achievements()`

**Logic:**
```python
# Scenario 1: certifications_and_achievements exists (1 certification)
→ Single section: "Certifications & Achievements"

# Scenario 2: certifications exists and len >= 2
→ Two sections: "Certifications" + "Achievements"

# Scenario 3: Only achievements (0 certifications)
→ Single section: "Achievements"
```

## Output Examples

### Example 1: 2+ Certifications
```
CERTIFICATIONS
• AWS Certified Solutions Architect
• Google Cloud Professional
• Microsoft Azure Fundamentals

ACHIEVEMENTS
• Solved 500+ problems on LeetCode
• Won 2nd place in hackathon
```

### Example 2: 1 Certification
```
CERTIFICATIONS & ACHIEVEMENTS
• AWS Certified Cloud Practitioner (2024)
• Solved 300+ problems on LeetCode
• Won 2nd place in Smart India Hackathon
```

### Example 3: 0 Certifications
```
ACHIEVEMENTS
• Solved 500+ problems on LeetCode
• Contributed to 3 open-source projects
• Won 2nd place in hackathon
```

## Files Modified

1. ✅ `backend/templates/template_v1.tex` - Updated placeholder
2. ✅ `backend/services/latex_compiler.py` - Added conditional logic
3. ✅ `backend/templates/template_v1_schema.py` - Already correct
4. ✅ `backend/prompts/generation_prompt.py` - Already has logic

## Testing

The LLM (via generation_prompt.py) will decide which format to use based on:
- Certification count in original resume
- JD relevance
- Fresher profile optimization

The LaTeX compiler will automatically format the correct section(s) based on what the LLM returns.

## Section Order (Final Resume)

1. Education
2. Experience
3. Projects
4. **Certifications** (if 2+) OR **Certifications & Achievements** (if 1) OR **Achievements** (if 0)
5. Technical Skills
