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
        return json.loads(raw_response.strip())
    except json.JSONDecodeError:
        pass

    # Try to extract from markdown codeblock
    match_md = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw_response, re.DOTALL)
    if match_md:
        try:
            return json.loads(match_md.group(1))
        except json.JSONDecodeError:
            pass

    # Fallback: extract JSON block from first { to last }
    start_idx = raw_response.find('{')
    end_idx = raw_response.rfind('}')
    if start_idx != -1 and end_idx != -1 and start_idx < end_idx:
        try:
            return json.loads(raw_response[start_idx:end_idx + 1])
        except json.JSONDecodeError:
            pass

    # If all parsing fails, raise a clear error with more context
    raise ValueError(f"LLM returned unparseable response. Raw output: {raw_response}")
