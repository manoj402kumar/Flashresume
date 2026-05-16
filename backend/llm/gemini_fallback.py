import os
import re
import time
from dotenv import load_dotenv

load_dotenv()

# -------------------------------------------------------------------
# Dual-client architecture — LAZY INITIALIZED (SYNC + THREADPOOL BRIDGE):
#   R1 client  → GEMINI_R1_API_KEY  (Account / Email 1)  timeout=30s
#   R2 client  → GEMINI_R2_API_KEY  (Account / Email 2)  timeout=90s
#
# NOTE: Gemini SDK async support (AsyncClient) is kept as Phase 2.
# For now, the sync client runs inside run_in_threadpool so it does
# NOT block the FastAPI event loop. The public async wrappers
# (call_single_gemini_r1 / r2) are awaitable and safe to use from
# async callers.
# -------------------------------------------------------------------
_client_r1 = None
_client_r2 = None

_GEMINI_R1_TIMEOUT_MS = 30_000   # 30 seconds in milliseconds (Gemini http_options)
_GEMINI_R2_TIMEOUT_MS = 90_000   # 90 seconds in milliseconds


def _get_client_r1():
    global _client_r1
    if _client_r1 is None:
        from google import genai
        api_key = os.getenv("GEMINI_R1_API_KEY")
        if not api_key:
            return None
        _client_r1 = genai.Client(
            api_key=api_key,
            http_options={"timeout": _GEMINI_R1_TIMEOUT_MS},
        )
    return _client_r1


def _get_client_r2():
    global _client_r2
    if _client_r2 is None:
        from google import genai
        api_key = os.getenv("GEMINI_R2_API_KEY")
        if not api_key:
            return None
        _client_r2 = genai.Client(
            api_key=api_key,
            http_options={"timeout": _GEMINI_R2_TIMEOUT_MS},
        )
    return _client_r2


def _extract_text(response) -> str | None:
    """
    Safely pull text from Gemini response.
    Handles: None response, SAFETY/RECITATION finish_reason, empty text.
    """
    try:
        candidate = response.candidates[0] if response.candidates else None
        if candidate is None:
            return None
        finish = str(getattr(candidate, "finish_reason", "")).upper()
        if finish in ("SAFETY", "RECITATION", "OTHER"):
            return None
        text = response.text
        if text is None:
            return None
        text = text.strip()
        if not text:
            return None
        text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()
        if not text:
            return None
        if text.startswith("```"):
            parts = text.split("```")
            text = parts[1] if len(parts) > 1 else text
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            text = match.group(0)
        if len(text.strip()) < 5:
            return None
        return text
    except (AttributeError, IndexError, TypeError, ValueError):
        return None


def _call_gemini_single_sync(get_client_fn, model: str, prompt: str, max_tokens: int, retries: int = 1) -> dict:
    """Synchronous inner implementation — called via run_in_threadpool."""
    from google.genai import types
    client = get_client_fn()
    if client is None:
        return {
            "success": False, "text": None, "model": None, "speed": None,
            "attempts": [{"model": model, "status": "skipped — Gemini API key not configured"}],
        }
    attempts = []
    for attempt in range(retries + 1):
        try:
            start = time.time()
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.1,
                    max_output_tokens=max_tokens,
                ),
            )
            elapsed = round(time.time() - start, 2)
            text = _extract_text(response)
            if text is None:
                attempts.append({"model": model, "status": "empty_safety_or_null_response"})
                break
            return {
                "success": True, "text": text, "model": model,
                "speed": elapsed, "attempts": attempts + [{"model": model, "status": "pass"}],
            }
        except Exception as e:
            err = str(e)
            attempts.append({"model": model, "status": err[:80]})
            if any(x in err for x in ["429", "RESOURCE_EXHAUSTED", "quota"]):
                break
            if any(x in err for x in ["404", "not found", "does not exist"]):
                break
            if any(x in err for x in ["401", "403", "API_KEY_INVALID", "permission"]):
                break
            if "context" in err.lower() and ("length" in err.lower() or "limit" in err.lower()):
                break
            if any(x in err for x in ["503", "500", "502", "UNAVAILABLE", "overloaded"]):
                if attempt < retries:
                    time.sleep(1)
                continue
            if "timeout" in err.lower() or "DeadlineExceeded" in err:
                if attempt < retries:
                    time.sleep(1)
                continue
            break
    return {"success": False, "text": None, "model": None, "speed": None, "attempts": attempts}


async def call_single_gemini_r1(model: str, prompt: str, max_tokens: int = 2500) -> dict:
    """Async wrapper — runs sync Gemini R1 call in threadpool. R1 timeout=30s."""
    from fastapi.concurrency import run_in_threadpool
    return await run_in_threadpool(
        _call_gemini_single_sync, _get_client_r1, model, prompt, max_tokens
    )


async def call_single_gemini_r2(model: str, prompt: str, max_tokens: int = 4500) -> dict:
    """Async wrapper — runs sync Gemini R2 call in threadpool. R2 timeout=90s."""
    from fastapi.concurrency import run_in_threadpool
    return await run_in_threadpool(
        _call_gemini_single_sync, _get_client_r2, model, prompt, max_tokens
    )
