import os
import re
import time
from cerebras.cloud.sdk import Cerebras
from dotenv import load_dotenv

load_dotenv()

# Same models for both R1 and R2 — Qwen 235B is elite quality + fast
CEREBRAS_R1_CHAIN = [
    "qwen-3-235b-a22b-instruct-2507",  # ~4–5s — elite + fast
    "llama3.1-8b",                     # ~20s  — fallback
]

CEREBRAS_R2_CHAIN = [
    "qwen-3-235b-a22b-instruct-2507",  # ~4–5s — elite quality
    "llama3.1-8b",                     # ~20s  — fallback
]

client = Cerebras(api_key=os.getenv("CEREBRAS_API_KEY"))


def _call_cerebras_chain(prompt: str, chain: list, retries: int = 1) -> dict:
    attempts = []
    for model in chain:
        for attempt in range(retries + 1):
            try:
                start = time.time()
                response = client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.1,
                    max_tokens=4096,
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
                    "success": True,
                    "text": text,
                    "model": model,
                    "speed": elapsed,
                    "attempts": attempts + [{"model": model, "status": "pass"}]
                }
            except Exception as e:
                err = str(e)
                attempts.append({"model": model, "status": err[:60]})
                if "429" in err or "rate_limit" in err.lower():
                    break
                elif "404" in err or "model_not_found" in err.lower():
                    break
                elif "503" in err or "500" in err:
                    if attempt < retries:
                        time.sleep(2)
                    continue
                else:
                    break
    return {"success": False, "text": None, "model": None, "speed": None, "attempts": attempts}


def call_cerebras_r1(prompt: str) -> dict:
    """Cerebras leg for Request-1 (ATS / project analysis)."""
    return _call_cerebras_chain(prompt, CEREBRAS_R1_CHAIN)


def call_cerebras_r2(prompt: str) -> dict:
    """Cerebras leg for Request-2 (resume generation)."""
    return _call_cerebras_chain(prompt, CEREBRAS_R2_CHAIN)


def call_single_cerebras(model: str, prompt: str) -> dict:
    """Call exactly one Cerebras model. Used by master flat chain."""
    attempts = []
    retries = 1
    for attempt in range(retries + 1):
        try:
            start = time.time()
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=4096,
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
            if "429" in err or "rate_limit" in err.lower():
                break
            elif "404" in err or "model_not_found" in err.lower():
                break
            elif "503" in err or "500" in err:
                if attempt < retries:
                    time.sleep(2)
                continue
            else:
                break
    return {"success": False, "text": None, "model": None, "speed": None, "attempts": attempts}
