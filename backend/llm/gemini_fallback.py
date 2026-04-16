import os
import re
import time
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

FALLBACK_CHAIN = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite-preview-06-17",
    "gemma-3-27b-it",
]

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


def call_gemini(prompt: str, retries: int = 1) -> dict:
    attempts = []

    for model in FALLBACK_CHAIN:
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

    print("Testing fallback chain...")
    print(f"Chain: {' -> '.join(FALLBACK_CHAIN)}\n")

    result = call_gemini(TEST_PROMPT)

    if result["success"]:
        print(f"[PASS] Served by : {result['model']}")
        print(f"       Speed     : {result['speed']}s")
        print(f"       Response  :\n{result['text']}")
    else:
        print("[FAIL] All models exhausted")
        print(f"       Attempts  : {result['attempts']}")
