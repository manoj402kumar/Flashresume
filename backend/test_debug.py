import asyncio
import os
import re
from dotenv import load_dotenv

load_dotenv()

def _extract_text(response) -> str | None:
    try:
        text = response.choices[0].message.content
        if text is None:
            print("DEBUG: text is None")
            return None
        print("DEBUG RAW TYPE:", type(text))
        print("DEBUG RAW TEXT:", repr(text))
        text = text.strip()
        if not text:
            print("DEBUG: text is empty after strip")
            return None
        text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            text = match.group(0)
        if len(text.strip()) < 5:
            print("DEBUG: text too short:", len(text.strip()))
            return None
        return text
    except Exception as e:
        print("DEBUG EXTRACT EXCEPTION:", repr(e))
        return None

async def run_test():
    from groq import AsyncGroq
    client = AsyncGroq(api_key=os.getenv("GROQ_R1_API_KEY"), timeout=30)
    prompt = "Please write a simple, short two-sentence story about a cat. This is a test."
    print("Testing Groq openai/gpt-oss-120b...")
    try:
        response = await client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=50,
        )
        print("API CALL SUCCESS")
        text = _extract_text(response)
        print("EXTRACTED TEXT:", text)
    except Exception as e:
        print("API CALL FAILED:", repr(e))

if __name__ == "__main__":
    asyncio.run(run_test())
