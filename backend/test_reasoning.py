import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def run_test():
    from groq import AsyncGroq
    client = AsyncGroq(api_key=os.getenv("GROQ_R1_API_KEY"), timeout=30)
    prompt = "What is 2+2?"
    
    print("Testing Groq without extra_body:")
    try:
        response = await client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=100,
            temperature=0.2,
        )
        print("Success without extra_body.")
    except Exception as e:
        print("Failed without:", e)

    print("\nTesting Groq with extra_body:")
    try:
        response = await client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=100,
            temperature=0.2,
            extra_body={"thinking": {"type": "disabled"}}
        )
        print("Success with extra_body.")
    except Exception as e:
        print("Failed with:", e)

if __name__ == "__main__":
    asyncio.run(run_test())
