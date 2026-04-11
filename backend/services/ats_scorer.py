import json
import re
from prompts.analysis_prompt import ANALYSIS_PROMPT
from llm.master_llm_caller import call_llm

def score_resume(resume_text: str, job_description: str) -> dict:
    prompt = ANALYSIS_PROMPT.format(
        resume_text=resume_text,
        job_description=job_description
    )
    result = call_llm(prompt)
    
    # Check if LLM call failed
    if not result["success"]:
        raise ValueError(f"All LLM providers failed: {result['all_attempts']}")
    
    raw_response = result["text"]

    # Attempt direct JSON parse
    try:
        return json.loads(raw_response)
    except json.JSONDecodeError:
        pass

    # Fallback: extract JSON block using regex
    match = re.search(r'\{.*\}', raw_response, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    # If all parsing fails, raise a clear error
    raise ValueError(f"LLM returned unparseable response: {raw_response[:200]}")
