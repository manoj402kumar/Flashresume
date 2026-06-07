import os
import sys
import asyncio
import httpx
from dotenv import load_dotenv

load_dotenv()

async def test_qwen():
    api_key = os.getenv("NVIDIA_R1_API_KEY")
    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    # Simulate a large prompt
    prompt = "This is a test prompt. " * 2000 
    
    payload = {
        "model": "qwen/qwen3.5-122b-a10b",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_tokens": 2500
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=payload, timeout=30.0)
        print(f"Status: {response.status_code}")
        print(f"Body: {response.text}")

if __name__ == "__main__":
    asyncio.run(test_qwen())
