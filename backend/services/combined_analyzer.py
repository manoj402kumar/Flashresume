import json
import re
from prompts.combined_analysis_prompt import COMBINED_ANALYSIS_PROMPT
from llm.master_llm_caller import call_llm_r1


async def analyze_resume_combined(resume_text: str, job_description: str, preferred_model: str = "") -> dict:
    """
    Combined analyzer: ATS Scoring + Project Relevance in a SINGLE LLM call.
    The LLM directly outputs both all_missing_skills (full, for UI) and
    missing_skills (filtered, for generation step). No Python-side filtering needed.
    """
    # Smart Truncation: Compress massive PDF whitespaces/newlines into single spaces, then cap at 12000 chars
    resume_text = " ".join(resume_text.split())[:12000]

    prompt = COMBINED_ANALYSIS_PROMPT.format(
        resume_text=resume_text,
        job_description=job_description
    )
    result = await call_llm_r1(prompt, preferred_model)

    if not result["success"]:
        raise ValueError(f"All LLM providers failed: {result['all_attempts']}")

    raw_response = result["text"]

    # Layer 1: Strip any leading non-JSON preamble (e.g. "Here is the JSON:")
    # Note: <think> tags are already stripped by each provider's _extract_text() function.
    raw_response = re.sub(r'^[\s\S]*?(?=\{)', '', raw_response, count=1).strip()

    # Layer 2: Strip markdown code fences
    if raw_response.startswith("```"):
        raw_response = re.sub(r'^```(?:json)?\s*', '', raw_response)
        raw_response = re.sub(r'\s*```$', '', raw_response).strip()

    # Layer 3: Direct parse
    data = None
    try:
        data = json.loads(raw_response.strip())
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
        raise ValueError(f"Combined analysis returned unparseable response. Raw output: {raw_response[:400]}")

    # ── Enforce selected_projects max 2 ──
    if "selected_projects" in data and len(data["selected_projects"]) > 2:
        data["selected_projects"] = data["selected_projects"][:2]

    # ── Normalize ats_score to int (0-100) ──
    try:
        data["ats_score"] = max(0, min(100, int(float(data.get("ats_score", 0)))))
    except (ValueError, TypeError):
        data["ats_score"] = 0

    # ── Backward compat: map case → has_relevant_projects and relevant_projects ──
    # Normalize case to int — LLM may return "1" or "2" (string) instead of 1 or 2 (integer)
    try:
        data["case"] = int(data.get("case", 1))
    except (ValueError, TypeError):
        data["case"] = 1
    case = data["case"]
    data["has_relevant_projects"] = (case != 2)
    data["relevant_projects"] = data.get("selected_projects", [])

    # ── Validate suggested_project is object or null (not array or string) ──
    if "suggested_project" in data and data["suggested_project"] is not None:
        if isinstance(data["suggested_project"], list):
            if len(data["suggested_project"]) > 0 and isinstance(data["suggested_project"][0], dict):
                data["suggested_project"] = data["suggested_project"][0]
            else:
                data["suggested_project"] = None
        elif not isinstance(data["suggested_project"], dict):
            data["suggested_project"] = None

    # ── Ensure all_missing_skills is always present (fallback for older models) ──
    # If LLM only returned one list, duplicate it for backward compatibility.
    if "all_missing_skills" not in data:
        data["all_missing_skills"] = data.get("updated_missing_skills", [])
    if "updated_missing_skills" not in data:
        data["updated_missing_skills"] = data.get("all_missing_skills", [])

    # ── Normalize requires_consent to a proper Python bool ──
    # LLM sometimes returns the string "true" / "false" instead of a JSON boolean.
    # In JavaScript, the string "false" is truthy — this would break the analyze page check.
    rc = data.get("requires_consent", False)
    if isinstance(rc, str):
        data["requires_consent"] = rc.strip().lower() == "true"
    else:
        data["requires_consent"] = bool(rc)

    # ── Normalize total_projects_count to int ──
    tpc = data.get("total_projects_count", 0)
    try:
        data["total_projects_count"] = int(tpc)
    except (ValueError, TypeError):
        data["total_projects_count"] = 0

    # ── Cross-check: if case == 2 but requires_consent is False, fix it ──
    if data.get("case") == 2 and data.get("suggested_project") is not None:
        data["requires_consent"] = True

    data["_model_used"] = result.get("_model_used", "unknown")
    data["_provider"] = result.get("provider", "unknown")
    return data
