import json
import re
from prompts.generation_prompt import GENERATION_PROMPT
from prompts.format_only_prompt import FORMAT_ONLY_PROMPT
from llm.master_llm_caller import call_llm_r2
from templates.template_v1_schema import TemplateV1

async def generate_resume(resume_text: str, job_description: str, ats_score_before: int, approved_project: str = "", missing_keywords: list[str] = None, selected_projects: list[str] = None, no_ai_changes: bool = False, preferred_model: str = "", extracted_links: dict | None = None) -> dict:
    is_no_jd_mode = not job_description or not job_description.strip()

    # Smart Truncation: Compress massive PDF whitespaces/newlines into single spaces, then cap at 12000 chars
    resume_text = " ".join(resume_text.split())[:12000]

    # ── Format extracted link context ──────────────────────────────────────
    links         = extracted_links or {}
    all_urls_raw  = links.get("all_urls", []) or []
    # Format all_urls as a numbered list for the LLM
    if all_urls_raw:
        all_urls_list = "\n".join(f"  {i+1}. {url}" for i, url in enumerate(all_urls_raw))
    else:
        all_urls_list = "  (none found)"

    # Route to correct prompt based on JD presence and flags
    if no_ai_changes or is_no_jd_mode:
        prompt = FORMAT_ONLY_PROMPT.format(
            resume_text=resume_text,
            ats_score_before=ats_score_before,
            all_urls_list=all_urls_list
        )
    else:
        # JD Optimization mode — pass approved_project as clean variable (not injected into resume_text)
        prompt = GENERATION_PROMPT.format(
            resume_text=resume_text,
            job_description=job_description,
            ats_score_before=ats_score_before,
            missing_keywords=", ".join(missing_keywords) if missing_keywords else "None",
            selected_projects=", ".join(selected_projects) if selected_projects else "(No pre-selection — pick the 2 most JD-relevant projects from RESUME_TEXT only. Max 2.)",
            approved_project=approved_project if approved_project else "none",
            all_urls_list=all_urls_list,
        )

    result = await call_llm_r2(prompt, preferred_model, no_ai_changes=no_ai_changes)
    
    # Check if LLM call failed
    if not result["success"]:
        raise ValueError(f"All LLM providers failed: {result['all_attempts']}")
    
    model_used = result.get("_model_used", "unknown")

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
        raise ValueError(f"Resume generation returned unparseable JSON: {raw_response[:400]}")
    
    # Pre-process certifications_and_achievements to flatten any hallucinated dicts into strings
    c_and_a = data.get("certifications_and_achievements")
    if isinstance(c_and_a, list):
        cleaned_c_and_a = []
        for item in c_and_a:
            if isinstance(item, dict):
                # Flatten it into a string: e.g. "Name - Year"
                parts = [str(v) for k, v in item.items() if k != "type" and str(v).strip()]
                cleaned_c_and_a.append(" | ".join(parts) if parts else str(item))
            elif isinstance(item, str):
                cleaned_c_and_a.append(item)
            else:
                cleaned_c_and_a.append(str(item))
        data["certifications_and_achievements"] = cleaned_c_and_a

    # Pre-process legacy separate fields if they exist
    for field in ["certifications", "achievements"]:
        arr = data.get(field)
        if isinstance(arr, list):
            cleaned_arr = []
            for item in arr:
                if isinstance(item, dict):
                    parts = [str(v) for k, v in item.items() if k != "type" and str(v).strip()]
                    cleaned_arr.append(" | ".join(parts) if parts else str(item))
                else:
                    cleaned_arr.append(str(item))
            data[field] = cleaned_arr

    # Pre-process projects: coerce tech_stack from list → comma-joined string
    # (LLM occasionally returns tech_stack as ["React", "Node"] instead of "React, Node")
    projects = data.get("projects")
    if isinstance(projects, list):
        for proj in projects:
            if isinstance(proj, dict) and isinstance(proj.get("tech_stack"), list):
                proj["tech_stack"] = ", ".join(str(t) for t in proj["tech_stack"])

    # Validate against Pydantic Template v1 schema
    try:
        validated = TemplateV1(**data)
        validated_dict = validated.model_dump()
        
        # ENFORCE MAX 2 PROJECTS (Code-level guarantee ONLY for JD Optimization)
        if len(validated_dict.get("projects", [])) > 2 and not (is_no_jd_mode or no_ai_changes):
            # Keep only top 2 projects (LLM should have ranked by relevance)
            removed_projects = [p["title"] for p in validated_dict["projects"][2:]]
            validated_dict["projects"] = validated_dict["projects"][:2]
            
            # Log the enforcement in changes
            enforcement_msg = f"Enforced MAX 2 projects rule (removed: {', '.join(removed_projects)})"
            if "changes" in validated_dict:
                validated_dict["changes"].append(enforcement_msg)
            else:
                validated_dict["changes"] = [enforcement_msg]
        
        # NOTE: we no longer hard-error on < 2 projects.
        # The generation prompt now correctly allows 1 project when the original
        # resume had only 1 and no approved project was provided.
        # The LLM is responsible for not fabricating projects.
        
        validated_dict["_model_used"] = model_used
        return validated_dict, model_used
    except Exception as e:
        raise ValueError(f"Generated JSON does not match Template v1 schema: {str(e)}")
