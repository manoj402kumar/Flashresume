import os
from supabase import create_client, Client
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv
from .gemini_fallback     import call_gemini_r1,     call_gemini_r2,     call_single_gemini
from .mistral_fallback    import call_mistral_r1,    call_mistral_r2,    call_single_mistral
from .groq_fallback       import call_groq_r1,       call_groq_r2,       call_single_groq
from .cerebras_fallback   import call_cerebras_r1,   call_cerebras_r2,   call_single_cerebras
from .cloudflare_fallback import call_cloudflare_r1, call_cloudflare_r2, call_single_cloudflare

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://your-project.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception:
    supabase = None

# R1 (ATS score JSON + project check): response is small ~200–600 tokens
# R2 (full resume JSON): response is large ~2500–3200 tokens
# Tight limits save TPM quota on rate-limited providers (Groq 8K TPM)
_R1_MAX_TOKENS = 2500
_R2_MAX_TOKENS = 4500

# ─────────────────────────────────────────────────────────────────────────────
# FLAT R1 CHAIN — ATS scoring + project check
# (provider_name, model_id, single_caller)
# ─────────────────────────────────────────────────────────────────────────────
# Speed-first ordering: fast 4-5s models up front, gemma (~10s) pushed to #7
_R1_FLAT = [
    ("mistral",    "open-mistral-nemo",                     call_single_mistral),    # #1  ~4s  — fastest among all
    ("mistral",    "ministral-8b-latest",                   call_single_mistral),    # #2  ~5s
    ("mistral",    "mistral-tiny-latest",                   call_single_mistral),    # #3  ~5s
    ("cloudflare", "@cf/meta/llama-3.1-8b-instruct",       call_single_cloudflare), # #4  ~5s
    ("groq",       "llama-3.1-8b-instant",                 call_single_groq),       # #5  ~4s
    ("cerebras",   "llama3.1-8b",                          call_single_cerebras),   # #6  ~5s
    ("gemini",     "gemma-3-27b-it",                        call_single_gemini),     # #7  ~10s — quality anchor
    ("cloudflare", "@cf/mistral/mistral-7b-instruct-v0.1", call_single_cloudflare), # #8  ~15s — last 
]

# ─────────────────────────────────────────────────────────────────────────────
# FLAT R2 CHAIN — resume generation
# (provider_name, model_id, single_caller)
# ─────────────────────────────────────────────────────────────────────────────
_R2_FLAT = [
    ("groq",       "openai/gpt-oss-120b",                        call_single_groq),       # #1  ~5-15s  — best quality (8K TPM, 1K RPD free)
    ("cerebras",   "qwen-3-235b-a22b-instruct-2507",             call_single_cerebras),   # #2  ~2-3s   — elite + very fast at 1400 t/s
    ("mistral",    "mistral-large-latest",                       call_single_mistral),    # #3  ~6s
    ("mistral",    "mistral-medium-latest",                      call_single_mistral),    # #4  ~7s
    ("groq",       "llama-3.3-70b-versatile",                   call_single_groq),       # #5  ~4s
    ("mistral",    "mistral-small-latest",                       call_single_mistral),    # #6  ~5s
    ("groq",       "meta-llama/llama-4-scout-17b-16e-instruct", call_single_groq),       # #7  ~4s
    ("groq",       "openai/gpt-oss-20b",                        call_single_groq),       # #8  ~4-8s
    ("gemini",     "gemini-2.5-flash-lite",                     call_single_gemini),     # #9  ~20s
    ("groq",       "qwen/qwen3-32b",                            call_single_groq),       # #10 ~20-40s
    ("gemini",     "gemini-3.1-flash-lite-preview",             call_single_gemini),     # #11 ~40s — last resort (preview model)
]

# Rate-limit signal strings — used to detect 429-type failures across all providers
_RATE_LIMIT_SIGNALS = (
    "429", "rate_limit", "rate limit", "too many requests",
    "RESOURCE_EXHAUSTED", "quota", "rate limited",
)


def _is_rate_limited(attempts: list) -> bool:
    """Return True if the last attempt in a failed result was a rate-limit signal."""
    if not attempts:
        return False
    last_status = str(attempts[-1].get("status", "")).lower()
    return any(sig.lower() in last_status for sig in _RATE_LIMIT_SIGNALS)


def _run_flat_chain(prompt: str, flat_chain: list, max_tokens: int) -> dict:
    """
    Walk a flat ordered list of (provider, model, caller) tuples.
    - Each model is tried individually — no full-provider batching.
    - Stops at first success.
    - Tracks 429'd providers and skips all their subsequent models
      (avoids wasting calls when an entire provider is rate-limited).
    """
    all_attempts = []
    rate_limited_providers: set = set()

    for provider_name, model_id, caller in flat_chain:
        if provider_name in rate_limited_providers:
            all_attempts.append({
                "model": model_id,
                "status": f"skipped — {provider_name} rate-limited earlier",
            })
            continue

        result = caller(model_id, prompt, max_tokens)
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

        if _is_rate_limited(result.get("attempts", [])):
            rate_limited_providers.add(provider_name)

    return {
        "success":      False,
        "text":         None,
        "model":        None,
        "provider":     None,
        "speed":        None,
        "all_attempts": all_attempts,
    }


def call_llm_r1(prompt: str) -> dict:
    """
    Request-1 — ATS scoring + project relevance check.
    Chain: open-mistral-nemo → ministral-8b → mistral-tiny →
           cf/llama → llama-3.1-8b-instant → cerebras/llama3.1-8b →
           gemma-3-27b-it → cf/mistral-7b
    max_tokens: 2500 (small JSON — saves TPM quota)
    """
    result = _run_flat_chain(prompt, _R1_FLAT, _R1_MAX_TOKENS)
    if supabase and result.get("provider"):
        try:
            supabase.table("llm_usage").insert({
                "request_type": "r1",
                "provider": result["provider"],
                "model": result["model"],
                "success": result["success"],
                "speed_secs": result["speed"]
            }).execute()
        except Exception:
            pass
    return result


def call_llm_r2(prompt: str) -> dict:
    """
    Request-2 — resume generation.
    Chain: gpt-oss-120b → qwen-3-235b → mistral-large → mistral-medium →
           llama-3.3-70b → mistral-small → llama-4-scout → gpt-oss-20b →
           gemini-2.5-flash-lite → qwen3-32b → gemini-3.1-flash-lite-preview
    max_tokens: 4500 (full resume JSON)
    """
    result = _run_flat_chain(prompt, _R2_FLAT, _R2_MAX_TOKENS)
    if supabase and result.get("provider"):
        try:
            supabase.table("llm_usage").insert({
                "request_type": "r2",
                "provider": result["provider"],
                "model": result["model"],
                "success": result["success"],
                "speed_secs": result["speed"]
            }).execute()
        except Exception:
            pass
    return result
