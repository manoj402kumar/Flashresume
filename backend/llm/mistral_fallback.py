import os
import re
import time
from dotenv import load_dotenv

load_dotenv()

# -------------------------------------------------------------------
# Dual-client architecture — LAZY INITIALIZED (ASYNC):
#   R1 client  → MISTRAL_R1_API_KEY  (Account / Email 1)  timeout=60s
#   R2 client  → MISTRAL_R2_API_KEY  (Account / Email 2)  timeout=90s
#
# Clients are created on first use, NOT at module import time.
# Uses AsyncMistral for non-blocking async calls.
# -------------------------------------------------------------------
_client_r1 = None
_client_r2 = None
_client_r3 = None


def _get_client_r1():
    global _client_r1
    if _client_r1 is None:
        try:
            from mistralai import Mistral
        except ImportError:
            from mistralai.client import Mistral
        api_key = os.getenv("MISTRAL_R1_API_KEY")
        if not api_key:
            return None
        _client_r1 = Mistral(api_key=api_key, timeout_ms=60000)
    return _client_r1


def _get_client_r2():
    global _client_r2
    if _client_r2 is None:
        try:
            from mistralai import Mistral
        except ImportError:
            from mistralai.client import Mistral
        api_key = os.getenv("MISTRAL_R2_API_KEY")
        if not api_key:
            return None
        _client_r2 = Mistral(api_key=api_key, timeout_ms=90000)
    return _client_r2


def _get_client_r3():
    global _client_r3
    if _client_r3 is None:
        try:
            from mistralai import Mistral
        except ImportError:
            from mistralai.client import Mistral
        api_key = os.getenv("MISTRAL_R3_API_KEY")
        if not api_key:
            return None
        _client_r3 = Mistral(api_key=api_key, timeout_ms=90000)
    return _client_r3


def _extract_text(response) -> str | None:
    """Safely pull text from Mistral response. Returns None on any structural issue."""
    try:
        text = response.choices[0].message.content
        if text is None:
            return None
            
        # Handle new Mistral SDK returning list of chunks for reasoning models
        if isinstance(text, list):
            # Extract the actual text chunk, ignoring ThinkChunk
            extracted = ""
            for chunk in text:
                if getattr(chunk, "type", "") == "text":
                    extracted += getattr(chunk, "text", "")
            text = extracted

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


async def _call_mistral_single(get_client_fn, model: str, prompt: str, max_tokens: int, retries: int = 0) -> dict:
    client = get_client_fn()
    if client is None:
        return {
            "success": False, "text": None, "model": None, "speed": None,
            "attempts": [{"model": model, "status": "skipped — Mistral API key not configured"}],
        }
    attempts = []
    for attempt in range(retries + 1):
        try:
            start = time.time()
            response = await client.chat.complete_async(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=max_tokens,
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
            if any(x in err for x in ["429", "rate_limit", "rate limit", "too many requests"]):
                break
            if any(x in err for x in ["404", "model_not_found", "does not exist", "No such model"]):
                break
            if any(x in err for x in ["401", "403", "invalid_api_key", "Unauthorized"]):
                break
            if "tokens" in err.lower() and ("exceed" in err.lower() or "limit" in err.lower()):
                break
            if any(x in err for x in ["503", "500", "502", "overloaded", "capacity"]):
                if attempt < retries:
                    import asyncio
                    await asyncio.sleep(1)
                continue
            if "timeout" in err.lower() or "timed out" in err.lower() or "ReadTimeout" in err:
                if attempt < retries:
                    import asyncio
                    await asyncio.sleep(1)
                continue
            break
    return {"success": False, "text": None, "model": None, "speed": None, "attempts": attempts}


async def call_single_mistral_r1(model: str, prompt: str, max_tokens: int = 2500) -> dict:
    """Call exactly one Mistral model using the R1 API key (Account 1). R1 timeout=30s."""
    return await _call_mistral_single(_get_client_r1, model, prompt, max_tokens)


async def call_single_mistral_r2(model: str, prompt: str, max_tokens: int = 4500) -> dict:
    """Call exactly one Mistral model using the R2 API key (Account 2). R2 timeout=90s."""
    return await _call_mistral_single(_get_client_r2, model, prompt, max_tokens)


async def call_single_mistral_r3(model: str, prompt: str, max_tokens: int = 4500) -> dict:
    """Call exactly one Mistral model using the R3 API key (Account 3). R3 timeout=90s."""
    return await _call_mistral_single(_get_client_r3, model, prompt, max_tokens)
