import json
import re
from prompts.project_prompt import PROJECT_CHECK_PROMPT
from llm.master_llm_caller import call_llm

def extract_projects_section(resume_text: str) -> str:
    """
    Extract the projects section from resume text.
    Uses regex to find content between PROJECTS header and next section.
    """
    # Try to find PROJECTS section (case insensitive)
    patterns = [
        r'PROJECTS?\s*\n(.*?)(?=\n[A-Z]{3,}|\Z)',  # PROJECTS followed by next section
        r'Projects?\s*\n(.*?)(?=\n[A-Z]{3,}|\Z)',   # Projects followed by next section
    ]
    
    for pattern in patterns:
        match = re.search(pattern, resume_text, re.IGNORECASE | re.DOTALL)
        if match:
            return match.group(1).strip()
    
    # If no projects section found, return empty
    return "No projects section found in resume."

def check_project_relevance(resume_text: str, job_description: str) -> dict:
    """
    Check if resume projects are relevant to job description.
    Returns project relevance analysis with suggestions if needed.
    """
    # Extract projects section from resume
    projects_section = extract_projects_section(resume_text)
    
    # Build prompt
    prompt = PROJECT_CHECK_PROMPT.format(
        resume_projects=projects_section,
        job_description=job_description
    )
    
    # Call LLM
    result = call_llm(prompt)
    
    # Check if LLM call failed
    if not result["success"]:
        raise ValueError(f"All LLM providers failed: {result['all_attempts']}")
    
    raw_response = result["text"]
    
    # Strip DeepSeek thinking tokens if present
    raw_response = re.sub(r'<think>.*?</think>', '', raw_response, flags=re.DOTALL).strip()
    
    # Parse JSON response
    try:
        data = json.loads(raw_response)
    except json.JSONDecodeError:
        # Regex fallback
        match = re.search(r'\{.*\}', raw_response, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group())
            except json.JSONDecodeError:
                raise ValueError(f"Project check returned unparseable JSON: {raw_response[:300]}")
        else:
            raise ValueError(f"Project check returned unparseable JSON: {raw_response[:300]}")
    
    return data
