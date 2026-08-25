AI_CHANGES_PROMPT = """
You are a resume diff analyst. Compare ORIGINAL_RESUME_TEXT with OPTIMIZED_RESUME_JSON and list every meaningful change made during optimization.

TASK: Produce a "changes" array documenting what was modified, added, or removed.

RULES:
- List EVERY meaningful change. Be specific and concrete.
- Format: verb + section + what changed.
- Keep each entry under 25 words. Plain text, no markdown.
- Output as a flat array of plain strings.
- If no meaningful changes detected (format-only): return ["Formatted original resume to structured JSON without AI enhancements."]

Common formats:
  Rewrote Summary: [old] -> [new]
  Enhanced [Job/Project] bullet: [old] -> [new]
  Injected '[keyword]' into [section] (required by JD)
  Added '[item]' to [field]
  Removed '[item]' -- [reason]

OUTPUT FORMAT (return ONLY valid JSON, nothing else):
{{
  "changes": [
    "Rewrote Summary: 'Experienced developer' -> 'Full-stack developer with 2 years React/Node.js experience'",
    "Enhanced Project bullet: 'Built app' -> 'Developed food delivery app using React/Node.js serving 500+ users'",
    "Injected 'Docker' into cloud_and_dev_tools (required by JD)",
    "Removed 'MS Excel' from miscellaneous -- not relevant to SDE role"
  ]
}}

ORIGINAL_RESUME_TEXT:
{resume_text}

JOB_DESCRIPTION (context for what was optimized; "none" means format-only mode):
{job_description}

OPTIMIZED_RESUME_JSON (compare key sections like summary, experience bullets, project bullets, skills against ORIGINAL_RESUME_TEXT):
{optimized_resume_json}
"""
