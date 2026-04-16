import os
import re
import time
from mistralai.client import Mistral
from dotenv import load_dotenv

load_dotenv()

MISTRAL_FALLBACK_CHAIN = [
    "mistral-large-latest",    # Primary - best quality, 0.83s
    "mistral-medium-latest",   # Fallback 1 - good balance, 0.62s
    "open-mistral-nemo",       # Fallback 2 - fast, 0.83s
]

client = Mistral(api_key=os.getenv("MISTRAL_API_KEY"))


def call_mistral(prompt: str, retries: int = 1) -> dict:
    attempts = []

    for model in MISTRAL_FALLBACK_CHAIN:
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
                    "success": True,
                    "text": text,
                    "model": model,
                    "speed": elapsed,
                    "attempts": attempts + [{"model": model, "status": "pass"}]
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


if __name__ == "__main__":
    TEST_PROMPT = """
You are an ATS resume analyzer.
Return ONLY valid JSON with no extra text:
{
  "ats_score": 85,
  "matched_skills": ["Python", "FastAPI"],
  "missing_skills": ["Docker"],
  "verdict": "Good Match"
}
"""
    print("Testing Mistral fallback chain...")
    print(f"Chain: {' -> '.join(MISTRAL_FALLBACK_CHAIN)}\n")

    result = call_mistral(TEST_PROMPT)

    if result["success"]:
        print(f"[PASS] Served by : {result['model']}")
        print(f"       Speed     : {result['speed']}s")
        print(f"       Response  :\n{result['text']}")
    else:
        print("[FAIL] All Mistral models exhausted")
        print(f"       Attempts  : {result['attempts']}")
