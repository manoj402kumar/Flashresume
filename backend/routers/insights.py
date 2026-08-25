import json
import re
import asyncio
from fastapi import APIRouter, HTTPException, Request, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from prompts.job_strategy_prompt import JOB_STRATEGY_PROMPT
from prompts.ai_suggestions_prompt import AI_SUGGESTIONS_PROMPT
from prompts.ai_changes_prompt import AI_CHANGES_PROMPT
from llm.master_llm_caller import call_llm_r2
from rate_limiter import limiter

router = APIRouter()

_MAX_RESUME_CHARS = 12_000
_MAX_JD_CHARS = 6_000


class InsightRequest(BaseModel):
    session_id: str = ""
    resume_text: str
    job_description: str = ""
    preferred_model: str = ""
    optimized_resume_json: str = ""  # for ai-changes endpoint only


def _parse_json_response(raw: str) -> dict:
    """Strip markdown fences and return parsed JSON dict. Raises ValueError on failure."""
    raw = re.sub(r"^[\s\S]*?(?=\{)", "", raw, count=1).strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw).strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    # Brace-matching walk
    for m in re.finditer(r"\{", raw):
        start, depth = m.start(), 0
        for i, ch in enumerate(raw[start:]):
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
            if depth == 0:
                try:
                    return json.loads(raw[start : start + i + 1])
                except json.JSONDecodeError:
                    break
    raise ValueError(f"Could not parse LLM response as JSON: {raw[:300]}")


@router.post("/insights/job-strategy")
@limiter.limit("10/minute")
async def get_job_strategy(
    request: Request,
    payload: InsightRequest,
    authorization: str = Header(None),
):
    """Lazily generate job_strategy on demand. Called only when user clicks the tab."""
    resume_text = " ".join(payload.resume_text.split())[:_MAX_RESUME_CHARS]
    job_description = (payload.job_description or "")[:_MAX_JD_CHARS]

    if not resume_text:
        raise HTTPException(status_code=400, detail="resume_text is required")

    prompt = JOB_STRATEGY_PROMPT.format(
        resume_text=resume_text,
        job_description=job_description or "(none)",
    )

    result = await call_llm_r2(prompt, payload.preferred_model or "")
    if not result["success"]:
        raise HTTPException(status_code=500, detail=f"LLM call failed: {result.get('all_attempts')}")

    try:
        data = _parse_json_response(result["text"])
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    job_strategy = data.get("job_strategy")
    if not isinstance(job_strategy, list):
        raise HTTPException(status_code=500, detail="LLM returned invalid job_strategy structure")

    return JSONResponse(content={"job_strategy": job_strategy})


@router.post("/insights/ai-suggestions")
@limiter.limit("10/minute")
async def get_ai_suggestions(
    request: Request,
    payload: InsightRequest,
    authorization: str = Header(None),
):
    """Lazily generate ai_suggestions on demand. Called only when user clicks the tab."""
    resume_text = " ".join(payload.resume_text.split())[:_MAX_RESUME_CHARS]
    job_description = (payload.job_description or "")[:_MAX_JD_CHARS]

    if not resume_text:
        raise HTTPException(status_code=400, detail="resume_text is required")

    prompt = AI_SUGGESTIONS_PROMPT.format(
        resume_text=resume_text,
        job_description=job_description or "(none)",
    )

    result = await call_llm_r2(prompt, payload.preferred_model or "")
    if not result["success"]:
        raise HTTPException(status_code=500, detail=f"LLM call failed: {result.get('all_attempts')}")

    try:
        data = _parse_json_response(result["text"])
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    ai_suggestions = data.get("ai_suggestions")
    if not isinstance(ai_suggestions, list):
        raise HTTPException(status_code=500, detail="LLM returned invalid ai_suggestions structure")

    return JSONResponse(content={"ai_suggestions": ai_suggestions})


@router.post("/insights/ai-changes")
@limiter.limit("10/minute")
async def get_ai_changes(
    request: Request,
    payload: InsightRequest,
    authorization: str = Header(None),
):
    """Lazily generate the changes list on demand. Called only when user clicks the AI Changes sub-tab."""
    resume_text = " ".join(payload.resume_text.split())[:_MAX_RESUME_CHARS]
    job_description = (payload.job_description or "")[:_MAX_JD_CHARS]
    optimized_resume_json = (payload.optimized_resume_json or "")[:20_000]

    if not resume_text:
        raise HTTPException(status_code=400, detail="resume_text is required")

    # format-only mode with no JD -- skip LLM, return static message
    if not job_description or job_description.strip().lower() in ("", "none", "(none)"):
        if not optimized_resume_json:
            return JSONResponse(content={"changes": ["Formatted original resume to structured JSON without AI enhancements."]})

    prompt = AI_CHANGES_PROMPT.format(
        resume_text=resume_text,
        job_description=job_description or "(none)",
        optimized_resume_json=optimized_resume_json or "(not provided)",
    )

    result = await call_llm_r2(prompt, payload.preferred_model or "")
    if not result["success"]:
        raise HTTPException(status_code=500, detail=f"LLM call failed: {result.get('all_attempts')}")

    try:
        data = _parse_json_response(result["text"])
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    changes = data.get("changes")
    if not isinstance(changes, list):
        raise HTTPException(status_code=500, detail="LLM returned invalid changes structure")

    return JSONResponse(content={"changes": changes})
