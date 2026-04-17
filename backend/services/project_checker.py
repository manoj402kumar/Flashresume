import json
import re
from prompts.project_prompt import PROJECT_CHECK_PROMPT
from llm.master_llm_caller import call_llm

def extract_projects_section(resume_text: str) -> str:
    """
    Extract the projects section from resume text.
    Uses multiple strategies to find projects.
    """
    # Strategy 1: Find PROJECTS header (case insensitive)
    patterns = [
        r'PROJECTS?\s*[:\n](.*?)(?=\n\s*[A-Z][A-Z\s]{2,}[:\n]|\Z)',  # PROJECTS: or PROJECTS\n
        r'Projects?\s*[:\n](.*?)(?=\n\s*[A-Z][A-Z\s]{2,}[:\n]|\Z)',   # Projects: or Projects\n
    ]
    
    for pattern in patterns:
        match = re.search(pattern, resume_text, re.IGNORECASE | re.DOTALL)
        if match:
            projects_text = match.group(1).strip()
            if len(projects_text) > 50:  # Valid projects section should have content
                return projects_text
    
    # Strategy 2: Look for project-like content (tech stack indicators)
    # If we find React, Node, Python, etc. with bullet points, it's likely projects
    tech_keywords = ['react', 'node', 'python', 'java', 'mongodb', 'express', 'django', 'flask', 'angular', 'vue']
    lines = resume_text.split('\n')
    
    for i, line in enumerate(lines):
        line_lower = line.lower()
        # Check if line contains tech keywords and looks like a project title
        if any(tech in line_lower for tech in tech_keywords):
            # Extract surrounding context (likely a project)
            start = max(0, i - 2)
            end = min(len(lines), i + 10)
            context = '\n'.join(lines[start:end])
            if len(context) > 50:
                return f"Found project content:\n{context}"
    
    return "No projects section found in resume."

def check_project_relevance(resume_text: str, job_description: str, preferred_model: str = None) -> dict:
    """
    Check if resume projects are relevant to job description.
    Returns project relevance analysis with suggestions if needed.
    """
    # Build prompt
    prompt = PROJECT_CHECK_PROMPT.format(
        resume_text=resume_text,
        job_description=job_description
    )
    
    # Call LLM
    result = call_llm(prompt, preferred_model=preferred_model)
    
    # Check if LLM call failed
    if not result["success"]:
        raise ValueError(f"All LLM providers failed: {result['all_attempts']}")
    
    raw_response = result["text"]

    # Layer 1: Strip <think> tags and markdown reasoning preamble
    raw_response = re.sub(r'<think>.*?</think>', '', raw_response, flags=re.DOTALL).strip()
    raw_response = re.sub(r'^[\s\S]*?(?=\{)', '', raw_response, count=1).strip()

    # Layer 2: Strip markdown code fences
    if raw_response.startswith("```"):
        raw_response = re.sub(r'^```(?:json)?\s*', '', raw_response)
        raw_response = re.sub(r'\s*```$', '', raw_response).strip()

    # Layer 3: Direct parse
    data = None
    try:
        data = json.loads(raw_response)
    except json.JSONDecodeError:
        pass

    # Layer 4: Brace-matching walk to find outermost valid JSON object
    if data is None:
        for start_match in re.finditer(r'\{', raw_response):
            start = start_match.start()
            depth = 0
            for i, ch in enumerate(raw_response[start:]):
                if ch == '{': depth += 1
                elif ch == '}': depth -= 1
                if depth == 0:
                    try:
                        data = json.loads(raw_response[start:start + i + 1])
                        break
                    except json.JSONDecodeError:
                        continue
            if data is not None:
                break

    if data is None:
        raise ValueError(f"Project check returned unparseable JSON: {raw_response[:400]}")
    
    # ENFORCE: Keep only top 2 relevant projects (if more than 2)
    if "relevant_projects" in data and len(data["relevant_projects"]) > 2:
        data["relevant_projects"] = data["relevant_projects"][:2]
    
    # VALIDATION: Ensure suggested_project is object or null (not array)
    if "suggested_project" in data:
        if isinstance(data["suggested_project"], list):
            if len(data["suggested_project"]) > 0:
                data["suggested_project"] = data["suggested_project"][0]
            else:
                data["suggested_project"] = None
    
    return data
