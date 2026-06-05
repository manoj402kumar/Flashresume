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
POOL_1 = [
    # Key 1
    ("mistral", "mistral-medium-3.5", call_single_mistral_r1, "Key 1"),
    ("nvidia", "mistralai/mistral-medium-3.5-128b", call_single_nvidia_r1, "Key 1"),
    ("mistral", "mistral-medium-2604", call_single_mistral_r1, "Key 1"),
    ("nvidia", "meta/llama-4-maverick-17b-128e-instruct", call_single_nvidia_r1, "Key 1"),
    ("mistral", "mistral-medium-latest", call_single_mistral_r1, "Key 1"),
    ("nvidia", "mistralai/mistral-nemotron", call_single_nvidia_r1, "Key 1"),
    # Key 2
    ("mistral", "mistral-medium-3.5", call_single_mistral_r2, "Key 2"),
    ("nvidia", "mistralai/mistral-medium-3.5-128b", call_single_nvidia_r2, "Key 2"),
    ("mistral", "mistral-medium-2604", call_single_mistral_r2, "Key 2"),
    ("nvidia", "meta/llama-4-maverick-17b-128e-instruct", call_single_nvidia_r2, "Key 2"),
    ("mistral", "mistral-medium-latest", call_single_mistral_r2, "Key 2"),
    ("nvidia", "mistralai/mistral-nemotron", call_single_nvidia_r2, "Key 2"),
]

POOL_2 = [
    # Key 1
    ("mistral", "mistral-large-latest", call_single_mistral_r1, "Key 1"),
    ("groq", "llama-3.3-70b-versatile", call_single_groq_r1, "Key 1"),
    ("cloudflare", "@cf/meta/llama-3.3-70b-instruct-fp8-fast", call_single_cloudflare_r1, "Key 1"),
    ("nvidia", "mistralai/ministral-14b-instruct-2512", call_single_nvidia_r1, "Key 1"),
    ("mistral", "ministral-14b-latest", call_single_mistral_r1, "Key 1"),
    ("cloudflare", "@cf/mistralai/mistral-small-3.1-24b-instruct", call_single_cloudflare_r1, "Key 1"),
    ("mistral", "mistral-small-latest", call_single_mistral_r1, "Key 1"),
    # Key 2
    ("mistral", "mistral-large-latest", call_single_mistral_r2, "Key 2"),
    ("groq", "llama-3.3-70b-versatile", call_single_groq_r2, "Key 2"),
    ("cloudflare", "@cf/meta/llama-3.3-70b-instruct-fp8-fast", call_single_cloudflare_r2, "Key 2"),
    ("nvidia", "mistralai/ministral-14b-instruct-2512", call_single_nvidia_r2, "Key 2"),
    ("mistral", "ministral-14b-latest", call_single_mistral_r2, "Key 2"),
    ("cloudflare", "@cf/mistralai/mistral-small-3.1-24b-instruct", call_single_cloudflare_r2, "Key 2"),
    ("mistral", "mistral-small-latest", call_single_mistral_r2, "Key 2"),
]

_pool1_idx = 0
_pool2_idx = 0
_rr_lock = asyncio.Lock()

async def _get_next_rr_index(pool_type: int, pool_size: int) -> int:
    """Atomic counter via Supabase  shared across all workers."""
    counter_name = f"pool_{pool_type}_global"
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
        if result.data is None:
            raise ValueError(f"Supabase RPC returned None for {counter_name}")
        return int(result.data)
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

async def _get_pool_models(pool_type: int) -> list:
    pool = POOL_1 if pool_type == 1 else POOL_2
    idx = await _get_next_rr_index(pool_type, len(pool))
    # Return reordered pool starting at idx
    return pool[idx:] + pool[:idx]

def _get_provider_for_model(model_id: str) -> str:
    base_model_id = model_id.split("|")[0]
    if base_model_id == "deepseek-v4-flash":
        return "deepseek"
    if base_model_id.startswith("@cf/"):
        return "cloudflare"
    if base_model_id.startswith("mistralai/") or base_model_id.startswith("nvidia/") or base_model_id.startswith("meta/"):
        return "nvidia"
        
    _GROQ_MODELS = {
        "llama-3.3-70b-versatile"
    }
    if base_model_id in _GROQ_MODELS:
        return "groq"
        
    return "mistral" # fallback

async def call_llm_balanced(prompt: str, is_r1: bool, preferred_model: str = "", has_credits: bool = False, no_ai_changes: bool = False) -> dict:
    async with _LLM_SEMAPHORE:
        max_tokens = _R1_MAX_TOKENS if is_r1 else _R2_MAX_TOKENS
        all_attempts = []
        
        # Build Chain
        chain = []
        
        # 1. Explicit Preferred Model Override
        if preferred_model and preferred_model != "auto":
            provider = _get_provider_for_model(preferred_model)
            base_model_id = preferred_model.split("|")[0]
            is_key2 = "|key2" in preferred_model
            
            if provider == "deepseek":
                caller = call_single_deepseek_r2 if is_key2 else call_single_deepseek_r1
            elif provider == "cloudflare":
                caller = call_single_cloudflare_r2 if is_key2 else call_single_cloudflare_r1
            elif provider == "groq":
                caller = call_single_groq_r2 if is_key2 else call_single_groq_r1
            elif provider == "nvidia":
                caller = call_single_nvidia_r2 if is_key2 else call_single_nvidia_r1
            else:
                caller = call_single_mistral_r2 if is_key2 else call_single_mistral_r1
                
            key_label = "Key 2" if is_key2 else "Key 1"
            chain.append((provider, base_model_id, caller, key_label))
        else:
            if is_r1:
                # R1 (Analyze): DeepSeek -> Pool 1 -> Pool 2
                chain.append(("deepseek", "deepseek-v4-flash", call_single_deepseek_r1, "Key 1"))
                chain.append(("POOL", 1))
                chain.append(("POOL", 2))
            else:
                # R2 (Generate) & Self-Edit: Pool 1 -> Pool 2 (No DeepSeek)
                chain.append(("POOL", 1))
                chain.append(("POOL", 2))

        # Execute Chain
        for item in chain:
            if item[0] == "POOL":
                pool_type = item[1]
                models = await _get_pool_models(pool_type)
            else:
                models = [item]

            for provider, model_id, caller, key_label in models:
                circuit_key = f"{model_id}_{key_label}"
                if _is_tripped(circuit_key):
                    all_attempts.append({"model": f"{model_id} - {key_label}", "status": "circuit_breaker_active"})
                    continue
                
                result = await caller(model_id, prompt, max_tokens)
                
                if result["success"]:
                    # Attempt to log with key label included for clarity in UI and DB
                    return _finalize(result, provider, f"{model_id} - {key_label}", "r1" if is_r1 else "r2")
                    
                err_type = _get_rate_limit_type(result.get("attempts", []))
                if err_type:
                    _trip_circuit(circuit_key, err_type)
                
                # Format attempts correctly
                for att in result.get("attempts", []):
                    att["model"] = f"{model_id} - {key_label}"
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
