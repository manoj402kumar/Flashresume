import asyncio
import time
from .deepseek_direct import call_single_deepseek_r1, call_single_deepseek_r2
from .mistral_fallback import call_single_mistral_r1, call_single_mistral_r2
from .groq_fallback import call_single_groq_r1, call_single_groq_r2
from .nvidia_fallback import call_single_nvidia_r1, call_single_nvidia_r2
from supabase_client import supabase

_LLM_SEMAPHORE = asyncio.Semaphore(5)

_R1_MAX_TOKENS = 8000
_R2_MAX_TOKENS = 8000

_COOLDOWN_SECS_429 = 120
_COOLDOWN_SECS_402 = 86400
_circuit_tripped = {}

def _trip_circuit(model_id: str, error_type: str):
    cooldown = _COOLDOWN_SECS_429 if error_type == "429" else _COOLDOWN_SECS_402
    print(f"[{model_id}] Circuit tripped ({error_type}). Cooling down for {cooldown}s.")
    _circuit_tripped[model_id] = time.time() + cooldown

def _is_tripped(model_id: str) -> bool:
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
    return None

# POOLS
POOL_1_R1 = [
    ("mistral", "mistral-large-latest", call_single_mistral_r1),
    ("groq", "llama-3.3-70b-versatile", call_single_groq_r1),
    ("nvidia", "mistralai/mistral-medium-3.5-128b", call_single_nvidia_r1),
]

POOL_2_R1 = [
    ("nvidia", "mistralai/mistral-nemotron", call_single_nvidia_r1),
    ("mistral", "mistral-medium-latest", call_single_mistral_r1),
    ("nvidia", "mistralai/ministral-14b-instruct-2512", call_single_nvidia_r1),
]

POOL_1_R2 = [
    ("mistral", "mistral-large-latest", call_single_mistral_r2),
    ("groq", "llama-3.3-70b-versatile", call_single_groq_r2),
    ("nvidia", "mistralai/mistral-medium-3.5-128b", call_single_nvidia_r2),
]

POOL_2_R2 = [
    ("nvidia", "mistralai/mistral-nemotron", call_single_nvidia_r2),
    ("mistral", "mistral-medium-latest", call_single_mistral_r2),
    ("nvidia", "mistralai/ministral-14b-instruct-2512", call_single_nvidia_r2),
]

_pool1_idx = 0
_pool2_idx = 0
_rr_lock = asyncio.Lock()

async def _get_next_rr_index(pool_type: int, pool_size: int) -> int:
    """Atomic counter via Supabase — shared across all workers, prevents Render cold-start resets."""
    counter_name = f"pool_{pool_type}"
    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(
                lambda: supabase.rpc("increment_rr_counter", {
                    "p_counter_name": counter_name,
                    "p_pool_size": pool_size
                }).execute()
            ),
            timeout=0.8
        )
        return result.data
    except Exception:
        # Fallback to local lock if Supabase is down or slow
        global _pool1_idx, _pool2_idx
        async with _rr_lock:
            if pool_type == 1:
                idx = _pool1_idx
                _pool1_idx = (_pool1_idx + 1) % pool_size
            else:
                idx = _pool2_idx
                _pool2_idx = (_pool2_idx + 1) % pool_size
        return idx

async def _get_pool_models(pool_type: int, is_r1: bool) -> list:
    pool = (POOL_1_R1 if is_r1 else POOL_1_R2) if pool_type == 1 else (POOL_2_R1 if is_r1 else POOL_2_R2)
    idx = await _get_next_rr_index(pool_type, len(pool))
    
    # Return reordered pool starting at idx
    return pool[idx:] + pool[:idx]

async def call_llm_balanced(prompt: str, is_r1: bool, preferred_model: str = "", has_credits: bool = False, no_ai_changes: bool = False) -> dict:
    async with _LLM_SEMAPHORE:
        max_tokens = _R1_MAX_TOKENS if is_r1 else _R2_MAX_TOKENS
        all_attempts = []
        
        # Build Chain
        chain = []
        
        # 1. Explicit Preferred Model Override (e.g., from Dropdown for testing)
        if preferred_model:
            if preferred_model == "deepseek-v4-flash":
                deepseek_caller = call_single_deepseek_r1 if is_r1 else call_single_deepseek_r2
                chain.append(("deepseek", "deepseek-v4-flash", deepseek_caller))
            else:
                pools = POOL_1_R1 + POOL_2_R1 if is_r1 else POOL_1_R2 + POOL_2_R2
                for provider, model_id, caller in pools:
                    if preferred_model == model_id:
                        chain.append((provider, model_id, caller))
                        break

        if is_r1:
            # R1 (Analyze): ALWAYS DeepSeek -> Pool 1 -> Pool 2 (regardless of credits)
            deepseek_caller = call_single_deepseek_r1
            chain.append(("deepseek", "deepseek-v4-flash", deepseek_caller))
            chain.extend(await _get_pool_models(1, True))
            chain.extend(await _get_pool_models(2, True))
        else:
            # R2 (Generate)
            if no_ai_changes:
                # Self-edit: Pool 1 -> Pool 2 (cost optimization, no premium inference needed)
                chain.extend(await _get_pool_models(1, False))
                chain.extend(await _get_pool_models(2, False))
            elif has_credits:
                # Paid User Gen: DeepSeek -> Pool 1 -> Pool 2
                deepseek_caller = call_single_deepseek_r2
                chain.append(("deepseek", "deepseek-v4-flash", deepseek_caller))
                chain.extend(await _get_pool_models(1, False))
                chain.extend(await _get_pool_models(2, False))
            else:
                # Free User Gen: Pool 1 -> Pool 2
                chain.extend(await _get_pool_models(1, False))
                chain.extend(await _get_pool_models(2, False))

        # Execute Chain
        for provider, model_id, caller in chain:
            if _is_tripped(model_id):
                all_attempts.append({"model": model_id, "status": "circuit_breaker_active"})
                continue
            
            result = await caller(model_id, prompt, max_tokens)
            
            if result["success"]:
                return _finalize(result, provider, model_id, "r1" if is_r1 else "r2")
                
            err_type = _get_rate_limit_type(result.get("attempts", []))
            if err_type:
                _trip_circuit(model_id, err_type)
            
            all_attempts.extend(result.get("attempts", []))

        return {"success": False, "all_attempts": all_attempts}

def _finalize(result: dict, provider: str, model_id: str, r_type: str) -> dict:
    if supabase and result.get("speed"):
        import asyncio
        asyncio.create_task(asyncio.to_thread(
            lambda: supabase.table("llm_usage").insert({
                "request_type": r_type,
                "provider": provider,
                "model": model_id,
                "success": True,
                "speed_secs": result["speed"]
            }).execute()
        ))
    return {"success": True, "text": result["text"], "_model_used": model_id}

async def call_llm_r1(prompt: str, preferred_model: str = "", has_credits: bool = False) -> dict:
    return await call_llm_balanced(prompt, True, preferred_model, has_credits)

async def call_llm_r2(prompt: str, preferred_model: str = "", has_credits: bool = False, no_ai_changes: bool = False) -> dict:
    return await call_llm_balanced(prompt, False, preferred_model, has_credits, no_ai_changes)
