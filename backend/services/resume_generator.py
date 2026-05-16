import json
import re
from prompts.generation_prompt import GENERATION_PROMPT
from prompts.general_optimization_prompt import GENERAL_OPTIMIZATION_PROMPT
from prompts.format_only_prompt import FORMAT_ONLY_PROMPT
from llm.master_llm_caller import call_llm_r2
from templates.template_v1_schema import TemplateV1

async def generate_resume(resume_text: str, job_description: str, ats_score_before: int, approved_project: str = "", missing_keywords: list[str] = None, no_ai_changes: bool = False, preferred_model: str = "") -> dict:
    is_no_jd_mode = not job_description or not job_description.strip()

    # Build prompt with approved project ONLY if we are in JD optimization mode
    if approved_project and not is_no_jd_mode and not no_ai_changes:
        # Add approved project instruction to resume text
        resume_text_with_project = f"{resume_text}\n\n[APPROVED NEW PROJECT TO ADD]:\n{approved_project}\n\nIMPORTANT: Include this approved project in the final resume. This project was suggested and approved by the user to improve JD relevance."
    else:
        resume_text_with_project = resume_text
    
    # Route to correct prompt based on JD presence and flags
    if no_ai_changes:
        prompt = FORMAT_ONLY_PROMPT.format(
            resume_text=resume_text_with_project,
            ats_score_before=ats_score_before
        )
    elif is_no_jd_mode:
        # General formatting mode (No JD) - 100% strict preservation
        prompt = GENERAL_OPTIMIZATION_PROMPT.format(
            resume_text=resume_text_with_project,
            ats_score_before=ats_score_before
        )
    else:
        # JD Optimization mode
        prompt = GENERATION_PROMPT.format(
            resume_text=resume_text_with_project,
            job_description=job_description,
            ats_score_before=ats_score_before,
            missing_keywords=", ".join(missing_keywords) if missing_keywords else "None"
        )

    result = await call_llm_r2(prompt, preferred_model)
    
    # Check if LLM call failed
    if not result["success"]:
        raise ValueError(f"All LLM providers failed: {result['all_attempts']}")
    
    model_used = result.get("model", "unknown")

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
        
        # ENFORCE MAX 2 PROJECTS (Code-level guarantee)
        if len(validated_dict.get("projects", [])) > 2:
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
        
        return validated_dict, model_used
    except Exception as e:
        raise ValueError(f"Generated JSON does not match Template v1 schema: {str(e)}")
