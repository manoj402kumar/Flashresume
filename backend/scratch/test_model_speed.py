import sys
import os

# Add the backend directory to sys.path so we can import from llm
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import asyncio
import time
from llm.nvidia_fallback import call_single_nvidia_r1

prompt = """
You are an expert resume writer. Please rewrite the following resume bullet point to make it more impactful and ATS-friendly.
Format the output EXACTLY as valid JSON matching this schema:
{
    "rewritten_bullet": "string"
}

Original Bullet: Worked on a python backend using fastapi and redis that made things faster.
"""

async def test_model(model_id):
    print(f"\n--- Testing {model_id} ---")
    start = time.time()
    try:
        result = await call_single_nvidia_r1(model_id, prompt, max_tokens=500)
        elapsed = time.time() - start
        
        print(f"Time Taken: {elapsed:.2f} seconds")
        print(f"Success: {result['success']}")
        if result['success']:
            print(f"Output Preview: {result['text'][:150]}...")
        else:
            print(f"Failed. Attempts: {result.get('attempts')}")
    except Exception as e:
        print(f"Exception: {e}")

async def main():
    models = [
        "nvidia/llama-3.3-nemotron-super-49b-v1.5",
        "nvidia/llama-3.3-nemotron-super-49b-v1",
        "mistralai/mixtral-8x22b-v0.1",
        "qwen/qwen3.5-122b-a10b"
    ]
    for model in models:
        await test_model(model)

if __name__ == "__main__":
    asyncio.run(main())
