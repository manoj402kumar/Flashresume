import json
import re
from prompts.analysis_prompt import ANALYSIS_PROMPT
from llm.master_llm_caller import call_llm_r1

async def score_resume(resume_text: str, job_description: str, preferred_model: str = "") -> dict:
    """
    Analyzes resume against JD using the fine-tuned algorithm.
    Returns detailed analysis including section-wise gaps.
    """
    prompt = ANALYSIS_PROMPT.format(
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
        raise ValueError(f"LLM returned unparseable response. Raw output: {raw_response[:400]}")

    # ENFORCE: Keep only top 2 relevant projects in analysis
    if "relevant_projects" in data and len(data["relevant_projects"]) > 2:
        data["relevant_projects"] = data["relevant_projects"][:2]

    data["_model_used"] = result.get("model", "unknown")
    data["_provider"] = result.get("provider", "unknown")
    return data
