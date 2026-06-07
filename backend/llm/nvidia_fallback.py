import os
import re
import time
import asyncio
import httpx
from dotenv import load_dotenv

load_dotenv()

# -------------------------------------------------------------------
# Dual-client architecture — LAZY INITIALIZED (ASYNC):
#   R1 client  → NVIDIA_R1_API_KEY  (Account / Email 1)  timeout=60s
#   R2 client  → NVIDIA_R2_API_KEY  (Account / Email 2)  timeout=90s
#
# Clients are created on first use, NOT at module import time.
# NVIDIA NIM uses an OpenAI-compatible endpoint — uses AsyncOpenAI.
# -------------------------------------------------------------------
_NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"

_client_r1 = None
_client_r2 = None


def _get_client_r1():
    global _client_r1
    if _client_r1 is None:
        from openai import AsyncOpenAI
        api_key = os.getenv("NVIDIA_R1_API_KEY")
        if not api_key:
            return None
        _client_r1 = AsyncOpenAI(
            base_url=_NVIDIA_BASE_URL, 
            api_key=api_key, 
            timeout=60,
            http_client=httpx.AsyncClient(http2=False)
        )
    return _client_r1


def _get_client_r2():
    global _client_r2
    if _client_r2 is None:
        from openai import AsyncOpenAI
        api_key = os.getenv("NVIDIA_R2_API_KEY")
        if not api_key:
            return None
        _client_r2 = AsyncOpenAI(
            base_url=_NVIDIA_BASE_URL, 
            api_key=api_key, 
            timeout=90,
            http_client=httpx.AsyncClient(http2=False)
        )
    return _client_r2


def _extract_text(response) -> str | None:
    """Safely pull text from NVIDIA NIM response (OpenAI-compatible)."""
    try:
        text = response.choices[0].message.content
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
    except (AttributeError, IndexError, TypeError):
        return None


async def _call_nvidia_single(get_client_fn, model: str, prompt: str, max_tokens: int, retries: int = 0) -> dict:
    client = get_client_fn()
    if client is None:
        return {
            "success": False, "text": None, "model": None, "speed": None,
            "attempts": [{"model": model, "status": "skipped — NVIDIA API key not configured"}],
        }
    attempts = []
    for attempt in range(retries + 1):
        try:
            start = time.time()
            response = await asyncio.wait_for(
                client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.1,
                    max_tokens=max_tokens,
                ),
                timeout=90
            )
            elapsed = round(time.time() - start, 2)
            text = _extract_text(response)
            if text is None:
                attempts.append({"model": model, "status": "empty_or_null_response"})
                break
            return {
                "success": True, "text": text, "model": model,
                "speed": elapsed, "attempts": attempts + [{"model": model, "status": "pass"}],
            }
        except Exception as e:
            err = repr(e)
            attempts.append({"model": model, "status": err[:80]})
            if any(x in err for x in ["429", "rate_limit", "rate limit", "too many requests", "RESOURCE_EXHAUSTED"]):
                break
            if any(x in err for x in ["404", "model_not_found", "does not exist", "No such model"]):
                break
            if any(x in err for x in ["401", "403", "invalid_api_key", "Unauthorized", "authentication"]):
                break
            if "context_length_exceeded" in err or "maximum context" in err.lower():
                break
            if any(x in err for x in ["503", "500", "502", "overloaded", "capacity"]):
                if attempt < retries:
                    await asyncio.sleep(1)
                continue
            if "timeout" in err.lower() or "timed out" in err.lower():
                if attempt < retries:
                    await asyncio.sleep(1)
                continue
            break
    return {"success": False, "text": None, "model": None, "speed": None, "attempts": attempts}


async def call_single_nvidia_r1(model: str, prompt: str, max_tokens: int = 2500) -> dict:
    """Call exactly one NVIDIA NIM model using the R1 API key (Account 1). R1 timeout=30s."""
    return await _call_nvidia_single(_get_client_r1, model, prompt, max_tokens)


async def call_single_nvidia_r2(model: str, prompt: str, max_tokens: int = 4500) -> dict:
    """Call exactly one NVIDIA NIM model using the R2 API key (Account 2). R2 timeout=90s."""
    return await _call_nvidia_single(_get_client_r2, model, prompt, max_tokens)
