import os
import asyncio
from supabase import create_client, Client
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv
from .gemini_fallback     import call_single_gemini_r1,     call_single_gemini_r2
from .mistral_fallback    import call_single_mistral_r1,    call_single_mistral_r2
from .groq_fallback       import call_single_groq_r1,       call_single_groq_r2
from .cloudflare_fallback import call_single_cloudflare_r1, call_single_cloudflare_r2
from .nvidia_fallback     import call_single_nvidia_r1,     call_single_nvidia_r2

# ── Concurrency guard ────────────────────────────────────────────────────────
# Limits simultaneous LLM operations to 8 per worker process.
# Requests beyond this wait in an async queue (non-blocking) instead of
# all hammering providers at once and causing mass 429 rate-limit storms.
# With 2 Uvicorn workers this means max 16 concurrent LLM calls total.
_LLM_SEMAPHORE = asyncio.Semaphore(8)
# ─────────────────────────────────────────────────────────────────────────────

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://your-project.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception:
    supabase = None

# R1 (ATS score JSON + project check): response is small ~200-600 tokens
# R2 (full resume JSON): response is large ~2500-3200 tokens
_R1_MAX_TOKENS = 2500
_R2_MAX_TOKENS = 4500

# =============================================================================
# FINAL PRODUCTION RANKING — 16 models, same order for both R1 and R2
# R1 uses Account/Email 1 API keys (*_R1_API_KEY)  — timeout 30s per model
# R2 uses Account/Email 2 API keys (*_R2_API_KEY)  — timeout 90s per model
# Both pipelines are fully independent — no shared keys, no shared quotas.
# =============================================================================
#
# RISK 3 FIX: NVIDIA models are interleaved — no two NVIDIA models are adjacent.
# A single NVIDIA 429 at rank #1 now leaves 10/16 models intact (was 6/16).
#
# Rank | Model                                     | Provider    | R1 time | R2 time
# -----|-------------------------------------------|-------------|---------|--------
#   1  | mistralai/mixtral-8x22b-instruct-v0.1     | nvidia      | ~10s    | ~15s
#   2  | mistral-medium-latest                     | mistral     |  ~7s    | ~15s
#   3  | meta-llama/llama-4-scout-17b-16e-instruct | groq        |  ~6s    | ~15s
#   4  | mistral-large-latest                      | mistral     |  ~6s    | ~15s
#   5  | mistralai/mistral-medium-3.5-128b         | nvidia      |  ~6s    | ~15s
#   6  | gemini-2.5-flash-lite                     | gemini      |  ~8s    | ~15s   <- moved up from #8
#   7  | mistralai/mistral-nemotron                | nvidia      |  ~6s    | ~40s
#   8  | ministral-8b-latest                       | mistral     |  ~6s    | ~20s   <- moved up from #9
#   9  | meta/llama-3.3-70b-instruct               | nvidia      |  ~8s    | ~40s
#  10  | llama-3.3-70b-versatile                   | groq        | ~15s    | ~30s   <- moved up from #13
#  11  | mistralai/ministral-14b-instruct-2512      | nvidia      |  ~8s    | ~70s*
#  12  | @cf/meta/llama-3.1-8b-instruct            | cloudflare  |  ~8s    | ~35s
#  13  | mistral-small-latest                      | mistral     |  ~6s    | ~50s
#  14  | mistralai/mistral-small-4-119b-2603       | nvidia      | ~25s    | ~65s*
#  15  | mistral-tiny-latest                       | mistral     |  ~5s    | ~15s
#  16  | open-mistral-nemo                         | mistral     |  ~6s    | ~40s
#
# * Ranks 11 and 14 have R2 times that approach the 90s timeout — they will
#   complete in normal conditions but may timeout under NVIDIA capacity pressure.
#
# Provider spread per rank: nvidia(1), mistral(2), groq(3), mistral(4), nvidia(5),
#   gemini(6), nvidia(7), mistral(8), nvidia(9), groq(10), nvidia(11),
#   cloudflare(12), mistral(13), nvidia(14), mistral(15), mistral(16)
# No two NVIDIA slots are consecutive. Worst-case NVIDIA 429 leaves 10/16 active.

# -----------------------------------------------------------------------------
# R1 FLAT CHAIN — uses R1-dedicated API keys (Account/Email 1) — timeout 30s
# -----------------------------------------------------------------------------
_R1_FLAT = [
    ("mistral",    "mistral-medium-latest",                       call_single_mistral_r1),      # #1
    ("nvidia",     "mistralai/mistral-nemotron",                  call_single_nvidia_r1),       # #2
    ("mistral",    "mistral-large-latest",                        call_single_mistral_r1),      # #3
    ("nvidia",     "mistralai/mistral-medium-3.5-128b",           call_single_nvidia_r1),       # #4
    ("mistral",    "ministral-8b-latest",                         call_single_mistral_r1),      # #5
    ("nvidia",     "mistralai/ministral-14b-instruct-2512",       call_single_nvidia_r1),       # #6
    ("groq",       "llama-3.3-70b-versatile",                    call_single_groq_r1),         # #7
    ("nvidia",     "mistralai/mixtral-8x22b-instruct-v0.1",      call_single_nvidia_r1),       # #8
    ("groq",       "meta-llama/llama-4-scout-17b-16e-instruct",  call_single_groq_r1),         # #9
    ("mistral",    "mistral-small-latest",                        call_single_mistral_r1),      # #10
    ("nvidia",     "mistralai/mistral-small-4-119b-2603",        call_single_nvidia_r1),       # #11
    ("mistral",    "mistral-tiny-latest",                         call_single_mistral_r1),      # #12
    ("mistral",    "open-mistral-nemo",                           call_single_mistral_r1),      # #13
    ("nvidia",     "meta/llama-3.3-70b-instruct",                call_single_nvidia_r1),       # #14
    ("cloudflare", "@cf/meta/llama-3.1-8b-instruct",            call_single_cloudflare_r1),   # #15
    ("gemini",     "gemini-2.5-flash-lite",                      call_single_gemini_r1),       # #16
]

# -----------------------------------------------------------------------------
# R2 FLAT CHAIN — uses R2-dedicated API keys (Account/Email 2) — timeout 90s
# -----------------------------------------------------------------------------
_R2_FLAT = [
    ("mistral",    "mistral-medium-latest",                       call_single_mistral_r2),      # #1
    ("nvidia",     "mistralai/mistral-nemotron",                  call_single_nvidia_r2),       # #2
    ("mistral",    "mistral-large-latest",                        call_single_mistral_r2),      # #3
    ("nvidia",     "mistralai/mistral-medium-3.5-128b",           call_single_nvidia_r2),       # #4
    ("mistral",    "ministral-8b-latest",                         call_single_mistral_r2),      # #5
    ("nvidia",     "mistralai/ministral-14b-instruct-2512",       call_single_nvidia_r2),       # #6
    ("groq",       "llama-3.3-70b-versatile",                    call_single_groq_r2),         # #7
    ("nvidia",     "mistralai/mixtral-8x22b-instruct-v0.1",      call_single_nvidia_r2),       # #8
    ("groq",       "meta-llama/llama-4-scout-17b-16e-instruct",  call_single_groq_r2),         # #9
    ("mistral",    "mistral-small-latest",                        call_single_mistral_r2),      # #10
    ("nvidia",     "mistralai/mistral-small-4-119b-2603",        call_single_nvidia_r2),       # #11
    ("mistral",    "mistral-tiny-latest",                         call_single_mistral_r2),      # #12
    ("mistral",    "open-mistral-nemo",                           call_single_mistral_r2),      # #13
    ("nvidia",     "meta/llama-3.3-70b-instruct",                call_single_nvidia_r2),       # #14
    ("cloudflare", "@cf/meta/llama-3.1-8b-instruct",            call_single_cloudflare_r2),   # #15
    ("gemini",     "gemini-2.5-flash-lite",                      call_single_gemini_r2),       # #16
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


async def _run_flat_chain(prompt: str, flat_chain: list, max_tokens: int, preferred_model: str = "") -> dict:
    """
    Async walk of a flat ordered list of (provider, model, async_caller) tuples.
    - If preferred_model is set, starts from that model in the chain (then falls through).
    - Each model is awaited individually — no full-provider batching.
    - Stops at first success.
    - Tracks 429'd providers and skips all their subsequent models
      (avoids wasting calls when an entire provider is rate-limited).
    """
    all_attempts = []
    rate_limited_providers: set = set()

    # Determine starting index: jump to preferred_model if specified
    start_index = 0
    if preferred_model:
        for i, (_, model_id, _) in enumerate(flat_chain):
            if model_id == preferred_model:
                start_index = i
                break
        # If preferred_model not found, start_index stays 0 (full chain)

    for provider_name, model_id, caller in flat_chain[start_index:]:
        if provider_name in rate_limited_providers:
            all_attempts.append({
                "model": model_id,
                "status": f"skipped — {provider_name} rate-limited earlier",
            })
            continue

        result = await caller(model_id, prompt, max_tokens)
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


def _log_to_supabase(request_type: str, result: dict):
    """Fire-and-forget Supabase usage log. Errors are silent — never block the response."""
    if supabase and result.get("provider"):
        try:
            supabase.table("llm_usage").insert({
                "request_type": request_type,
                "provider": result["provider"],
                "model": result["model"],
                "success": result["success"],
                "speed_secs": result["speed"]
            }).execute()
        except Exception:
            pass


async def call_llm_r1(prompt: str, preferred_model: str = "") -> dict:
    """
    Request-1 — ATS scoring + project relevance check.
    Uses R1-dedicated API keys (Account/Email 1). Independent from R2 quota.
    All callers are async. Timeout per model: 30s.
    If preferred_model is set, starts the chain from that model.
    Acquires _LLM_SEMAPHORE — max 8 concurrent LLM ops per worker.
    Chain (16 models, interleaved by provider):
      mistral-medium -> nvidia/mistral-nemotron -> mistral-large ->
      nvidia/mistral-medium-3.5 -> ministral-8b -> nvidia/ministral-14b ->
      groq/llama-3.3-70b -> nvidia/mixtral-8x22b -> groq/llama-4-scout ->
      mistral-small -> nvidia/mistral-small-4 -> mistral-tiny ->
      open-mistral-nemo -> nvidia/llama-3.3-70b -> cf/llama-3.1-8b ->
      gemini-2.5-flash-lite
    max_tokens: 2500
    """
    async with _LLM_SEMAPHORE:
        result = await _run_flat_chain(prompt, _R1_FLAT, _R1_MAX_TOKENS, preferred_model)
    _log_to_supabase("r1", result)
    return result


async def call_llm_r2(prompt: str, preferred_model: str = "") -> dict:
    """
    Request-2 — resume generation.
    Uses R2-dedicated API keys (Account/Email 2). Independent from R1 quota.
    All callers are async. Timeout per model: 90s.
    If preferred_model is set, starts the chain from that model.
    Acquires _LLM_SEMAPHORE — max 8 concurrent LLM ops per worker.
    Chain (16 models, interleaved by provider):
      mistral-medium -> nvidia/mistral-nemotron -> mistral-large ->
      nvidia/mistral-medium-3.5 -> ministral-8b -> nvidia/ministral-14b ->
      groq/llama-3.3-70b -> nvidia/mixtral-8x22b -> groq/llama-4-scout ->
      mistral-small -> nvidia/mistral-small-4 -> mistral-tiny ->
      open-mistral-nemo -> nvidia/llama-3.3-70b -> cf/llama-3.1-8b ->
      gemini-2.5-flash-lite
    max_tokens: 4500
    """
    async with _LLM_SEMAPHORE:
        result = await _run_flat_chain(prompt, _R2_FLAT, _R2_MAX_TOKENS, preferred_model)
    _log_to_supabase("r2", result)
    return result
