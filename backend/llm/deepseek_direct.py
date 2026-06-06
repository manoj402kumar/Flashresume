import os
import re
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

print(f"[DeepSeek] API Key loaded: {'YES' if os.getenv('DEEPSEEK_API_KEY') else '❌ MISSING'}")

# -------------------------------------------------------------------
# DeepSeek API Client
# URL: https://api.deepseek.com/v1
# -------------------------------------------------------------------
_BASE_URL = "https://api.deepseek.com/v1"

_client = None

def _get_client():
    global _client
    if _client is None:
        from openai import AsyncOpenAI
        api_key = os.getenv("DEEPSEEK_API_KEY")
        if not api_key:
            return None
        _client = AsyncOpenAI(base_url=_BASE_URL, api_key=api_key, timeout=90)
    return _client

def _extract_text(response) -> str | None:
    """Safely pull text from the OpenAI-compatible response.
       The official OpenAI client automatically separates message.reasoning_content from message.content,
       but we include defensive stripping just in case.
    """
    try:
        text = response.choices[0].message.content
        if text is None:
            return None
        text = text.strip()
        if not text:
            return None
        
        # Remove reasoning block if present defensively
        text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()
        if not text:
            return None
            
        return text
    except (AttributeError, IndexError, TypeError):
        return None

async def _call_deepseek_single(client_getter, model: str, prompt: str, max_tokens: int) -> dict:
    import time
    client = client_getter()
    if not client:
        return {"success": False, "text": None, "model": model, "speed": None, "attempts": [{"model": model, "status": "missing_api_key"}]}
    
    attempts = []
    retries = 0
    
    for attempt in range(retries + 1):
        try:
            start_time = time.time()
            response = await client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens,
                temperature=0.2,
                extra_body={
                    "thinking": {"type": "disabled"}
                }
            )
            elapsed = round(time.time() - start_time, 2)
            text = _extract_text(response)
            
            if text:
                return {"success": True, "text": text, "model": model, "speed": elapsed, "attempts": attempts}
            else:
                attempts.append({"model": model, "status": "empty_or_null_response"})
                break
        except Exception as e:
            err = str(e)
            attempts.append({"model": model, "status": err[:80]})
            
            # Fast fail conditions
            if any(x in err for x in ["429", "rate_limit", "rate limit", "too many requests", "RESOURCE_EXHAUSTED", "402", "Payment Required"]):
                break
            if any(x in err for x in ["404", "model_not_found", "does not exist", "No such model"]):
                break
            if any(x in err for x in ["401", "403", "invalid_api_key", "Unauthorized", "authentication"]):
                break
            if "context_length_exceeded" in err or "maximum context" in err.lower():
                break

            # Retry conditions
            if any(x in err for x in ["503", "500", "502", "overloaded", "capacity"]):
                if attempt < retries:
                    import asyncio
                    await asyncio.sleep(1)
                continue
            if "timeout" in err.lower() or "timed out" in err.lower():
                if attempt < retries:
                    import asyncio
                    await asyncio.sleep(1)
                continue
            break

    return {"success": False, "text": None, "model": None, "speed": None, "attempts": attempts}

async def call_single_deepseek_r1(model: str, prompt: str, max_tokens: int = 8000) -> dict:
    """Call a DeepSeek model for R1 (Analysis)."""
    return await _call_deepseek_single(_get_client, model, prompt, max_tokens)

async def call_single_deepseek_r2(model: str, prompt: str, max_tokens: int = 8000) -> dict:
    """Call a DeepSeek model for R2 (Generation)."""
    return await _call_deepseek_single(_get_client, model, prompt, max_tokens)
