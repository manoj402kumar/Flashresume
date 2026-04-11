import json
import re
from prompts.generation_prompt import GENERATION_PROMPT
from llm.master_llm_caller import call_llm
from templates.template_v1_schema import TemplateV1

def generate_resume(resume_text: str, job_description: str, approved_suggestions: list[str], ats_score_before: int) -> dict:
    suggestions_text = "\n".join(approved_suggestions) if approved_suggestions else "None"

    prompt = GENERATION_PROMPT.format(
        resume_text=resume_text,
        job_description=job_description,
        approved_suggestions=suggestions_text,
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
        return validated.model_dump()
    except Exception as e:
        raise ValueError(f"Generated JSON does not match Template v1 schema: {str(e)}")
