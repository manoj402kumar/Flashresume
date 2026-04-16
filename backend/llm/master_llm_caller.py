import os
import json
from dotenv import load_dotenv
from .gemini_fallback import call_gemini
from .mistral_fallback import call_mistral

load_dotenv()

ENV_PREFERRED = os.getenv("PREFERRED_LLM", "gemini").lower()


def call_llm(prompt: str, preferred_model: str = None) -> dict:
    """
    Master LLM caller.
    Order is determined by:
      1. preferred_model arg (per-request override from frontend)
      2. PREFERRED_LLM env var (global default)
    """
    all_attempts = []
    active_pref = (preferred_model or ENV_PREFERRED).lower()

    chain = (
        [("mistral", call_mistral), ("gemini", call_gemini)]
        if active_pref == "mistral"
        else [("gemini", call_gemini), ("mistral", call_mistral)]
    )

    for provider_name, caller in chain:
        result = caller(prompt)
        all_attempts.extend(result.get("attempts", []))
        if result["success"]:
            return {
                "success":      True,
                "text":         result["text"],
                "model":        result["model"],
                "provider":     provider_name,
                "speed":        result["speed"],
                "all_attempts": all_attempts,
            }

    return {
        "success":      False,
        "text":         None,
        "model":        None,
        "provider":     None,
        "speed":        None,
        "all_attempts": all_attempts,
    }


if __name__ == "__main__":
    TEST_PROMPT = """
You are an ATS resume analyzer.
Return ONLY valid JSON with no extra text.

RESUME: Python developer, 2 years experience, built REST APIs using FastAPI and PostgreSQL.
JOB DESCRIPTION: Looking for a backend developer with Python, FastAPI, and database experience.

{
  "ats_score": 85,
  "matched_skills": ["Python", "FastAPI", "PostgreSQL"],
  "missing_skills": ["Docker"],
  "verdict": "Good Match"
}
"""
    chain_order = "mistral -> gemini" if PREFERRED_LLM == "mistral" else "gemini -> mistral"
    print(f"Active preference: PREFERRED_LLM={PREFERRED_LLM.upper()}")
    print(f"Chain: {chain_order}\n")

    result = call_llm(TEST_PROMPT)
    if result["success"]:
        print(f"[PASS] Provider : {result['provider']}")
        print(f"       Model    : {result['model']}")
        print(f"       Speed    : {result['speed']}s")
        print(f"       Response :\n{result['text']}")
    else:
        print("[FAIL] All providers exhausted")
        print(f"       Attempts : {json.dumps(result['all_attempts'], indent=2)}")
