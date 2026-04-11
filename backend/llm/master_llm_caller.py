import json
from .gemini_fallback import call_gemini
from .qwen_fallback import call_qwen
from .deepseek_fallback import call_deepseek

def call_llm(prompt: str) -> dict:
    """
    Master LLM caller — chains Gemini -> Qwen -> DeepSeek (coming soon).
    Returns dict: { success, text, model, provider, speed, all_attempts }
    """
    all_attempts = []

    # Layer 1 — Gemini
    result = call_gemini(prompt)
    all_attempts.extend(result.get("attempts", []))
    if result["success"]:
        return {
            "success": True,
            "text": result["text"],
            "model": result["model"],
            "provider": "gemini",
            "speed": result["speed"],
            "all_attempts": all_attempts
        }

    # Layer 2 — Qwen via OpenRouter
    result = call_qwen(prompt)
    all_attempts.extend(result.get("attempts", []))
    if result["success"]:
        return {
            "success": True,
            "text": result["text"],
            "model": result["model"],
            "provider": "qwen",
            "speed": result["speed"],
            "all_attempts": all_attempts
        }

    # Layer 3 — DeepSeek via NVIDIA NIM
    result = call_deepseek(prompt)
    all_attempts.extend(result.get("attempts", []))
    if result["success"]:
        return {
            "success": True,
            "text": result["text"],
            "model": result["model"],
            "provider": "deepseek",
            "speed": result["speed"],
            "all_attempts": all_attempts
        }

    # All layers exhausted
    return {
        "success": False,
        "text": None,
        "model": None,
        "provider": None,
        "speed": None,
        "all_attempts": all_attempts
    }


if __name__ == "__main__":
    TEST_PROMPT = """
You are an ATS resume analyzer.
Return ONLY valid JSON with no extra text.

RESUME: Python developer, 2 years experience, built REST APIs using FastAPI and PostgreSQL.
JOB DESCRIPTION: Looking for a backend developer with Python, FastAPI, and database experience.

Return exactly this JSON format:
{
  "ats_score": 85,
  "matched_skills": ["Python", "FastAPI", "PostgreSQL"],
  "missing_skills": ["Docker"],
  "verdict": "Good Match"
}
"""

    print("Testing master LLM caller...")
    print("Chain: Gemini -> Qwen -> DeepSeek\n")

    result = call_llm(TEST_PROMPT)

    if result["success"]:
        print(f"[PASS] Provider  : {result['provider']}")
        print(f"       Model     : {result['model']}")
        print(f"       Speed     : {result['speed']}s")
        print(f"       Response  :\n{result['text']}")
    else:
        print("[FAIL] All providers exhausted")
        print(f"       Attempts  : {json.dumps(result['all_attempts'], indent=2)}")
