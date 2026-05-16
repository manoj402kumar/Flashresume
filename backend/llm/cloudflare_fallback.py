import os
import re
import time
import httpx
from dotenv import load_dotenv

load_dotenv()

# -------------------------------------------------------------------
# Dual-credential architecture (ASYNC):
#   R1 uses  CLOUDFLARE_R1_ACCOUNT_ID + CLOUDFLARE_R1_API_TOKEN  timeout=30s
#   R2 uses  CLOUDFLARE_R2_ACCOUNT_ID + CLOUDFLARE_R2_API_TOKEN  timeout=90s
#
# Replaced requests.post with httpx.AsyncClient for non-blocking calls.
# Active Cloudflare model in the 16-model chain:
#   Rank 11: @cf/meta/llama-3.1-8b-instruct
# -------------------------------------------------------------------
_CF_R1_ACCOUNT_ID = os.getenv("CLOUDFLARE_R1_ACCOUNT_ID")
_CF_R1_API_TOKEN  = os.getenv("CLOUDFLARE_R1_API_TOKEN")

_CF_R2_ACCOUNT_ID = os.getenv("CLOUDFLARE_R2_ACCOUNT_ID")
_CF_R2_API_TOKEN  = os.getenv("CLOUDFLARE_R2_API_TOKEN")

# R1 timeout (seconds) and R2 timeout (seconds)
_CF_R1_TIMEOUT = 30
_CF_R2_TIMEOUT = 90


def _extract_text(data: dict) -> str | None:
    """
    Safely pull text from Cloudflare response JSON.
    Cloudflare returns: {"result": {"response": "..."}, "success": true}
    """
    try:
        if not data.get("success", False):
            return None
        text = data.get("result", {}).get("response", "")
        if not text or not text.strip():
            return None
        text = text.strip()
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
    except (AttributeError, KeyError, TypeError):
        return None


async def _call_cloudflare_single(account_id: str, api_token: str, model: str, prompt: str, max_tokens: int, timeout_secs: int, retries: int = 1) -> dict:
    attempts = []
    for attempt in range(retries + 1):
        try:
            start = time.time()
            url = (
                f"https://api.cloudflare.com/client/v4/accounts/"
                f"{account_id}/ai/run/{model}"
            )
            headers = {
                "Authorization": f"Bearer {api_token}",
                "Content-Type": "application/json",
            }
            payload = {
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "max_tokens": max_tokens,
            }
            async with httpx.AsyncClient(timeout=timeout_secs) as client:
                response = await client.post(url, headers=headers, json=payload)
            elapsed = round(time.time() - start, 2)

            if response.status_code == 429:
                attempts.append({"model": model, "status": "429 rate limited"})
                break
            if response.status_code == 404:
                attempts.append({"model": model, "status": "404 model not found"})
                break
            if response.status_code in (401, 403):
                attempts.append({"model": model, "status": f"{response.status_code} auth error"})
                break
            if response.status_code in (500, 502, 503):
                attempts.append({"model": model, "status": f"{response.status_code} server error"})
                if attempt < retries:
                    import asyncio
                    await asyncio.sleep(1)
                continue

            response.raise_for_status()
            data = response.json()
            text = _extract_text(data)
            if text is None:
                attempts.append({"model": model, "status": "empty_or_null_response"})
                break
            return {
                "success": True, "text": text, "model": model,
                "speed": elapsed, "attempts": attempts + [{"model": model, "status": "pass"}],
            }

        except httpx.TimeoutException:
            attempts.append({"model": model, "status": f"timeout_{timeout_secs}s"})
            if attempt < retries:
                import asyncio
                await asyncio.sleep(1)
            continue
        except httpx.ConnectError as e:
            attempts.append({"model": model, "status": f"connection_error:{str(e)[:40]}"})
            if attempt < retries:
                import asyncio
                await asyncio.sleep(1)
            continue
        except Exception as e:
            attempts.append({"model": model, "status": str(e)[:80]})
            if attempt < retries:
                import asyncio
                await asyncio.sleep(1)
            else:
                break

    return {"success": False, "text": None, "model": None, "speed": None, "attempts": attempts}


async def call_single_cloudflare_r1(model: str, prompt: str, max_tokens: int = 2500) -> dict:
    """Call exactly one Cloudflare model using R1 credentials (Account 1). R1 timeout=30s."""
    return await _call_cloudflare_single(
        _CF_R1_ACCOUNT_ID, _CF_R1_API_TOKEN, model, prompt, max_tokens, _CF_R1_TIMEOUT
    )


async def call_single_cloudflare_r2(model: str, prompt: str, max_tokens: int = 4500) -> dict:
    """Call exactly one Cloudflare model using R2 credentials (Account 2). R2 timeout=90s."""
    return await _call_cloudflare_single(
        _CF_R2_ACCOUNT_ID, _CF_R2_API_TOKEN, model, prompt, max_tokens, _CF_R2_TIMEOUT
    )
