import asyncio
import time
from .deepseek_direct import call_single_deepseek_r1, call_single_deepseek_r2
from .mistral_fallback import call_single_mistral_r1, call_single_mistral_r2
from .groq_fallback import call_single_groq_r1, call_single_groq_r2
from .nvidia_fallback import call_single_nvidia_r1, call_single_nvidia_r2
from .cloudflare_fallback import call_single_cloudflare_r1, call_single_cloudflare_r2
from supabase_client import supabase

_LLM_SEMAPHORE = asyncio.Semaphore(5)

_R1_MAX_TOKENS = 8000
_R2_MAX_TOKENS = 8000

_COOLDOWN_SECS_429 = 120
_COOLDOWN_SECS_402 = 86400
_circuit_tripped = {}

async def _trip_circuit(model_id: str, error_type: str):
    cooldown = _COOLDOWN_SECS_429 if error_type == "429" else _COOLDOWN_SECS_402
    print(f"[{model_id}] Circuit tripped ({error_type}). Cooling down for {cooldown}s.")
    _circuit_tripped[model_id] = time.time() + cooldown
    
    if supabase:
        try:
            await asyncio.wait_for(
                asyncio.to_thread(
                    lambda: supabase.rpc("trip_circuit_breaker", {
                        "p_circuit_key": model_id,
                        "p_cooldown_seconds": cooldown
                    }).execute()
                ),
                timeout=0.8
            )
        except Exception:
            pass

def _is_tripped(model_id: str, db_tripped_keys: set = None) -> bool:
    if db_tripped_keys and model_id in db_tripped_keys:
        return True
    if model_id not in _circuit_tripped:
        return False
    if time.time() > _circuit_tripped[model_id]:
        del _circuit_tripped[model_id]
        return False
    return True

def _get_rate_limit_type(attempts):
    for att in attempts:
        err = str(att.get("status", ""))
        if any(x in err for x in ["402", "Payment Required"]):
            return "402"
        if any(x in err for x in ["429", "rate_limit", "RESOURCE_EXHAUSTED"]):
            return "429"
        if any(x in err for x in ["not configured", "API key not", "missing_api_key"]):
            return "402"
    return None

# ─────────────────────────────────────────────────────────────────────────────
# IMPORTANT: In caller function names, r1/r2 = API ACCOUNT NUMBER, not request type.
#   call_single_mistral_r1 → uses MISTRAL_R1_API_KEY  (Account / Key 1)
#   call_single_mistral_r2 → uses MISTRAL_R2_API_KEY  (Account / Key 2)
#
# POOLS are 3-tuples: (provider, model_id, key_label)
# The caller is resolved via _CALLERS[(provider, key_label)]:
#   "Key 1" → r1 caller (Account 1 API key)
#   "Key 2" → r2 caller (Account 2 API key)
#
# This is the only correct way to route — it matches the API account to the
# pool slot regardless of whether the request is R1 (analyze) or R2 (generate).
# ─────────────────────────────────────────────────────────────────────────────

POOL_1 = [
    ("mistral", "mistral-medium-3.5",                       "Key 1"),
    ("mistral", "mistral-medium-3.5",                       "Key 2"),
    ("nvidia",  "mistralai/mistral-medium-3.5-128b",        "Key 1"),
    ("nvidia",  "mistralai/mistral-medium-3.5-128b",        "Key 2"),
    ("mistral", "mistral-medium-2604",                      "Key 1"),
    ("mistral", "mistral-medium-2604",                      "Key 2"),
    ("nvidia",  "meta/llama-4-maverick-17b-128e-instruct",  "Key 1"),
    ("nvidia",  "meta/llama-4-maverick-17b-128e-instruct",  "Key 2"),
    ("mistral", "mistral-medium-latest",                    "Key 1"),
    ("mistral", "mistral-medium-latest",                    "Key 2"),
    ("nvidia",  "mistralai/mistral-nemotron",               "Key 1"),
    ("nvidia",  "mistralai/mistral-nemotron",               "Key 2"),
]

POOL_2 = [
    ("mistral",    "mistral-large-latest",                         "Key 1"),
    ("mistral",    "mistral-large-latest",                         "Key 2"),
    ("groq",       "llama-3.3-70b-versatile",                      "Key 1"),
    ("groq",       "llama-3.3-70b-versatile",                      "Key 2"),
    ("cloudflare", "@cf/meta/llama-3.3-70b-instruct-fp8-fast",     "Key 1"),
    ("cloudflare", "@cf/meta/llama-3.3-70b-instruct-fp8-fast",     "Key 2"),
    ("nvidia",     "mistralai/ministral-14b-instruct-2512",        "Key 1"),
    ("nvidia",     "mistralai/ministral-14b-instruct-2512",        "Key 2"),
    ("mistral",    "ministral-14b-latest",                         "Key 1"),
    ("mistral",    "ministral-14b-latest",                         "Key 2"),
    ("cloudflare", "@cf/mistralai/mistral-small-3.1-24b-instruct", "Key 1"),
    ("cloudflare", "@cf/mistralai/mistral-small-3.1-24b-instruct", "Key 2"),
    ("mistral",    "mistral-small-latest",                         "Key 1"),
    ("mistral",    "mistral-small-latest",                         "Key 2"),
]

# ─────────────────────────────────────────────────────────────────────────────
# CALLER LOOKUP — keyed by (provider, key_label).
# "Key 1" → r1 caller (uses Account 1 API key env var)
# "Key 2" → r2 caller (uses Account 2 API key env var)
# ─────────────────────────────────────────────────────────────────────────────

_CALLERS = {
    ("deepseek",   "Key 1"): call_single_deepseek_r1,
    ("deepseek",   "Key 2"): call_single_deepseek_r2,
    ("mistral",    "Key 1"): call_single_mistral_r1,
    ("mistral",    "Key 2"): call_single_mistral_r2,
    ("groq",       "Key 1"): call_single_groq_r1,
    ("groq",       "Key 2"): call_single_groq_r2,
    ("nvidia",     "Key 1"): call_single_nvidia_r1,
    ("nvidia",     "Key 2"): call_single_nvidia_r2,
    ("cloudflare", "Key 1"): call_single_cloudflare_r1,
    ("cloudflare", "Key 2"): call_single_cloudflare_r2,
}

_pool1_idx = 0
_pool2_idx = 0
_rr_lock = asyncio.Lock()

async def _get_next_rr_index(pool_type: int) -> int:
    """Returns current round-robin index without advancing it."""
    global _pool1_idx, _pool2_idx
    async with _rr_lock:
        if pool_type == 1:
            idx = _pool1_idx
        else:
            idx = _pool2_idx
    return idx

async def _advance_rr_index(pool_type: int, pool_size: int, winner_idx: int):
    """Advances the counter cleanly to the index AFTER the winning model."""
    global _pool1_idx, _pool2_idx
    async with _rr_lock:
        if pool_type == 1:
            _pool1_idx = (winner_idx + 1) % pool_size
        else:
            _pool2_idx = (winner_idx + 1) % pool_size

async def _get_pool_models(pool_type: int) -> list:
    pool = POOL_1 if pool_type == 1 else POOL_2
    idx = await _get_next_rr_index(pool_type)
    # Return reordered pool starting at idx (3-tuples: provider, model_id, key_label)
    return pool[idx:] + pool[:idx]

def _get_provider_for_model(model_id: str) -> str:
    base_model_id = model_id.split("|")[0]
    if base_model_id == "deepseek-v4-flash":
        return "deepseek"
    if base_model_id.startswith("@cf/"):
        return "cloudflare"
    if base_model_id.startswith("mistralai/") or base_model_id.startswith("nvidia/") or base_model_id.startswith("meta/"):
        return "nvidia"
    _GROQ_MODELS = {"llama-3.3-70b-versatile"}
    if base_model_id in _GROQ_MODELS:
        return "groq"
    return "mistral"  # fallback

async def call_llm_balanced(prompt: str, is_r1: bool, preferred_model: str = "", no_ai_changes: bool = False) -> dict:
    async with _LLM_SEMAPHORE:
        max_tokens = _R1_MAX_TOKENS if is_r1 else _R2_MAX_TOKENS
        all_attempts = []
        
        # 1. Fetch DB tripped keys
        db_tripped_keys = set()
        if supabase:
            try:
                res = await asyncio.wait_for(
                    asyncio.to_thread(lambda: supabase.rpc("get_tripped_circuits").execute()),
                    timeout=0.8
                )
                if res.data:
                    db_tripped_keys = {row["circuit_key"] for row in res.data}
            except Exception:
                pass

        # Build Chain
        chain = []

        # 1. Explicit Preferred Model Override
        if preferred_model and preferred_model != "auto":
            provider = _get_provider_for_model(preferred_model)
            base_model_id = preferred_model.split("|")[0]
            is_key2 = "|key2" in preferred_model
            key_label = "Key 2" if is_key2 else "Key 1"
            chain.append((provider, base_model_id, key_label))
        else:
            if is_r1:
                # R1 (Analyze): DeepSeek → Pool 1 → Pool 2
                chain.append(("deepseek", "deepseek-v4-flash", "Key 1"))
                chain.append(("POOL", 1, None))
                chain.append(("POOL", 2, None))
            else:
                # R2 (Generate) & Self-Edit: Pool 1 → Pool 2 (No DeepSeek)
                chain.append(("POOL", 1, None))
                chain.append(("POOL", 2, None))

        # Execute Chain
        for item in chain:
            original_pool = None
            if item[0] == "POOL":
                pool_type = item[1]
                models = await _get_pool_models(pool_type)
                original_pool = POOL_1 if pool_type == 1 else POOL_2
            else:
                models = [item]

            for provider, model_id, key_label in models:
                circuit_key = f"{provider}_{model_id}_{key_label}"
                if _is_tripped(circuit_key, db_tripped_keys):
                    all_attempts.append({"model": f"{model_id} - {key_label}", "status": "circuit_breaker_active"})
                    continue

                # ✅ Caller resolved by (provider, key_label) — correct API account always used
                caller = _CALLERS.get((provider, key_label), call_single_mistral_r1)
                result = await caller(model_id, prompt, max_tokens)

                if result["success"]:
                    print(f"[LLM Fallback] Attempted {len(all_attempts)+1} model(s) -> Winner: {model_id} - {key_label} ({result.get('speed', 'N/A')}s)")
                    if original_pool:
                        try:
                            winner_idx = original_pool.index((provider, model_id, key_label))
                            await _advance_rr_index(pool_type, len(original_pool), winner_idx)
                        except ValueError:
                            pass
                    return _finalize(result, provider, f"{model_id} - {key_label}", "r1" if is_r1 else "r2")

                err_type = _get_rate_limit_type(result.get("attempts", []))
                if err_type:
                    await _trip_circuit(circuit_key, err_type)

                for att in result.get("attempts", []):
                    att["model"] = f"{model_id} - {key_label}"
                all_attempts.extend(result.get("attempts", []))

        return {"success": False, "all_attempts": all_attempts}

def _finalize(result: dict, provider: str, model_id: str, r_type: str) -> dict:
    if supabase and result.get("speed"):
        async def _log_usage():
            try:
                await asyncio.to_thread(
                    lambda: supabase.table("llm_usage").insert({
                        "request_type": r_type,
                        "provider": provider,
                        "model": model_id,
                        "success": True,
                        "speed_secs": result["speed"]
                    }).execute()
                )
            except Exception:
                pass  # WinError 10035 / any network error — non-critical telemetry
        asyncio.create_task(_log_usage())
    return {"success": True, "text": result["text"], "_model_used": model_id}

async def call_llm_r1(prompt: str, preferred_model: str = "") -> dict:
    return await call_llm_balanced(prompt, True, preferred_model)

async def call_llm_r2(prompt: str, preferred_model: str = "", no_ai_changes: bool = False) -> dict:
    return await call_llm_balanced(prompt, False, preferred_model, no_ai_changes)
