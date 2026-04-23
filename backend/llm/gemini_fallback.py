import os
import re
import time
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

GEMINI_R1_CHAIN = [
    "gemma-3-27b-it",                 # ~10s — quality anchor
    "gemini-2.5-flash-lite",          # ~20s
    "gemini-3.1-flash-lite-preview",  # ~40s — last resort (preview model, may change)
]

GEMINI_R2_CHAIN = [
    "gemini-2.5-flash-lite",          # ~20s
    "gemini-3.1-flash-lite-preview",  # ~40s — preview model
    "gemma-3-27b-it",                 # ~10s
]

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


def _extract_text(response) -> str | None:
    """
    Safely pull text from Gemini response.
    Handles: None response, SAFETY/RECITATION finish_reason, empty text, pure <think> output.
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


def _call_gemini_single(model: str, prompt: str, max_tokens: int, retries: int = 1) -> dict:
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


def _call_gemini_chain(prompt: str, chain: list, max_tokens: int) -> dict:
    attempts = []
    for model in chain:
        result = _call_gemini_single(model, prompt, max_tokens)
        attempts.extend(result.get("attempts", []))
        if result["success"]:
            result["attempts"] = attempts
            return result
    return {"success": False, "text": None, "model": None, "speed": None, "attempts": attempts}


def call_gemini_r1(prompt: str) -> dict:
    """Gemini chain for Request-1 — ATS scoring + project analysis."""
    return _call_gemini_chain(prompt, GEMINI_R1_CHAIN, max_tokens=800)


def call_gemini_r2(prompt: str) -> dict:
    """Gemini chain for Request-2 — resume generation."""
    return _call_gemini_chain(prompt, GEMINI_R2_CHAIN, max_tokens=3500)


def call_single_gemini(model: str, prompt: str, max_tokens: int = 3500) -> dict:
    """Call exactly one Gemini model. Used by master flat chain."""
    return _call_gemini_single(model, prompt, max_tokens)
