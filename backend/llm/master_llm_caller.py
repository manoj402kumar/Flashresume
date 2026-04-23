from dotenv import load_dotenv
from .gemini_fallback     import call_gemini_r1,     call_gemini_r2,     call_single_gemini
from .mistral_fallback    import call_mistral_r1,    call_mistral_r2,    call_single_mistral
from .groq_fallback       import call_groq_r1,       call_groq_r2,       call_single_groq
from .cerebras_fallback   import call_cerebras_r1,   call_cerebras_r2,   call_single_cerebras
from .cloudflare_fallback import call_cloudflare_r1, call_cloudflare_r2, call_single_cloudflare

load_dotenv()

# ─────────────────────────────────────────────────────────────────────────────
# FLAT R1 CHAIN — ATS scoring + project check
# Each entry: (provider_name, model_id, single_caller)
# ─────────────────────────────────────────────────────────────────────────────
_R1_FLAT = [
    ("gemini",     "gemma-3-27b-it",                        call_single_gemini),     # #1  ~10s quality anchor
    ("mistral",    "open-mistral-nemo",                     call_single_mistral),    # #2  ~4s  fastest
    ("mistral",    "ministral-8b-latest",                   call_single_mistral),    # #3  ~5s
    ("mistral",    "mistral-tiny-latest",                   call_single_mistral),    # #4  ~5s
    ("cloudflare", "@cf/meta/llama-3.1-8b-instruct",       call_single_cloudflare), # #5  ~5s
    ("groq",       "llama-3.1-8b-instant",                 call_single_groq),       # #6  ~10s
    ("cerebras",   "llama3.1-8b",                          call_single_cerebras),   # #7  ~20s
    ("cloudflare", "@cf/mistral/mistral-7b-instruct-v0.1", call_single_cloudflare), # #8  ~15s
]

# ─────────────────────────────────────────────────────────────────────────────
# FLAT R2 CHAIN — resume generation
# Each entry: (provider_name, model_id, single_caller)
# ─────────────────────────────────────────────────────────────────────────────
_R2_FLAT = [
    ("groq",       "openai/gpt-oss-120b",                           call_single_groq),       # #1  ~10-30s best quality
    ("cerebras",   "qwen-3-235b-a22b-instruct-2507",                call_single_cerebras),   # #2  ~4-5s  elite+fast
    ("mistral",    "mistral-large-latest",                          call_single_mistral),    # #3  ~6s
    ("mistral",    "mistral-medium-latest",                         call_single_mistral),    # #4  ~7s
    ("groq",       "llama-3.3-70b-versatile",                      call_single_groq),       # #5  ~4s
    ("mistral",    "mistral-small-latest",                          call_single_mistral),    # #6  ~5s
    ("groq",       "meta-llama/llama-4-scout-17b-16e-instruct",    call_single_groq),       # #7  ~4s
    ("groq",       "openai/gpt-oss-20b",                           call_single_groq),       # #8  ~40-50s
    ("gemini",     "gemini-2.5-flash-lite",                        call_single_gemini),     # #9  ~20s
    ("groq",       "qwen/qwen3-32b",                               call_single_groq),       # #10 ~20-40s
    ("gemini",     "gemini-3.1-flash-lite-preview",                call_single_gemini),     # #11 ~40s last resort
]


def _run_flat_chain(prompt: str, flat_chain: list) -> dict:
    """
    Walk a flat ordered list of (provider, model, caller) tuples.
    Each model is tried individually — no batching per provider.
    Stops at first success.
    """
    all_attempts = []
    for provider_name, model_id, caller in flat_chain:
        result = caller(model_id, prompt)
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


def call_llm_r1(prompt: str) -> dict:
    """
    Request-1 LLM call — ATS scoring + project relevance check.
    Flat chain: gemma-3-27b → open-mistral-nemo → ministral-8b →
                mistral-tiny → cf/llama → llama-3.1-8b-instant →
                cerebras/llama3.1-8b → cf/mistral-7b
    """
    return _run_flat_chain(prompt, _R1_FLAT)


def call_llm_r2(prompt: str) -> dict:
    """
    Request-2 LLM call — resume generation.
    Flat chain: gpt-oss-120b → qwen-3-235b → mistral-large →
                mistral-medium → llama-3.3-70b → mistral-small →
                llama-4-scout → gpt-oss-20b → gemini-2.5-flash-lite →
                qwen3-32b → gemini-3.1-flash-lite-preview
    """
    return _run_flat_chain(prompt, _R2_FLAT)
