import os
from supabase import create_client, Client
from dotenv import load_dotenv
from .gemini_fallback     import call_gemini_r1,     call_gemini_r2,     call_single_gemini
from .mistral_fallback    import call_mistral_r1,    call_mistral_r2,    call_single_mistral
from .groq_fallback       import call_groq_r1,       call_groq_r2,       call_single_groq
from .cerebras_fallback   import call_cerebras_r1,   call_cerebras_r2,   call_single_cerebras
from .cloudflare_fallback import call_cloudflare_r1, call_cloudflare_r2, call_single_cloudflare
from .nvidia_fallback     import call_nvidia_r1,     call_nvidia_r2,     call_single_nvidia

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://your-project.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception:
    supabase = None

# R1 (ATS score JSON + project check): response is small ~200–600 tokens
# R2 (full resume JSON): response is large ~2500–3200 tokens
_R1_MAX_TOKENS = 2500
_R2_MAX_TOKENS = 4500

# ─────────────────────────────────────────────────────────────────────────────
# FLAT R1 CHAIN — ATS scoring + project relevance check (12 models)
#
# Strategy: Quality-first — R1's real problem is hallucination from small
# models. NVIDIA NIM large models (#1–#8) fix this. Each NVIDIA model gets
# a UNIQUE sub-provider tag (nvidia_1 … nvidia_8) so a 429 on one model
# does NOT skip the other 7 — they have independent 40 RPM buckets.
# Groq and Gemini act as final safety nets.
# ─────────────────────────────────────────────────────────────────────────────
_R1_FLAT = [
    # ── NVIDIA NIM (8 models, each independently skippable) ──
    ("nvidia_1", "mistralai/mistral-large-3-675b-instruct-2512", call_single_nvidia),  # #1  ~6-8s  — 675B MoE, best instruction follower
    ("nvidia_2", "upstage/solar-10.7b-instruct",                  call_single_nvidia),  # #2  ~3-4s  — NLP specialist, ATS-tailor-made
    ("nvidia_3", "meta/llama-4-maverick-17b-128e-instruct",       call_single_nvidia),  # #3  ~4-5s  — Llama 4 MoE 128 experts
    ("nvidia_4", "mistralai/mistral-nemo-12b-instruct",           call_single_nvidia),  # #4  ~5-7s  — strong instruction + function calling
    ("nvidia_5", "bytedance-research/seed-oss-36b-instruct",      call_single_nvidia),  # #5  ~4-5s  — 36B long-context clean JSON
    ("nvidia_6", "stepfun-ai/step-3.5-flash",                     call_single_nvidia),  # #6  ~4-5s  — 200B sparse MoE fast reasoning
    ("nvidia_7", "microsoft/phi-4-multimodal-instruct",           call_single_nvidia),  # #7  ~3-4s  — high-quality reasoning
    ("nvidia_8", "nvidia/nemotron-mini-4b-instruct",              call_single_nvidia),  # #8  ~2-3s  — 4B RAG+function-call optimized
    # ── Cross-provider safety nets ──
    ("mistral",  "mistral-large-latest",                          call_single_mistral), # #9  ~6s    — proven battle-tested JSON
    ("groq",     "llama-3.3-70b-versatile",                       call_single_groq),    # #10 ~4s    — 70B, fast, reliable fallback
    ("mistral",  "open-mistral-nemo",                             call_single_mistral), # #11 ~4s    — speed fallback
    ("gemini",   "gemini-2.5-flash-lite",                         call_single_gemini),  # #12 ~20s   — high quota emergency last resort
]

# ─────────────────────────────────────────────────────────────────────────────
# FLAT R2 CHAIN — resume generation (17 models)
#
# Strategy: Size + quality first. Cerebras Qwen3-235B leads at 1400 t/s.
# NVIDIA NIM large models next. Then proven Groq/Mistral fallbacks.
# Provider diversity across all 17 slots prevents single-provider outage
# from killing the entire chain.
# ─────────────────────────────────────────────────────────────────────────────
_R2_FLAT = [
    # ── Tier 1: Elite quality + speed ──
    ("cerebras",  "qwen-3-235b-a22b-instruct-2507",                      call_single_cerebras),  # #1  ~2-3s   — 235B at 1400 t/s, fastest elite
    ("nvidia_1",  "mistralai/mistral-large-3-675b-instruct-2512",        call_single_nvidia),    # #2  ~6-8s   — 675B MoE, best quality fallback
    ("nvidia_2",  "minimax/minimax-m2.7",                                 call_single_nvidia),    # #3  ~6-8s   — 230B structured tasks + reasoning
    ("groq",      "openai/gpt-oss-120b",                                  call_single_groq),      # #4  ~5-15s  — 120B MoE, tight quota worth trying early
    ("nvidia_3",  "qwen/qwen3-coder-480b-a35b-instruct",                  call_single_nvidia),    # #5  ~7-10s  — 480B MoE massive structured output
    # ── Tier 2: Large proven models ──
    ("mistral",   "mistral-large-latest",                                 call_single_mistral),   # #6  ~6s     — proven strong JSON resume output
    ("groq",      "llama-3.3-70b-versatile",                              call_single_groq),      # #7  ~4s     — 70B via Groq, excellent JSON generation
    ("nvidia_4",  "mistralai/mistral-nemo-12b-instruct",                  call_single_nvidia),    # #8  ~5-7s   — ~123B agentic structured generation
    ("nvidia_5",  "abacusai/dracarys-llama-3.1-70b-instruct",             call_single_nvidia),    # #9  ~5-7s   — 70B fine-tuned for generation
    ("mistral",   "mistral-medium-latest",                                call_single_mistral),   # #10 ~7s     — solid structured output
    # ── Tier 3: Mid-range reliable fallbacks ──
    ("groq",      "meta-llama/llama-4-scout-17b-16e-instruct",           call_single_groq),      # #11 ~4s     — 16-expert MoE, fast
    ("groq",      "openai/gpt-oss-20b",                                   call_single_groq),      # #12 ~4-8s   — compact 20B MoE reasoning
    ("mistral",   "mistral-small-latest",                                 call_single_mistral),   # #13 ~5s     — decent fallback, lighter quota
    ("nvidia_6",  "stepfun-ai/step-3.5-flash",                            call_single_nvidia),    # #14 ~5-7s   — 200B sparse MoE, handles long output
    # ── Tier 4: Slow but high-quota last resorts ──
    ("groq",      "qwen/qwen3-32b",                                       call_single_groq),      # #15 ~20-40s — Qwen3-32B thinking mode, slow
    ("gemini",    "gemini-2.5-flash-lite",                                call_single_gemini),    # #16 ~20s    — generous quota, reliable slow fallback
    ("gemini",    "gemini-3.1-flash-lite-preview",                        call_single_gemini),    # #17 ~40s    — absolute last resort, preview/unstable
]

# Rate-limit signal strings
_RATE_LIMIT_SIGNALS = (
    "429", "rate_limit", "rate limit", "too many requests",
    "RESOURCE_EXHAUSTED", "quota", "rate limited",
)


def _is_rate_limited(attempts: list) -> bool:
    """Return True if the last attempt was a rate-limit signal."""
    if not attempts:
        return False
    last_status = str(attempts[-1].get("status", "")).lower()
    return any(sig.lower() in last_status for sig in _RATE_LIMIT_SIGNALS)


def _run_flat_chain(prompt: str, flat_chain: list, max_tokens: int) -> dict:
    """
    Walk a flat ordered list of (provider, model, caller) tuples.
    - Each model is tried individually — no full-provider batching.
    - Stops at first success.
    - Tracks 429'd providers and skips all their subsequent models.
    - NVIDIA models use unique tags (nvidia_1 … nvidia_8) so each model
      is independently skippable — a 429 on one does not block the others.
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
    Request-1 — ATS scoring + project relevance check. (12 models)
    Chain: mistral-large-3-675b → solar-10.7b → llama-4-maverick →
           mistral-nemo → seed-oss-36b → step-3.5-flash →
           phi-4-multimodal → nemotron-mini-4b →
           mistral-large-latest → llama-3.3-70b →
           open-mistral-nemo → gemini-2.5-flash-lite
    max_tokens: 2500
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
    Request-2 — resume generation. (17 models)
    Chain: qwen-3-235b → mistral-large-3-675b → minimax-m2.7 →
           gpt-oss-120b → qwen3-coder-480b → mistral-large →
           llama-3.3-70b → mistral-nemo → dracarys-70b →
           mistral-medium → llama-4-scout → gpt-oss-20b →
           mistral-small → step-3.5-flash → qwen3-32b →
           gemini-2.5-flash-lite → gemini-3.1-flash-lite-preview
    max_tokens: 4500
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
