import asyncio
import time
import itertools
from supabase_client import supabase
from .mistral_fallback    import call_single_mistral_r1,    call_single_mistral_r2
from .groq_fallback       import call_single_groq_r1,       call_single_groq_r2
from .nvidia_fallback     import call_single_nvidia_r1,     call_single_nvidia_r2

# ── Concurrency guard ────────────────────────────────────────────────────────
# Limits simultaneous LLM operations to 8 per worker process.
_LLM_SEMAPHORE = asyncio.Semaphore(5)
# ─────────────────────────────────────────────────────────────────────────────

_R1_MAX_TOKENS = 2500
_R2_MAX_TOKENS = 4500

# ── Per-Model Circuit Breaker State ───────────────────────────────
_COOLDOWN_SECS_429 = 120
_COOLDOWN_SECS_402 = 86400  # 24 hours for quota exhaustion
_circuit_tripped = {}  # model_id -> (timestamp, cooldown_secs)

def _is_tripped(model_id: str) -> bool:
    """Return True if model is in cooldown window."""
    tripped_info = _circuit_tripped.get(model_id)
    if tripped_info is None:
        return False
    tripped_at, cooldown = tripped_info
    if time.time() - tripped_at < cooldown:
        return True
    del _circuit_tripped[model_id]
    return False

def _trip_circuit(model_id: str, error_type: str):
    """Mark a model as rate-limited."""
    cooldown = _COOLDOWN_SECS_402 if error_type == "quota" else _COOLDOWN_SECS_429
    _circuit_tripped[model_id] = (time.time(), cooldown)

# ── TOP PREFERRED MODELS — Round-Robin Pools ─────────────────────
_RR_POOL_R1 = [
    ("mistral", "mistral-large-latest",                        call_single_mistral_r1),
    ("groq",    "llama-3.3-70b-versatile",                     call_single_groq_r1),
    ("nvidia",  "mistralai/mistral-medium-3.5-128b",           call_single_nvidia_r1),
    ("nvidia",  "mistralai/mistral-nemotron",                  call_single_nvidia_r1),
]

_RR_POOL_R2 = [
    ("mistral", "mistral-large-latest",                        call_single_mistral_r2),
    ("groq",    "llama-3.3-70b-versatile",                     call_single_groq_r2),
    ("nvidia",  "mistralai/mistral-medium-3.5-128b",           call_single_nvidia_r2),
    ("nvidia",  "mistralai/mistral-nemotron",                  call_single_nvidia_r2),
]

_rr_counter_r1 = 0
_rr_counter_r2 = 0

async def _get_next_rr_index_r1() -> int:
    """Atomic counter via Supabase — shared across all workers."""
    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(
                lambda: supabase.rpc("increment_rr_counter", {
                    "p_counter_name": "r1",
                    "p_pool_size": len(_RR_POOL_R1)
                }).execute()
            ),
            timeout=0.8
        )
        return result.data
    except Exception:
        # Fallback to local counter if Supabase is down or slow
        global _rr_counter_r1
        idx = _rr_counter_r1 % len(_RR_POOL_R1)
        _rr_counter_r1 += 1
        return idx

async def _get_next_rr_index_r2() -> int:
    """Atomic counter via Supabase — shared across all workers."""
    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(
                lambda: supabase.rpc("increment_rr_counter", {
                    "p_counter_name": "r2",
                    "p_pool_size": len(_RR_POOL_R2)
                }).execute()
            ),
            timeout=0.8
        )
        return result.data
    except Exception:
        # Fallback to local counter if Supabase is down or slow
        global _rr_counter_r2
        idx = _rr_counter_r2 % len(_RR_POOL_R2)
        _rr_counter_r2 += 1
        return idx

# -----------------------------------------------------------------------------
# FLAT CHAINS (Fallback if all pool models trip)
# -----------------------------------------------------------------------------
_R1_FLAT = [
    ("mistral",    "mistral-large-latest",                        call_single_mistral_r1),
    ("groq",       "llama-3.3-70b-versatile",                     call_single_groq_r1),
    ("nvidia",     "mistralai/mistral-medium-3.5-128b",           call_single_nvidia_r1),
    ("nvidia",     "mistralai/mistral-nemotron",                  call_single_nvidia_r1),
    ("mistral",    "mistral-medium-latest",                       call_single_mistral_r1),
    ("nvidia",     "mistralai/ministral-14b-instruct-2512",       call_single_nvidia_r1),
    ("mistral",    "ministral-8b-latest",                         call_single_mistral_r1),
    ("nvidia",     "mistralai/mixtral-8x22b-instruct-v0.1",       call_single_nvidia_r1),
    ("groq",       "meta-llama/llama-4-scout-17b-16e-instruct",   call_single_groq_r1),
    ("mistral",    "mistral-small-latest",                        call_single_mistral_r1),
    ("nvidia",     "mistralai/mistral-small-4-119b-2603",         call_single_nvidia_r1),
    ("mistral",    "mistral-tiny-latest",                         call_single_mistral_r1),
    ("mistral",    "open-mistral-nemo",                           call_single_mistral_r1),
]

_R2_FLAT = [
    ("mistral",    "mistral-large-latest",                        call_single_mistral_r2),
    ("groq",       "llama-3.3-70b-versatile",                     call_single_groq_r2),
    ("nvidia",     "mistralai/mistral-medium-3.5-128b",           call_single_nvidia_r2),
    ("nvidia",     "mistralai/mistral-nemotron",                  call_single_nvidia_r2),
    ("mistral",    "mistral-medium-latest",                       call_single_mistral_r2),
    ("nvidia",     "mistralai/ministral-14b-instruct-2512",       call_single_nvidia_r2),
    ("mistral",    "ministral-8b-latest",                         call_single_mistral_r2),
    ("nvidia",     "mistralai/mixtral-8x22b-instruct-v0.1",       call_single_nvidia_r2),
    ("groq",       "meta-llama/llama-4-scout-17b-16e-instruct",   call_single_groq_r2),
    ("mistral",    "mistral-small-latest",                        call_single_mistral_r2),
    ("nvidia",     "mistralai/mistral-small-4-119b-2603",         call_single_nvidia_r2),
    ("mistral",    "mistral-tiny-latest",                         call_single_mistral_r2),
    ("mistral",    "open-mistral-nemo",                           call_single_mistral_r2),
]

_RATE_LIMIT_SIGNALS = ("429", "rate_limit", "rate limit", "too many requests", "RESOURCE_EXHAUSTED", "rate limited")
_QUOTA_SIGNALS = ("402", "quota", "payment required", "payment_required")

def _get_rate_limit_type(attempts: list) -> str | None:
    if not attempts: return None
    last_status = str(attempts[-1].get("status", "")).lower()
    if any(sig in last_status for sig in _QUOTA_SIGNALS): return "quota"
    if any(sig in last_status for sig in _RATE_LIMIT_SIGNALS): return "rate_limit"
    return None

async def _run_flat_chain(prompt: str, flat_chain: list, max_tokens: int, preferred_model: str = "") -> dict:
    all_attempts = []
    
    start_index = 0
    if preferred_model:
        for i, (_, model_id, _) in enumerate(flat_chain):
            if model_id == preferred_model:
                start_index = i
                break

    for provider_name, model_id, caller in flat_chain[start_index:]:
        if _is_tripped(model_id):
            all_attempts.append({"model": model_id, "status": "circuit-tripped — cooldown active"})
            continue

        result = await caller(model_id, prompt, max_tokens)
        all_attempts.extend(result.get("attempts", []))

        if result["success"]:
            return {
                "success": True,
                "text": result["text"],
                "model": result["model"],
                "provider": provider_name,
                "speed": result["speed"],
                "all_attempts": all_attempts,
            }

        err_type = _get_rate_limit_type(result.get("attempts", []))
        if err_type:
            _trip_circuit(model_id, err_type)

    return {
        "success": False,
        "text": None,
        "model": None,
        "provider": None,
        "speed": None,
        "all_attempts": all_attempts,
    }

async def _log_to_supabase(request_type: str, result: dict):
    if supabase and result.get("provider"):
        try:
            await asyncio.to_thread(
                lambda: supabase.table("llm_usage").insert({
                    "request_type": request_type,
                    "provider": result["provider"],
                    "model": result["model"],
                    "success": result["success"],
                    "speed_secs": result["speed"]
                }).execute()
            )
        except Exception:
            pass

async def call_llm_balanced(prompt: str, is_r1: bool, preferred_model: str = "") -> dict:
    pool = _RR_POOL_R1 if is_r1 else _RR_POOL_R2
    flat_chain = _R1_FLAT if is_r1 else _R2_FLAT
    max_tokens = _R1_MAX_TOKENS if is_r1 else _R2_MAX_TOKENS
    req_type = "r1" if is_r1 else "r2"
    
    async with _LLM_SEMAPHORE:
        all_attempts = []
        
        # 1. Preferred model first
        if preferred_model:
            for provider, model_id, caller in pool:
                if model_id == preferred_model:
                    if not _is_tripped(model_id):
                        result = await caller(model_id, prompt, max_tokens)
                        all_attempts.extend(result.get("attempts", []))
                        if result["success"]:
                            res_dict = {
                                "success": True,
                                "text": result["text"],
                                "model": result["model"],
                                "provider": provider,
                                "speed": result["speed"],
                                "all_attempts": all_attempts,
                            }
                            asyncio.create_task(_log_to_supabase(req_type, res_dict))
                            return res_dict
                        
                        err_type = _get_rate_limit_type(result.get("attempts", []))
                        if err_type:
                            _trip_circuit(model_id, err_type)
                    break

        # 2. Round-Robin through pool
        start_idx = await _get_next_rr_index_r1() if is_r1 else await _get_next_rr_index_r2()
        pool_size = len(pool)
        
        for i in range(pool_size):
            idx = (start_idx + i) % pool_size
            provider, model_id, caller = pool[idx]
            
            if _is_tripped(model_id):
                all_attempts.append({"model": model_id, "status": "circuit-tripped — cooldown active"})
                continue
                
            result = await caller(model_id, prompt, max_tokens)
            all_attempts.extend(result.get("attempts", []))
            
            if result["success"]:
                res_dict = {
                    "success": True,
                    "text": result["text"],
                    "model": result["model"],
                    "provider": provider,
                    "speed": result["speed"],
                    "all_attempts": all_attempts,
                }
                asyncio.create_task(_log_to_supabase(req_type, res_dict))
                return res_dict
                
            err_type = _get_rate_limit_type(result.get("attempts", []))
            if err_type:
                _trip_circuit(model_id, err_type)
                
        # 3. Fallback to flat chain
        # Note: _run_flat_chain doesn't acquire _LLM_SEMAPHORE since we already have it
        result = await _run_flat_chain(prompt, flat_chain, max_tokens)
        result["all_attempts"] = all_attempts + result.get("all_attempts", [])
        
    asyncio.create_task(_log_to_supabase(req_type, result))
    return result

async def call_llm_r1(prompt: str, preferred_model: str = "") -> dict:
    return await call_llm_balanced(prompt, True, preferred_model)

async def call_llm_r2(prompt: str, preferred_model: str = "") -> dict:
    return await call_llm_balanced(prompt, False, preferred_model)
