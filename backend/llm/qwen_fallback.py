import os
import time
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

QWEN_FALLBACK_CHAIN = [
    "qwen/qwen3.6-plus:free",                 # Confirmed PASS (28.3s)
    "qwen/qwen3-next-80b-a3b-instruct:free",  # Exists - rate limited only
    "qwen/qwen3-coder:free",                  # Exists - rate limited only
]

client = OpenAI(
    api_key=os.getenv("OPENROUTER_API_KEY"),
    base_url="https://openrouter.ai/api/v1"
)

def call_qwen(prompt: str, retries: int = 1) -> dict:
    """
    Tries each Qwen model via OpenRouter in order.
    Returns dict: { success, text, model, speed, attempts }
    """
    attempts = []

    for model in QWEN_FALLBACK_CHAIN:
        for attempt in range(retries + 1):
            try:
                start = time.time()
                response = client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                    extra_headers={
                        "HTTP-Referer": "https://resumeiq.dev",
                        "X-Title": "ResumeIQ"
                    }
                )
                elapsed = round(time.time() - start, 2)

                text = response.choices[0].message.content.strip()
                if text.startswith("```"):
                    text = text.split("```")[1]
                    if text.startswith("json"):
                        text = text[4:]
                    text = text.strip()

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

    return {
        "success": False,
        "text": None,
        "model": None,
        "speed": None,
        "attempts": attempts
    }


if __name__ == "__main__":
    TEST_PROMPT = """
    Return ONLY valid JSON, no explanation:
    {
      "ats_score": 85,
      "matched_skills": ["Python", "FastAPI", "PostgreSQL"],
      "missing_skills": ["Docker"],
      "verdict": "Good Match"
    }
    """

    print("Testing Qwen fallback chain via OpenRouter...")
    print(f"Chain: {' -> '.join(QWEN_FALLBACK_CHAIN)}\n")

    result = call_qwen(TEST_PROMPT)

    if result["success"]:
        print(f"[PASS] Served by : {result['model']}")
        print(f"       Speed     : {result['speed']}s")
        print(f"       Response  :\n{result['text']}")
    else:
        print("[FAIL] All Qwen models exhausted")
        print(f"       Attempts  : {result['attempts']}")
