import os
import re
import time
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

# Request-1 chain (ATS scoring + project check — fast + accurate enough)
GROQ_R1_CHAIN = [
    "llama-3.3-70b-versatile",                       # ~4s
    "meta-llama/llama-4-scout-17b-16e-instruct",     # ~4s
    "llama-3.1-8b-instant",                          # ~10s
]

# Request-2 chain (resume generation — best quality first)
GROQ_R2_CHAIN = [
    "openai/gpt-oss-120b",                           # ~10–30s — best quality
    "llama-3.3-70b-versatile",                       # ~4s
    "meta-llama/llama-4-scout-17b-16e-instruct",     # ~4s
    "openai/gpt-oss-20b",                            # ~40–50s
    "qwen/qwen3-32b",                                # ~20–40s
    "llama-3.1-8b-instant",                          # ~10s — last resort
]

client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def _call_groq_chain(prompt: str, chain: list, retries: int = 1) -> dict:
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
                if "429" in err:
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


def call_groq_r1(prompt: str) -> dict:
    """Groq leg for Request-1 (ATS / project analysis)."""
    return _call_groq_chain(prompt, GROQ_R1_CHAIN)


def call_groq_r2(prompt: str) -> dict:
    """Groq leg for Request-2 (resume generation)."""
    return _call_groq_chain(prompt, GROQ_R2_CHAIN)
