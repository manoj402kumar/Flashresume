import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def run_test():
    from groq import AsyncGroq
    client = AsyncGroq(api_key=os.getenv("GROQ_R1_API_KEY"), timeout=30)
    
    # Simulate a large prompt (R2 prompt is around 3000-4000 tokens)
    prompt = "This is a dummy prompt to test 413 errors on Groq. " * 500
    
    models_to_test = ["llama-3.3-70b-versatile", "qwen/qwen3-32b", "openai/gpt-oss-120b"]
    max_tokens_to_test = [4096, 2500, 1500]
    
    for model in models_to_test:
        print(f"\nTesting model: {model}")
        for mt in max_tokens_to_test:
            try:
                response = await client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=mt,
                    temperature=0.1,
                )
                print(f"  max_tokens={mt}: SUCCESS (output length: {len(str(response))})")
            except Exception as e:
                print(f"  max_tokens={mt}: FAILED - {e}")

if __name__ == "__main__":
    asyncio.run(run_test())
