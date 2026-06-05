import os

FILE_PATH = r"c:\Users\mummi\Downloads\Desktop\Flash Resume Main 6\Flashresume\backend\llm\master_llm_caller.py"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    content = f.read()

old_logic = """        else:
            if is_r1:
                # R1 (Analyze): DeepSeek -> Pool 1 -> Pool 2
                chain.append(("deepseek", "deepseek-v4-flash", call_single_deepseek_r1, "Key 1"))
                chain.extend(await _get_pool_models(1))
                chain.extend(await _get_pool_models(2))
            else:
                # R2 (Generate) & Self-Edit: Pool 1 -> Pool 2 (No DeepSeek)
                chain.extend(await _get_pool_models(1))
                chain.extend(await _get_pool_models(2))

        # Execute Chain
        for provider, model_id, caller, key_label in chain:
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
            all_attempts.extend(result.get("attempts", []))"""

new_logic = """        else:
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
                all_attempts.extend(result.get("attempts", []))"""

if old_logic in content:
    content = content.replace(old_logic, new_logic)
    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: Updated master_llm_caller.py lazy loading")
else:
    print("ERROR: old logic not found!")
