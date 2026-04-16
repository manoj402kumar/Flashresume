import re
import json
from dotenv import load_dotenv

load_dotenv()

ATS_PROMPT = """
You are an ATS resume analyzer. Return ONLY valid JSON, no explanation.

RESUME: Python developer, 3 years experience. Built REST APIs using FastAPI, PostgreSQL, Docker. Led team of 4.
JOB DESCRIPTION: Senior backend developer with Python, FastAPI, Docker, PostgreSQL, team leadership.

{
  "ats_score": 0,
  "matched_skills": [],
  "missing_skills": [],
  "verdict": ""
}
"""

GENERATE_PROMPT = """
You are a professional resume writer. Return ONLY valid JSON, no explanation.

Rewrite this bullet point to be stronger and ATS-optimized:
Original: "worked on backend APIs"

{
  "original": "worked on backend APIs",
  "rewritten": "",
  "improvement_reason": ""
}
"""

PROJECT_PROMPT = """
You are a resume project advisor. Return ONLY valid JSON, no explanation.

Suggest 1 project for a Python developer applying for a backend role.

{
  "project_name": "",
  "tech_stack": [],
  "description": "",
  "impact": ""
}
"""

PROMPTS = {
    "ATS Analysis":       ATS_PROMPT,
    "Resume Generation":  GENERATE_PROMPT,
    "Project Suggestion": PROJECT_PROMPT,
}


def is_valid_json(text: str) -> bool:
    try:
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            json.loads(match.group(0))
            return True
        return False
    except Exception:
        return False


def score_response(text: str, elapsed: float) -> dict:
    valid = is_valid_json(text)
    length = len(text.strip())

    if elapsed < 2:
        speed_score = 10
    elif elapsed < 4:
        speed_score = 7
    elif elapsed < 8:
        speed_score = 4
    else:
        speed_score = 1

    json_score = 10 if valid else 0
    content_score = min(10, length // 20)
    total = speed_score + json_score + content_score

    return {
        "valid_json":    valid,
        "speed_s":       elapsed,
        "speed_score":   speed_score,
        "json_score":    json_score,
        "content_score": content_score,
        "total_score":   total,
    }


def test_gemini(prompt: str) -> dict:
    from llm.gemini_fallback import call_gemini
    result = call_gemini(prompt)
    if result["success"]:
        return {"success": True, "model": result["model"], "speed": result["speed"], "text": result["text"]}
    return {"success": False, "model": None, "speed": 0, "text": ""}


def test_mistral(prompt: str) -> dict:
    from llm.mistral_fallback import call_mistral
    result = call_mistral(prompt)
    if result["success"]:
        return {"success": True, "model": result["model"], "speed": result["speed"], "text": result["text"]}
    return {"success": False, "model": None, "speed": 0, "text": ""}


def run_benchmark():
    print("\n" + "="*60)
    print("   FlashResume — LLM Benchmark Tool")
    print("   Testing: Gemini vs Mistral")
    print("="*60)

    results = {
        "gemini":  {"total": 0, "wins": 0},
        "mistral": {"total": 0, "wins": 0},
    }

    for task_name, prompt in PROMPTS.items():
        print(f"\n Task: {task_name}")
        print("-" * 40)

        g = test_gemini(prompt)
        g_score = score_response(g["text"], g["speed"]) if g["success"] else {"total_score": 0, "speed_s": 0, "valid_json": False}
        print(f"  Gemini  -> model: {str(g['model'] or 'FAILED'):<35} | speed: {g_score['speed_s']}s | JSON: {'OK' if g_score['valid_json'] else 'FAIL'} | score: {g_score['total_score']}/30")

        m = test_mistral(prompt)
        m_score = score_response(m["text"], m["speed"]) if m["success"] else {"total_score": 0, "speed_s": 0, "valid_json": False}
        print(f"  Mistral -> model: {str(m['model'] or 'FAILED'):<35} | speed: {m_score['speed_s']}s | JSON: {'OK' if m_score['valid_json'] else 'FAIL'} | score: {m_score['total_score']}/30")

        if g_score["total_score"] >= m_score["total_score"]:
            winner = "gemini"
            print("  Winner: Gemini")
        else:
            winner = "mistral"
            print("  Winner: Mistral")

        results["gemini"]["total"]  += g_score["total_score"]
        results["mistral"]["total"] += m_score["total_score"]
        results[winner]["wins"] += 1

    print("\n" + "="*60)
    print("   FINAL RESULTS")
    print("="*60)
    print(f"  Gemini  -> Total: {results['gemini']['total']:>3}/90  | Task Wins: {results['gemini']['wins']}/3")
    print(f"  Mistral -> Total: {results['mistral']['total']:>3}/90  | Task Wins: {results['mistral']['wins']}/3")

    overall_winner = "gemini" if results["gemini"]["total"] >= results["mistral"]["total"] else "mistral"

    print(f"\n  Overall Winner: {overall_winner.upper()}")
    print(f"  Recommendation: Set PREFERRED_LLM={overall_winner} in your .env")
    print("="*60 + "\n")

    return overall_winner


if __name__ == "__main__":
    run_benchmark()
