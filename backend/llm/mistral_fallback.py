import os
import re
import time
from mistralai.client import Mistral
from dotenv import load_dotenv

load_dotenv()

# Request-1 chain (ATS scoring + project check — fast, good enough accuracy)
MISTRAL_R1_CHAIN = [
    "open-mistral-nemo",      # ~4s — fastest, moved up
    "ministral-8b-latest",    # ~5s
    "mistral-tiny-latest",    # ~5s
]

# Request-2 chain (resume generation — quality matters most)
MISTRAL_R2_CHAIN = [
    "mistral-large-latest",   # ~6s — best quality
    "mistral-medium-latest",  # ~7s
    "mistral-small-latest",   # ~5s
    "open-mistral-nemo",      # ~4s
    "ministral-8b-latest",    # ~5s
    "mistral-tiny-latest",    # ~5s — last resort
]

client = Mistral(api_key=os.getenv("MISTRAL_API_KEY"))


def _call_mistral_chain(prompt: str, chain: list, retries: int = 1) -> dict:
    attempts = []
    for model in chain:
        for attempt in range(retries + 1):
            try:
                start = time.time()
                response = client.chat.complete(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.1,
                )
                elapsed = round(time.time() - start, 2)
                text = response.choices[0].message.content.strip()
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


def call_mistral_r1(prompt: str) -> dict:
    """Mistral leg for Request-1 (ATS / project analysis)."""
    return _call_mistral_chain(prompt, MISTRAL_R1_CHAIN)


def call_mistral_r2(prompt: str) -> dict:
    """Mistral leg for Request-2 (resume generation)."""
    return _call_mistral_chain(prompt, MISTRAL_R2_CHAIN)


def call_single_mistral(model: str, prompt: str) -> dict:
    """Call exactly one Mistral model. Used by master flat chain."""
    attempts = []
    retries = 1
    for attempt in range(retries + 1):
        try:
            start = time.time()
            response = client.chat.complete(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
            )
            elapsed = round(time.time() - start, 2)
            text = response.choices[0].message.content.strip()
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
