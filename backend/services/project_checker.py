import json
import re
from prompts.project_prompt import PROJECT_CHECK_PROMPT
from llm.master_llm_caller import call_llm_r1

async def check_project_relevance(resume_text: str, job_description: str, preferred_model: str = "") -> dict:
    """
    Check resume projects against job description.
    Returns case (1/2/3), selected_projects, suggested_project, covered_jd_tech.
    """
    prompt = PROJECT_CHECK_PROMPT.format(
        resume_text=resume_text,
        job_description=job_description
    )

    result = await call_llm_r1(prompt, preferred_model)

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

    # Enforce selected_projects max 2
    if "selected_projects" in data and len(data["selected_projects"]) > 2:
        data["selected_projects"] = data["selected_projects"][:2]

    # Backward compat: map case → has_relevant_projects and relevant_projects
    case = data.get("case", 3)
    data["has_relevant_projects"] = (case == 3)
    data["relevant_projects"] = data.get("selected_projects", [])

    # Validate suggested_project is object or null (not array or string)
    if "suggested_project" in data and data["suggested_project"] is not None:
        if isinstance(data["suggested_project"], list):
            if len(data["suggested_project"]) > 0 and isinstance(data["suggested_project"][0], dict):
                data["suggested_project"] = data["suggested_project"][0]
            else:
                data["suggested_project"] = None
        elif not isinstance(data["suggested_project"], dict):
            data["suggested_project"] = None

    # Ensure covered_jd_tech is a list
    if "covered_jd_tech" not in data or not isinstance(data["covered_jd_tech"], list):
        data["covered_jd_tech"] = []

    return data
