import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def test_groq():
    from groq import AsyncGroq
    client = AsyncGroq(api_key=os.getenv("GROQ_R1_API_KEY"), timeout=15)
    prompt = "Hello. Respond with OK."
    models = [
        "llama-3.3-70b-versatile",
        "meta-llama/llama-4-scout-17b-16e-instruct",
        "llama-3.1-8b-instant"
    ]
    for model in models:
        try:
            res = await client.chat.completions.create(model=model, messages=[{"role": "user", "content": prompt}], max_tokens=50)
            print(f"[Groq] {model}: SUCCESS")
        except Exception as e:
            print(f"[Groq] {model}: FAILED - {e}")

async def test_nvidia():
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=os.getenv("NVIDIA_R1_API_KEY"), base_url="https://integrate.api.nvidia.com/v1", timeout=15)
    prompt = "Hello. Respond with OK."
    models = [
        "meta/llama-3.3-70b-instruct",
        "meta/llama-4-maverick-17b-128e-instruct",
        "mistralai/mistral-large-2-instruct",
        "mistralai/mistral-medium-3.5-128b",
        "mistralai/mistral-nemotron",
        "mistralai/ministral-14b-instruct-2512",
        "meta/llama-3.1-8b-instruct",
        "meta/llama-3.2-3b-instruct",
        "mistralai/mistral-7b-instruct-v0.3"
    ]
    for model in models:
        try:
            res = await client.chat.completions.create(model=model, messages=[{"role": "user", "content": prompt}], max_tokens=50)
            print(f"[NVIDIA] {model}: SUCCESS")
        except Exception as e:
            print(f"[NVIDIA] {model}: FAILED - {e}")

async def test_cf():
    from openai import AsyncOpenAI
    account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID")
    api_key = os.getenv("CLOUDFLARE_R1_API_KEY")
    if not account_id or not api_key:
        print("[CF] Keys missing")
        return
    client = AsyncOpenAI(api_key=api_key, base_url=f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1", timeout=15)
    prompt = "Hello. Respond with OK."
    models = [
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        "@cf/qwen/qwen2.5-coder-32b-instruct",
        "@cf/mistralai/mistral-small-3.1-24b-instruct"
    ]
    for model in models:
        try:
            res = await client.chat.completions.create(model=model, messages=[{"role": "user", "content": prompt}], max_tokens=50)
            print(f"[CF] {model}: SUCCESS ({len(res.choices)})")
        except Exception as e:
            print(f"[CF] {model}: FAILED - {e}")

async def main():
    await test_groq()
    print("-" * 20)
    await test_nvidia()
    print("-" * 20)
    await test_cf()

if __name__ == "__main__":
    asyncio.run(main())
