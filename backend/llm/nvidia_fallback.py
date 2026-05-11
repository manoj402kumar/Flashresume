import os
import re
import time
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────────────────────────────────────
# NVIDIA NIM — OpenAI-compatible endpoint
# Single API key from build.nvidia.com unlocks ALL models below.
# Base URL: https://integrate.api.nvidia.com/v1
# Free tier: 40 RPM per model (independent per model — not a shared pool)
# ─────────────────────────────────────────────────────────────────────────────

# R1 models — instruction-precise, strong explicit JSON output
NVIDIA_R1_CHAIN = [
    "mistralai/mistral-large-3-675b-instruct-2512",  # #1 ~6-8s  — 675B MoE, SOTA instruction following
    "upstage/solar-10.7b-instruct",                   # #2 ~3-4s  — NLP specialist, ATS-tailor-made
    "meta/llama-4-maverick-17b-128e-instruct",        # #3 ~4-5s  — Llama 4 MoE 128 experts
    "mistralai/mistral-nemo-12b-instruct",            # #4 ~5-7s  — strong instruction + function calling
    "bytedance-research/seed-oss-36b-instruct",       # #5 ~4-5s  — 36B long-context clean JSON
    "stepfun-ai/step-3.5-flash",                      # #6 ~4-5s  — 200B sparse MoE fast reasoning
    "microsoft/phi-4-multimodal-instruct",            # #7 ~3-4s  — high-quality reasoning
    "nvidia/nemotron-mini-4b-instruct",               # #8 ~2-3s  — 4B RAG+function-call optimized
]

# R2 models — large, powerful, reliable long-form JSON generation
NVIDIA_R2_CHAIN = [
    "mistralai/mistral-large-3-675b-instruct-2512",   # #1 ~6-8s  — 675B MoE best quality fallback
    "minimax/minimax-m2.7",                            # #2 ~6-8s  — 230B structured tasks + reasoning
    "qwen/qwen3-coder-480b-a35b-instruct",             # #3 ~7-10s — 480B MoE massive structured output
    "mistralai/mistral-nemo-12b-instruct",             # #4 ~5-7s  — agentic structured generation
    "abacusai/dracarys-llama-3.1-70b-instruct",        # #5 ~5-7s  — 70B fine-tuned summarization
    "stepfun-ai/step-3.5-flash",                       # #6 ~5-7s  — 200B sparse MoE long output
]

client = OpenAI(
    api_key=os.getenv("NVIDIA_API_KEY"),
    base_url="https://integrate.api.nvidia.com/v1",
)


def _extract_text(response) -> str | None:
    """Safely pull text from NVIDIA NIM response. Returns None on any structural issue."""
    try:
        text = response.choices[0].message.content
        if text is None:
            return None
        text = text.strip()
        if not text:
            return None
        # Strip chain-of-thought <think> blocks (some models emit them)
        text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()
        if not text:
            return None
        # Strip markdown code fences
        if text.startswith("```"):
            parts = text.split("```")
            text = parts[1] if len(parts) > 1 else text
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()
        # Extract JSON object if wrapped in prose
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            text = match.group(0)
        if len(text.strip()) < 5:
            return None
        return text
    except (AttributeError, IndexError, TypeError):
        return None


def _call_nvidia_single(model: str, prompt: str, max_tokens: int, retries: int = 1) -> dict:
    attempts = []
    for attempt in range(retries + 1):
        try:
            start = time.time()
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=max_tokens,
            )
            elapsed = round(time.time() - start, 2)
            text = _extract_text(response)
            if text is None:
                attempts.append({"model": model, "status": "empty_or_null_response"})
                break
            return {
                "success": True, "text": text, "model": model,
                "speed": elapsed, "attempts": attempts + [{"model": model, "status": "pass"}],
            }
        except Exception as e:
            err = str(e)
            attempts.append({"model": model, "status": err[:80]})
            # Rate limit — stop immediately, let master chain handle per-model skip
            if any(x in err for x in ["429", "rate_limit", "rate limit", "too many requests"]):
                break
            # Model not found — no point retrying
            if any(x in err for x in ["404", "model_not_found", "does not exist", "No such model"]):
                break
            # Auth failure — no point retrying
            if any(x in err for x in ["401", "403", "invalid_api_key", "Unauthorized"]):
                break
            # Token limit exceeded
            if "tokens" in err.lower() and ("exceed" in err.lower() or "limit" in err.lower()):
                break
            # Server errors — retry once
            if any(x in err for x in ["503", "500", "502", "overloaded", "capacity"]):
                if attempt < retries:
                    time.sleep(1)
                continue
            # Timeout — retry once
            if "timeout" in err.lower() or "timed out" in err.lower() or "ReadTimeout" in err:
                if attempt < retries:
                    time.sleep(1)
                continue
            break
    return {"success": False, "text": None, "model": None, "speed": None, "attempts": attempts}


def _call_nvidia_chain(prompt: str, chain: list, max_tokens: int) -> dict:
    attempts = []
    for model in chain:
        result = _call_nvidia_single(model, prompt, max_tokens)
        attempts.extend(result.get("attempts", []))
        if result["success"]:
            result["attempts"] = attempts
            return result
    return {"success": False, "text": None, "model": None, "speed": None, "attempts": attempts}


def call_nvidia_r1(prompt: str) -> dict:
    """NVIDIA NIM chain for Request-1 — ATS scoring + project analysis."""
    return _call_nvidia_chain(prompt, NVIDIA_R1_CHAIN, max_tokens=2500)


def call_nvidia_r2(prompt: str) -> dict:
    """NVIDIA NIM chain for Request-2 — resume generation."""
    return _call_nvidia_chain(prompt, NVIDIA_R2_CHAIN, max_tokens=4500)


def call_single_nvidia(model: str, prompt: str, max_tokens: int = 3500) -> dict:
    """Call exactly one NVIDIA NIM model. Used by master flat chain."""
    return _call_nvidia_single(model, prompt, max_tokens)
