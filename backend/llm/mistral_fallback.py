import os
import re
import time
from mistralai.client import Mistral
from dotenv import load_dotenv

load_dotenv()

MISTRAL_R1_CHAIN = [
    "mistral-large-latest",   # ~6s — best quality
    "mistral-medium-latest",
    "open-mistral-nemo",      # ~4s — fastest fallback
]

MISTRAL_R2_CHAIN = [
    "mistral-large-latest",   # ~6s — best quality
    "mistral-medium-latest",  # ~7s
    "mistral-small-latest",   # ~5s
    "open-mistral-nemo",      # ~4s
    "ministral-8b-latest",    # ~5s
    "mistral-tiny-latest",    # ~5s — last resort
]

client = Mistral(api_key=os.getenv("MISTRAL_API_KEY"))


def _extract_text(response) -> str | None:
    """Safely pull text from Mistral response. Returns None on any structural issue."""
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


def _call_mistral_single(model: str, prompt: str, max_tokens: int, retries: int = 1) -> dict:
    attempts = []
    for attempt in range(retries + 1):
        try:
            start = time.time()
            response = client.chat.complete(
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
            err = str(e)
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
                    time.sleep(1)
                continue
            if "timeout" in err.lower() or "timed out" in err.lower() or "ReadTimeout" in err:
                if attempt < retries:
                    time.sleep(1)
                continue
            break
    return {"success": False, "text": None, "model": None, "speed": None, "attempts": attempts}


def _call_mistral_chain(prompt: str, chain: list, max_tokens: int) -> dict:
    attempts = []
    for model in chain:
        result = _call_mistral_single(model, prompt, max_tokens)
        attempts.extend(result.get("attempts", []))
        if result["success"]:
            result["attempts"] = attempts
            return result
    return {"success": False, "text": None, "model": None, "speed": None, "attempts": attempts}


def call_mistral_r1(prompt: str) -> dict:
    """Mistral chain for Request-1 — ATS scoring + project analysis."""
    return _call_mistral_chain(prompt, MISTRAL_R1_CHAIN, max_tokens=1500)


def call_mistral_r2(prompt: str) -> dict:
    """Mistral chain for Request-2 — resume generation."""
    return _call_mistral_chain(prompt, MISTRAL_R2_CHAIN, max_tokens=3500)


def call_single_mistral(model: str, prompt: str, max_tokens: int = 3500) -> dict:
    """Call exactly one Mistral model. Used by master flat chain."""
    return _call_mistral_single(model, prompt, max_tokens)
