import os
import re
import time
from dotenv import load_dotenv

load_dotenv()

# -------------------------------------------------------------------
# Dual-client architecture — LAZY INITIALIZED (ASYNC):
#   R1 client  → CLOUDFLARE_R1_API_TOKEN + ACCOUNT_ID
#   R2 client  → CLOUDFLARE_R2_API_TOKEN + ACCOUNT_ID
#
# Clients are created on first use, NOT at module import time.
# Uses AsyncOpenAI for Cloudflare Workers Ai  compatible endpoint.
# -------------------------------------------------------------------
_client_r1 = None
_client_r2 = None


def _get_client_r1():
    global _client_r1
    if _client_r1 is None:
        from openai import AsyncOpenAI
        api_key = os.getenv("CLOUDFLARE_R1_API_TOKEN")
        account_id = os.getenv("CLOUDFLARE_R1_ACCOUNT_ID")
        if not api_key or not account_id:
            return None
        _client_r1 = AsyncOpenAI(
            base_url=f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1",
            api_key=api_key,
            timeout=60.0
        )
    return _client_r1


def _get_client_r2():
    global _client_r2
    if _client_r2 is None:
        from openai import AsyncOpenAI
        api_key = os.getenv("CLOUDFLARE_R2_API_TOKEN")
        account_id = os.getenv("CLOUDFLARE_R2_ACCOUNT_ID")
        if not api_key or not account_id:
            return None
        _client_r2 = AsyncOpenAI(
            base_url=f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1",
            api_key=api_key,
            timeout=90.0
        )
    return _client_r2


def _extract_text(response) -> str | None:
    """Safely pull text from Cloudflare response. Returns None on any structural issue."""
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


async def _call_cloudflare_single(get_client_fn, model: str, prompt: str, max_tokens: int, retries: int = 0) -> dict:
    max_tokens = min(max_tokens, 4096)
    client = get_client_fn()
    if client is None:
        return {
            "success": False, "text": None, "model": None, "speed": None,
            "attempts": [{"model": model, "status": "skipped — Cloudflare API key/account not configured"}],
        }
    attempts = []
    for attempt in range(retries + 1):
        try:
            start = time.time()
            response = await client.chat.completions.create(
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
            if any(x in err for x in ["404", "model_not_found", "does not exist"]):
                break
            if any(x in err for x in ["401", "403", "invalid_api_key", "authentication", "Unauthorized"]):
                break
            if "context_length_exceeded" in err or "maximum context" in err.lower():
                break
            if any(x in err for x in ["503", "500", "502", "overloaded"]):
                if attempt < retries:
                    import asyncio
                    await asyncio.sleep(1)
                continue
            if "timeout" in err.lower() or "timed out" in err.lower():
                if attempt < retries:
                    import asyncio
                    await asyncio.sleep(1)
                continue
            break
    return {"success": False, "text": None, "model": None, "speed": None, "attempts": attempts}


async def call_single_cloudflare_r1(model: str, prompt: str, max_tokens: int = 2500) -> dict:
    """Call exactly one Cloudflare model using the R1 API key. R1 timeout=30s."""
    return await _call_cloudflare_single(_get_client_r1, model, prompt, max_tokens)


async def call_single_cloudflare_r2(model: str, prompt: str, max_tokens: int = 4500) -> dict:
    """Call exactly one Cloudflare model using the R2 API key. R2 timeout=90s."""
    return await _call_cloudflare_single(_get_client_r2, model, prompt, max_tokens)
