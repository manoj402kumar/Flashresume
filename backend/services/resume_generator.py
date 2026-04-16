import json
import re
from prompts.generation_prompt import GENERATION_PROMPT
from llm.master_llm_caller import call_llm
from templates.template_v1_schema import TemplateV1

def generate_resume(resume_text: str, job_description: str, ats_score_before: int, approved_project: str = "") -> dict:
    # Build prompt with approved project if provided
    if approved_project:
        # Add approved project instruction to resume text
        resume_text_with_project = f"{resume_text}\n\n[APPROVED NEW PROJECT TO ADD]:\n{approved_project}\n\nIMPORTANT: Include this approved project in the final resume. This project was suggested and approved by the user to improve JD relevance."
    else:
        resume_text_with_project = resume_text
    
    prompt = GENERATION_PROMPT.format(
        resume_text=resume_text_with_project,
        job_description=job_description,
        ats_score_before=ats_score_before
    )

    result = call_llm(prompt)
    
    # Check if LLM call failed
    if not result["success"]:
        raise ValueError(f"All LLM providers failed: {result['all_attempts']}")
    
    raw_response = result["text"]
    
    # Strip DeepSeek thinking tokens if present
    raw_response = re.sub(r'<think>.*?</think>', '', raw_response, flags=re.DOTALL).strip()

    # Direct parse
    try:
        data = json.loads(raw_response)
    except json.JSONDecodeError:
        # Regex fallback
        match = re.search(r'\{.*\}', raw_response, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group())
            except json.JSONDecodeError:
                raise ValueError(f"Resume generation returned unparseable JSON: {raw_response[:300]}")
        else:
            raise ValueError(f"Resume generation returned unparseable JSON: {raw_response[:300]}")
    
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
        
        return validated_dict
    except Exception as e:
        raise ValueError(f"Generated JSON does not match Template v1 schema: {str(e)}")
