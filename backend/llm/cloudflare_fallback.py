import os
import re
import time
import requests
from dotenv import load_dotenv

load_dotenv()

CLOUDFLARE_ACCOUNT_ID = os.getenv("CLOUDFLARE_ACCOUNT_ID")
CLOUDFLARE_API_TOKEN  = os.getenv("CLOUDFLARE_API_TOKEN")

# Cloudflare is the absolute last-resort provider — same chain for R1 and R2
CLOUDFLARE_CHAIN = [
    "@cf/meta/llama-3.1-8b-instruct",        # ~5s
    "@cf/mistral/mistral-7b-instruct-v0.1",  # ~15s
]


def _call_cloudflare_chain(prompt: str, chain: list, retries: int = 1) -> dict:
    attempts = []
    for model in chain:
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
                    "max_tokens": 4096,
                }
                response = requests.post(url, headers=headers, json=payload, timeout=60)
                elapsed = round(time.time() - start, 2)

                if response.status_code == 429:
                    attempts.append({"model": model, "status": "429 rate limited"})
                    break
                if response.status_code == 404:
                    attempts.append({"model": model, "status": "404 model not found"})
                    break
                if response.status_code in (500, 503):
                    attempts.append({"model": model, "status": f"{response.status_code} server error"})
                    if attempt < retries:
                        time.sleep(3)
                    continue

                response.raise_for_status()
                data = response.json()
                text = data.get("result", {}).get("response", "").strip()

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
                    "text":    text,
                    "model":   model,
                    "speed":   elapsed,
                    "attempts": attempts + [{"model": model, "status": "pass"}],
                }

            except Exception as e:
                err = str(e)
                attempts.append({"model": model, "status": err[:60]})
                if attempt < retries:
                    time.sleep(2)
                else:
                    break

    return {"success": False, "text": None, "model": None, "speed": None, "attempts": attempts}


def call_cloudflare_r1(prompt: str) -> dict:
    """Cloudflare leg for Request-1 (ATS / project analysis)."""
    return _call_cloudflare_chain(prompt, CLOUDFLARE_CHAIN)


def call_cloudflare_r2(prompt: str) -> dict:
    """Cloudflare leg for Request-2 (resume generation)."""
    return _call_cloudflare_chain(prompt, CLOUDFLARE_CHAIN)
