import os
import re
import time
from cerebras.cloud.sdk import Cerebras
from dotenv import load_dotenv

load_dotenv()

CEREBRAS_FALLBACK_CHAIN = [
    "llama-3.3-70b",
    "qwen-3-32b",
    "llama3.1-8b",
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


def call_cerebras(prompt: str) -> dict:
    return _call_cerebras_chain(prompt, CEREBRAS_FALLBACK_CHAIN)


def call_cerebras_with_model(prompt: str, preferred_model_id: str) -> dict:
    remaining = [m for m in CEREBRAS_FALLBACK_CHAIN if m != preferred_model_id]
    return _call_cerebras_chain(prompt, [preferred_model_id] + remaining)


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
    print("Testing Cerebras fallback chain...")
    print(f"Chain: {' -> '.join(CEREBRAS_FALLBACK_CHAIN)}\n")

    result = call_cerebras(TEST_PROMPT)

    if result["success"]:
        print(f"[PASS] Served by : {result['model']}")
        print(f"       Speed     : {result['speed']}s")
        print(f"       Response  :\n{result['text']}")
    else:
        print("[FAIL] All Cerebras models exhausted")
        print(f"       Attempts  : {result['attempts']}")
