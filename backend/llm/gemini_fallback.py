import os
import re
import time
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

# Request-1 chain (ATS scoring + project check — quality anchor for analysis)
GEMINI_R1_CHAIN = [
    "gemma-3-27b-it",                 # ~10s — quality anchor
    "gemini-2.5-flash-lite",          # ~20s
    "gemini-3.1-flash-lite-preview",  # ~40s — last resort
]

# Request-2 chain (resume generation — lite models as deep fallback only)
GEMINI_R2_CHAIN = [
    "gemini-2.5-flash-lite",          # ~20s
    "gemini-3.1-flash-lite-preview",  # ~40s
    "gemma-3-27b-it",                 # ~10s
]

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


def _call_gemini_chain(prompt: str, chain: list, retries: int = 1) -> dict:
    attempts = []
    for model in chain:
        for attempt in range(retries + 1):
            try:
                start = time.time()
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(temperature=0.1),
                )
                elapsed = round(time.time() - start, 2)
                text = response.text.strip()
                text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()
                if text.startswith("```"):
                    text = text.split("```")[1]
                    if text.startswith("json"):
                        text = text[4:]
                    text = text.strip()
                match = re.search(r'\{.*\}', text, re.DOTALL)
                if match:
                    text = match.group(0)
                return {
                    "success": True, "text": text, "model": model,
                    "speed": elapsed, "attempts": attempts + [{"model": model, "status": "pass"}]
                }
            except Exception as e:
                err = str(e)
                attempts.append({"model": model, "status": err[:60]})
                if "429" in err or "404" in err:
                    break
                elif "503" in err or "500" in err:
                    if attempt < retries:
                        time.sleep(3)
                    continue
                else:
                    break
    return {"success": False, "text": None, "model": None, "speed": None, "attempts": attempts}


def call_gemini_r1(prompt: str) -> dict:
    """Gemini leg for Request-1 (ATS / project analysis)."""
    return _call_gemini_chain(prompt, GEMINI_R1_CHAIN)


def call_gemini_r2(prompt: str) -> dict:
    """Gemini leg for Request-2 (resume generation)."""
    return _call_gemini_chain(prompt, GEMINI_R2_CHAIN)


def call_single_gemini(model: str, prompt: str) -> dict:
    """Call exactly one Gemini model. Used by master flat chain."""
    attempts = []
    retries = 1
    for attempt in range(retries + 1):
        try:
            start = time.time()
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(temperature=0.1),
            )
            elapsed = round(time.time() - start, 2)
            text = response.text.strip()
            text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
                text = text.strip()
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if match:
                text = match.group(0)
            return {
                "success": True, "text": text, "model": model,
                "speed": elapsed, "attempts": attempts + [{"model": model, "status": "pass"}]
            }
        except Exception as e:
            err = str(e)
            attempts.append({"model": model, "status": err[:60]})
            if "429" in err or "404" in err:
                break
            elif "503" in err or "500" in err:
                if attempt < retries:
                    time.sleep(3)
                continue
            else:
                break
    return {"success": False, "text": None, "model": None, "speed": None, "attempts": attempts}
