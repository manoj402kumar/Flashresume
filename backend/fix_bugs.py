FILE_PATH = r"c:\Users\mummi\Downloads\Desktop\Flash Resume Main 6\Flashresume\backend\llm\master_llm_caller.py"

with open(FILE_PATH, "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()

# Fix 1: Circuit breaker logic
old_loop = """        for provider, model_id, caller, key_label in chain:
            if _is_tripped(model_id):
                all_attempts.append({"model": f"{model_id} - {key_label}", "status": "circuit_breaker_active"})
                continue
            
            result = await caller(model_id, prompt, max_tokens)
            
            if result["success"]:
                # Attempt to log with key label included for clarity in UI and DB
                return _finalize(result, provider, f"{model_id} - {key_label}", "r1" if is_r1 else "r2")
                
            err_type = _get_rate_limit_type(result.get("attempts", []))
            if err_type:
                _trip_circuit(model_id, err_type)"""

new_loop = """        for provider, model_id, caller, key_label in chain:
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
                _trip_circuit(circuit_key, err_type)"""

content = content.replace(old_loop, new_loop)

# Fix 2: GROQ Models
old_groq = """    _GROQ_MODELS = {
        "llama-3.3-70b-versatile",
        "meta-llama/llama-4-scout-17b-16e-instruct",
        "qwen/qwen3-32b",
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "llama-3.1-8b-instant",
        "groq/compound",
        "groq/compound-mini",
        "allam-2-7b",
        "openai/gpt-oss-safeguard-20b"
    }"""

new_groq = """    _GROQ_MODELS = {
        "llama-3.3-70b-versatile"
    }"""

content = content.replace(old_groq, new_groq)

with open(FILE_PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("SUCCESS")
