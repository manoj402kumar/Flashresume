import os
import json
from dotenv import load_dotenv
from .gemini_fallback import call_gemini, call_gemini_with_model
from .mistral_fallback import call_mistral, call_mistral_with_model
from .groq_fallback import call_groq, call_groq_with_model

load_dotenv()

ENV_PREFERRED = os.getenv("PREFERRED_LLM", "gemini").lower()


def call_llm(prompt: str, preferred_model: str = None) -> dict:
    """
    Master LLM caller.
    preferred_model can be:
      - a provider name: "gemini" or "mistral"
      - a specific model ID: "mistral-large-latest", "gemini-2.5-flash", etc.
    """
    all_attempts = []
    active_pref = (preferred_model or ENV_PREFERRED).lower()

    MISTRAL_PREFIXES = ("mistral-", "open-mistral-", "ministral-", "codestral-", "pixtral-")
    GEMINI_PREFIXES  = ("gemini-", "gemma-")
    GROQ_PREFIXES    = ("llama-", "llama3-", "llama3.", "mixtral-", "qwen-", "gemma2-", "deepseek-", "llama-4")

    if any(active_pref.startswith(p) for p in MISTRAL_PREFIXES):
        chain = [
            ("mistral", lambda p: call_mistral_with_model(p, active_pref)),
            ("gemini",  call_gemini),
            ("groq",    call_groq),
        ]
    elif any(active_pref.startswith(p) for p in GEMINI_PREFIXES):
        chain = [
            ("gemini",  lambda p: call_gemini_with_model(p, active_pref)),
            ("mistral", call_mistral),
            ("groq",    call_groq),
        ]
    elif any(active_pref.startswith(p) for p in GROQ_PREFIXES):
        chain = [
            ("groq",    lambda p: call_groq_with_model(p, active_pref)),
            ("mistral", call_mistral),
            ("gemini",  call_gemini),
        ]
    elif active_pref == "mistral":
        chain = [("mistral", call_mistral), ("gemini", call_gemini), ("groq", call_groq)]
    else:
        chain = [("gemini", call_gemini), ("mistral", call_mistral), ("groq", call_groq)]

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
    chain_order = "mistral -> gemini" if ENV_PREFERRED == "mistral" else "gemini -> mistral"
    print(f"Active preference: PREFERRED_LLM={ENV_PREFERRED.upper()}")
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
