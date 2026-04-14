import os
import re
import time
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# Fallback Chain (confirmed + tested)
FALLBACK_CHAIN = [
    "gemini-2.5-flash-lite",   # Fallback 1
    "gemini-2.5-flash",        # Fallback 2
    "gemma-3-27b-it",          # Gemma 3 27B - no thinking mode
]

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

def call_gemini(prompt: str, retries: int = 1) -> dict:
    """
    Tries each model in FALLBACK_CHAIN in order.
    Returns dict: { success, text, model, speed, attempts }
    """
    attempts = []

    for model in FALLBACK_CHAIN:
        for attempt in range(retries + 1):
            try:
                start = time.time()
                model_instance = genai.GenerativeModel(model)
                response = model_instance.generate_content(
                    prompt,
                    generation_config=genai.GenerationConfig(
                        temperature=0.1,
                    ),
                    request_options={"timeout": 120}
                )
                elapsed = round(time.time() - start, 2)

                # Strip markdown code blocks and extract JSON
                text = response.text.strip()
                # Remove <think>...</think> blocks
                text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()
                # Remove markdown code blocks
                if text.startswith("```"):
                    text = text.split("```")[1]
                    if text.startswith("json"):
                        text = text[4:]
                    text = text.strip()
                # Extract JSON if buried in explanation text
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
                    break  # rate limited or not found - skip to next model
                elif "503" in err or "500" in err:
                    if attempt < retries:
                        time.sleep(3)
                    continue  # server error - retry same model
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
