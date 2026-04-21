import os
import re
import time
from mistralai.client import Mistral
from dotenv import load_dotenv

load_dotenv()

MISTRAL_FALLBACK_CHAIN = [
    "mistral-large-latest",
    "mistral-medium-latest",
    "mistral-small-latest",
    "ministral-8b-latest",
    "open-mistral-nemo",
    "mistral-tiny-latest",
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


def call_mistral(prompt: str) -> dict:
    return _call_mistral_chain(prompt, MISTRAL_FALLBACK_CHAIN)


def call_mistral_with_model(prompt: str, preferred_model_id: str) -> dict:
    remaining = [m for m in MISTRAL_FALLBACK_CHAIN if m != preferred_model_id]
    return _call_mistral_chain(prompt, [preferred_model_id] + remaining)



