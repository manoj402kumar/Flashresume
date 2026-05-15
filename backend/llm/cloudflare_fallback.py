import os
import re
import time
import requests
from dotenv import load_dotenv

load_dotenv()

CLOUDFLARE_ACCOUNT_ID = os.getenv("CLOUDFLARE_ACCOUNT_ID") or os.getenv("CLOUDFLARE_R1_ACCOUNT_ID") or os.getenv("CLOUDFLARE_R2_ACCOUNT_ID")
CLOUDFLARE_API_TOKEN  = os.getenv("CLOUDFLARE_API_TOKEN") or os.getenv("CLOUDFLARE_R1_API_TOKEN") or os.getenv("CLOUDFLARE_R2_API_TOKEN")

CLOUDFLARE_CHAIN = [
    "@cf/meta/llama-3.1-8b-instruct",        # ~5s
    "@cf/mistral/mistral-7b-instruct-v0.1",  # ~15s
]


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


def _call_cloudflare_single(model: str, prompt: str, max_tokens: int, retries: int = 1) -> dict:
    attempts = []
    for attempt in range(retries + 1):
        try:
            start = time.time()
            url = (
                f"https://api.cloudflare.com/client/v4/accounts/"
                f"{CLOUDFLARE_ACCOUNT_ID}/ai/run/{model}"
            )
            headers = {
                "Authorization": f"Bearer {CLOUDFLARE_API_TOKEN}",
                "Content-Type": "application/json",
            }
            payload = {
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "max_tokens": max_tokens,
            }
            response = requests.post(url, headers=headers, json=payload, timeout=60)
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
                    time.sleep(1)
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

        except requests.exceptions.Timeout:
            attempts.append({"model": model, "status": "timeout_60s"})
            if attempt < retries:
                time.sleep(1)
            continue
        except requests.exceptions.ConnectionError as e:
            attempts.append({"model": model, "status": f"connection_error:{str(e)[:40]}"})
            if attempt < retries:
                time.sleep(1)
            continue
        except Exception as e:
            attempts.append({"model": model, "status": str(e)[:80]})
            if attempt < retries:
                time.sleep(1)
            else:
                break

    return {"success": False, "text": None, "model": None, "speed": None, "attempts": attempts}


def _call_cloudflare_chain(prompt: str, chain: list, max_tokens: int) -> dict:
    attempts = []
    for model in chain:
        result = _call_cloudflare_single(model, prompt, max_tokens)
        attempts.extend(result.get("attempts", []))
        if result["success"]:
            result["attempts"] = attempts
            return result
    return {"success": False, "text": None, "model": None, "speed": None, "attempts": attempts}


def call_cloudflare_r1(prompt: str) -> dict:
    """Cloudflare chain for Request-1 — ATS scoring + project analysis."""
    return _call_cloudflare_chain(prompt, CLOUDFLARE_CHAIN, max_tokens=800)


def call_cloudflare_r2(prompt: str) -> dict:
    """Cloudflare chain for Request-2 — resume generation."""
    return _call_cloudflare_chain(prompt, CLOUDFLARE_CHAIN, max_tokens=3500)


def call_single_cloudflare(model: str, prompt: str, max_tokens: int = 3500) -> dict:
    """Call exactly one Cloudflare model. Used by master flat chain."""
    return _call_cloudflare_single(model, prompt, max_tokens)
