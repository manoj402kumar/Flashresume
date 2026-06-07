import os
import asyncio
import httpx
from dotenv import load_dotenv

load_dotenv()

MISTRAL_KEY = os.getenv("MISTRAL_R1_API_KEY")
GROQ_KEY = os.getenv("GROQ_R1_API_KEY")
CF_TOKEN = os.getenv("CLOUDFLARE_R1_API_TOKEN")
CF_ACC = os.getenv("CLOUDFLARE_R1_ACCOUNT_ID")
NVIDIA_KEY = os.getenv("NVIDIA_R1_API_KEY")

PROVIDERS = {
    "Mistral": {
        "url": "https://api.mistral.ai/v1/chat/completions",
        "headers": {"Authorization": f"Bearer {MISTRAL_KEY}", "Content-Type": "application/json"},
        "models": [
            "mistral-large-latest",
            "mistral-medium-latest",
            "mistral-medium-3.5",
            "mistral-medium-2604",
            "ministral-14b-latest",
            "mistral-small-latest"
        ]
    },
    "Groq": {
        "url": "https://api.groq.com/openai/v1/chat/completions",
        "headers": {"Authorization": f"Bearer {GROQ_KEY}", "Content-Type": "application/json"},
        "models": [
            "llama-3.3-70b-versatile"
        ]
    },
    "Cloudflare": {
        "url": f"https://api.cloudflare.com/client/v4/accounts/{CF_ACC}/ai/v1/chat/completions",
        "headers": {"Authorization": f"Bearer {CF_TOKEN}", "Content-Type": "application/json"},
        "models": [
            "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
            "@cf/mistralai/mistral-small-3.1-24b-instruct"
        ]
    },
    "NVIDIA": {
        "url": "https://integrate.api.nvidia.com/v1/chat/completions",
        "headers": {"Authorization": f"Bearer {NVIDIA_KEY}", "Content-Type": "application/json"},
        "models": [

            "mistralai/mistral-medium-3.5-128b",
            "mistralai/mistral-nemotron",
            "mistralai/ministral-14b-instruct-2512"
        ]
    }
}

async def test_model(client, provider_name, provider_data, model):
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": "Say 'hello' in one word."}],
        "max_tokens": 10
    }
    print(f"Testing [{provider_name}] {model} ...", end=" ", flush=True)
    try:
        resp = await client.post(provider_data["url"], headers=provider_data["headers"], json=payload)
        if resp.status_code == 200:
            print("[SUCCESS]")
        else:
            print(f"[FAILED] {resp.status_code} - {resp.text[:100]}")
    except Exception as e:
        print(f"[ERROR] {type(e).__name__} - {str(e)}")

async def main():
    # Use timeout=10s so hanging models fail fast
    async with httpx.AsyncClient(timeout=10.0) as client:
        for provider_name, provider_data in PROVIDERS.items():
            print(f"\n--- Testing {provider_name} ---")
            for model in provider_data["models"]:
                await test_model(client, provider_name, provider_data, model)

if __name__ == "__main__":
    asyncio.run(main())
