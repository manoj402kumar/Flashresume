import asyncio
import time
import re
from .deepseek_direct import call_single_deepseek_r1, call_single_deepseek_r2
from .mistral_fallback import call_single_mistral_r1, call_single_mistral_r2, call_single_mistral_r3
from .nvidia_fallback import call_single_nvidia_r1, call_single_nvidia_r2
from .cloudflare_fallback import call_single_cloudflare_r1, call_single_cloudflare_r2
import supabase_client as sc

_LLM_SEMAPHORE = asyncio.Semaphore(5)

_R1_MAX_TOKENS = 8000
_R2_MAX_TOKENS = 8000

_COOLDOWN_SECS_429 = 120
_circuit_tripped = {}

def _get_402_cooldown_secs() -> int:
    import datetime
    now = datetime.datetime.now(datetime.timezone.utc)
    tomorrow = (now + datetime.timedelta(days=1)).replace(
        hour=0, minute=5, second=0, microsecond=0
    )
    cooldown = int((tomorrow - now).total_seconds())
    return max(300, min(cooldown, 86400))

async def _trip_circuit(model_id: str, error_type: str):
    if error_type == "config":
        # Missing env var — skip locally, never pollute global DB
        _circuit_tripped[model_id] = float('inf')
        print(f"[{model_id}] Config error — skipping locally (no DB write)")
        return

    if error_type == "429":
        cooldown = _COOLDOWN_SECS_429
    elif error_type == "402":
        cooldown = _get_402_cooldown_secs()
    elif error_type == "401":
        cooldown = 86400
    else:
        cooldown = 300
    print(f"[{model_id}] Circuit tripped ({error_type}). Cooling down for {cooldown}s.")
    _circuit_tripped[model_id] = time.time() + cooldown

    if sc.supabase:
        provider = model_id.split("_")[0]
        try:
            await asyncio.wait_for(
                asyncio.to_thread(lambda: sc.supabase.table("llm_usage").insert({
                    "request_type": "circuit_trip",
                    "provider": provider,
                    "model": model_id,
                    "success": False,
                    "speed_secs": 0
                }).execute()),
                timeout=0.8
            )
        except Exception:
            pass
    
    if sc.supabase:
        try:
            await asyncio.wait_for(
                asyncio.to_thread(
                    lambda: sc.supabase.rpc("trip_circuit_breaker", {
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
        status = str(att.get("status", ""))
        # Use word boundaries — avoids "4290", "context 401 token", etc.
        if re.search(r'\b402\b', status) or "Payment Required" in status:
            return "402"
        if re.search(r'\b429\b', status) or re.search(r'\brate.?limit\b', status, re.I) or "RESOURCE_EXHAUSTED" in status:
            return "429"
        if any(x in status for x in ["not configured", "API key not", "missing_api_key"]):
            return "config"
        if re.search(r'\b401\b', status) or re.search(r'\b403\b', status) or \
           any(x in status for x in ["Unauthorized", "invalid_api_key", "Forbidden"]):
            return "401"
    return None
# ─────────────────────────────────────────────────────────────────────────────
# IMPORTANT: In caller function names, r1/r2 = API ACCOUNT NUMBER, not request type.
#   call_single_mistral_r1 → uses MISTRAL_R1_API_KEY  (Account / Key 1)
#   call_single_mistral_r2 → uses MISTRAL_R2_API_KEY  (Account / Key 2)
#
# POOLS are 3-tuples: (provider, model_id, key_label)
# The caller is resolved via _CALLERS[(provider, key_label)]:
#   "Key 1" → r1 caller (Account 1 API key)
#   "Key 2"→ r2 caller (Account 2 API key)
#
# This is the only correct way to route — it matches the API account to the
# pool slot regardless of whether the request is R1 (analyze) or R2 (generate).
# ─────────────────────────────────────────────────────────────────────────────

POOL_1 = [
    ("mistral", "mistral-medium-3.5",                       "Key 1"),
    ("mistral", "mistral-medium-3.5",                       "Key 2"),
    ("mistral", "mistral-medium-3.5",                       "Key 3"),
    ("mistral", "mistral-medium-2604",                      "Key 1"),
    ("mistral", "mistral-medium-2604",                      "Key 2"),
    ("mistral", "mistral-medium-2604",                      "Key 3"),
    ("mistral", "mistral-medium-latest",                    "Key 1"),
    ("mistral", "mistral-medium-latest",                    "Key 2"),
    ("mistral", "mistral-medium-latest",                    "Key 3"),
    ("mistral", "mistral-large-2512",                       "Key 1"),
    ("mistral", "mistral-large-2512",                       "Key 2"),
    ("mistral", "mistral-large-2512",                       "Key 3"),
    ("mistral", "mistral-medium-2508",                      "Key 1"),
    ("mistral", "mistral-medium-2508",                      "Key 2"),
    ("mistral", "mistral-medium-2508",                      "Key 3"),
    ("mistral", "mistral-large-latest",                     "Key 1"),
    ("mistral", "mistral-large-latest",                     "Key 2"),
    ("mistral", "mistral-large-latest",                     "Key 3"),
]

POOL_2 = [
    ("ministral",  "ministral-14b-latest",                         "Key 1"),
    ("ministral",  "ministral-14b-latest",                         "Key 2"),
    ("ministral",  "ministral-14b-latest",                         "Key 3"),
    ("mistral",    "mistral-small-latest",                         "Key 1"),
    ("mistral",    "mistral-small-latest",                         "Key 2"),
    ("mistral",    "mistral-small-latest",                         "Key 3"),
    ("mistral",    "mistral-small-2506",                           "Key 1"),
    ("mistral",    "mistral-small-2506",                           "Key 2"),
    ("mistral",    "mistral-small-2506",                           "Key 3"),
    ("cloudflare", "@cf/meta/llama-3.3-70b-instruct-fp8-fast",     "Key 1"),
    ("cloudflare", "@cf/meta/llama-3.3-70b-instruct-fp8-fast",     "Key 2"),
    ("nvidia",     "mistralai/ministral-14b-instruct-2512",        "Key 1"),
    ("nvidia",     "mistralai/ministral-14b-instruct-2512",        "Key 2"),
    ("cloudflare", "@cf/mistralai/mistral-small-3.1-24b-instruct", "Key 1"),
    ("cloudflare", "@cf/mistralai/mistral-small-3.1-24b-instruct", "Key 2"),
    ("nvidia",     "mistralai/mistral-nemotron",                   "Key 1"),
    ("nvidia",     "mistralai/mistral-nemotron",                   "Key 2"),
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
    ("mistral",    "Key 3"): call_single_mistral_r3,
    ("ministral",  "Key 1"): call_single_mistral_r1,
    ("ministral",  "Key 2"): call_single_mistral_r2,
    ("ministral",  "Key 3"): call_single_mistral_r3,
    ("nvidia",     "Key 1"): call_single_nvidia_r1,
    ("nvidia",     "Key 2"): call_single_nvidia_r2,
    ("cloudflare", "Key 1"): call_single_cloudflare_r1,
    ("cloudflare", "Key 2"): call_single_cloudflare_r2,
}

def _get_start_idx(pool_size: int, offset: int = 0) -> int:
    # Seed with current minute so each worker restart in a different minute gets a different guaranteed start slot
    minute_bucket = int(time.time() // 60)
    return (minute_bucket + offset) % pool_size

_pool1_idx = None
_pool2_idx = None
_rr_initialized = False
_rr_init_lock = asyncio.Lock()
_rr_lock = asyncio.Lock()

async def _ensure_rr_initialized():
    global _pool1_idx, _pool2_idx, _rr_initialized
    if _rr_initialized:
        return
    async with _rr_init_lock:
        if _rr_initialized:
            return
        p1_fallback = _get_start_idx(len(POOL_1), offset=0)
        p2_fallback = _get_start_idx(len(POOL_2), offset=7)
        if sc.supabase:
            try:
                res = await asyncio.wait_for(
                    asyncio.to_thread(lambda: sc.supabase.table("rr_counters")
                        .select("name,counter")
                        .in_("name", ["pool_1_global", "pool_2_global"])
                        .execute()),
                    timeout=1.5
                )
                if res.data:
                    for row in res.data:
                        if row["name"] == "pool_1_global":
                            _pool1_idx = int(row["counter"]) % len(POOL_1)
                        elif row["name"] == "pool_2_global":
                            _pool2_idx = int(row["counter"]) % len(POOL_2)
                    print(f"[RR] Resumed from DB — pool1={_pool1_idx}, pool2={_pool2_idx}")
            except Exception as e:
                print(f"[RR] DB load failed, using clock seed: {e}")
        
        if _pool1_idx is None:
            _pool1_idx = p1_fallback
        if _pool2_idx is None:
            _pool2_idx = p2_fallback
        _rr_initialized = True

async def _get_next_rr_index(pool_type: int) -> int:
    """
    Reads current RR index from local memory.
    """
    global _pool1_idx, _pool2_idx
    await _ensure_rr_initialized()
    async with _rr_lock:
        return _pool1_idx if pool_type == 1 else _pool2_idx

async def _advance_rr_index(pool_type: int, pool_size: int, winner_idx: int):
    """
    Advances the round-robin counter to the model after the one that succeeded.
    """
    next_idx = (winner_idx + 1) % pool_size
    
    global _pool1_idx, _pool2_idx
    async with _rr_lock:
        if pool_type == 1:
            _pool1_idx = next_idx
        else:
            _pool2_idx = next_idx

    if sc.supabase:
        counter_name = "pool_1_global" if pool_type == 1 else "pool_2_global"
        async def _persist():
            try:
                await asyncio.wait_for(
                    asyncio.to_thread(lambda: sc.supabase.table("rr_counters")
                        .update({"counter": next_idx})
                        .eq("name", counter_name)
                        .execute()),
                    timeout=0.8
                )
            except Exception:
                pass
        asyncio.create_task(_persist())

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

    return "mistral"  # fallback

async def call_llm_balanced(prompt: str, is_r1: bool, preferred_model: str = "", no_ai_changes: bool = False) -> dict:
    async with _LLM_SEMAPHORE:
        max_tokens = _R1_MAX_TOKENS if is_r1 else _R2_MAX_TOKENS
        all_attempts = []
        
        # 1. Fetch DB tripped keys
        db_tripped_keys = set()
        if sc.supabase:
            try:
                res = await asyncio.wait_for(
                    asyncio.to_thread(lambda: sc.supabase.rpc("get_tripped_circuits").execute()),
                    timeout=0.8
                )
                if res.data:
                    db_tripped_keys = {row["circuit_key"] for row in res.data}
            except Exception:
                pass

        # Build Chain
        chain = []
        is_explicit_preferred = bool(preferred_model and preferred_model != "auto")

        # 1. Explicit Preferred Model Override
        if is_explicit_preferred:
            provider = _get_provider_for_model(preferred_model)
            base_model_id = preferred_model.split("|")[0]
            is_key3 = "|key3" in preferred_model
            is_key2 = "|key2" in preferred_model
            key_label = "Key 3" if is_key3 else ("Key 2" if is_key2 else "Key 1")
            chain.append((provider, base_model_id, key_label))
        else:
            # Universal chain: R1, R2, and Self-Edit all start at DeepSeek
            chain.append(("deepseek", "deepseek-v4-flash", "Key 1"))
            chain.append(("POOL", 1, None))
            chain.append(("POOL", 2, None))

        # Execute Chain
        for item in chain:
            original_pool = None
            pool_type = None
            if item[0] == "POOL":
                pool_type = item[1]
                models = await _get_pool_models(pool_type)
                original_pool = POOL_1 if pool_type == 1 else POOL_2
            else:
                models = [item]

            for provider, model_id, key_label in models:
                circuit_key = f"{provider}_{model_id}_{key_label}"
                
                if is_explicit_preferred and _is_tripped(circuit_key, db_tripped_keys):
                    print(f"[{circuit_key}] Circuit tripped but bypassing — explicit user selection")
                elif not is_explicit_preferred and _is_tripped(circuit_key, db_tripped_keys):
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

    
    if sc.supabase:
        async def _log_failure():
            try:
                await asyncio.to_thread(
                    lambda: sc.supabase.table("llm_usage").insert({
                        "request_type": "all_failed",
                        "provider": "all_failed",
                        "model": "all_failed",
                        "success": False,
                        "speed_secs": 0
                    }).execute()
                )
            except Exception:
                pass
        asyncio.create_task(_log_failure())
    
    return {"success": False, "all_attempts": all_attempts}

def _finalize(result: dict, provider: str, model_id: str, r_type: str) -> dict:
    if sc.supabase and result.get("speed"):
        async def _log_usage():
            try:
                await asyncio.to_thread(
                    lambda: sc.supabase.table("llm_usage").insert({
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
