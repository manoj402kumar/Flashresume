import os
import re
import time
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

DEEPSEEK_FALLBACK_CHAIN = [
    "deepseek-ai/deepseek-r1-distill-qwen-32b",  # Confirmed PASS (4.62s)
    "deepseek-ai/deepseek-r1-distill-qwen-14b",  # 500 error - may recover
    "deepseek-ai/deepseek-r1-distill-llama-8b",  # Smallest - fastest
]

client = OpenAI(
    api_key=os.getenv("NVIDIA_API_KEY"),
    base_url="https://integrate.api.nvidia.com/v1"
)

def _clean_response(text: str) -> str:
    """Strip thinking blocks and markdown, extract clean JSON."""
    # Remove <think>...</think> blocks
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    # Remove markdown code blocks
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    # Extract JSON if buried in explanation text
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        text = match.group(0)
    return text.strip()

def call_deepseek(prompt: str, retries: int = 1) -> dict:
    """
    Tries each DeepSeek model via NVIDIA NIM in order.
    Returns dict: { success, text, model, speed, attempts }
    """
    attempts = []

    for model in DEEPSEEK_FALLBACK_CHAIN:
        for attempt in range(retries + 1):
            try:
                start = time.time()
                response = client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                    max_tokens=4096
                )
                elapsed = round(time.time() - start, 2)
                text = _clean_response(response.choices[0].message.content)

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
                elif "500" in err or "503" in err:
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
    TEST_PROMPT = """Return ONLY this JSON, no thinking, no explanation:
{
  "ats_score": 85,
  "matched_skills": ["Python", "FastAPI", "PostgreSQL"],
  "missing_skills": ["Docker"],
  "verdict": "Good Match"
}"""

    print("Testing DeepSeek fallback chain via NVIDIA NIM...")
    print(f"Chain: {' -> '.join([m.split('/')[-1] for m in DEEPSEEK_FALLBACK_CHAIN])}\n")

    result = call_deepseek(TEST_PROMPT)

    if result["success"]:
        print(f"[PASS] Served by : {result['model']}")
        print(f"       Speed     : {result['speed']}s")
        print(f"       Response  :\n{result['text']}")
    else:
        print("[FAIL] All DeepSeek models exhausted")
        print(f"       Attempts  : {result['attempts']}")
