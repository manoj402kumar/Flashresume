import asyncio
import httpx
import time

async def send_request(client, req_num):
    url = "http://127.0.0.1:8000/api/generate"
    payload = {
        "resume_text": "Software Engineer with 2 years of experience.",
        "job_description": "We need a Software Engineer.",
        "ats_score_before": 50,
        "missing_keywords": ["python"],
        "no_ai_changes": False,
        "preferred_model": "auto" # Force auto to test round robin pool
    }
    
    print(f"Request {req_num}: Sending...")
    start = time.time()
    try:
        resp = await client.post(url, json=payload, timeout=120.0)
        elapsed = time.time() - start
        if resp.status_code == 200:
            data = resp.json()
            model_used = data.get("model_used", "Unknown")
            print(f"Request {req_num}: SUCCESS in {elapsed:.2f}s | Model Used: {model_used}")
        else:
            print(f"Request {req_num}: FAILED in {elapsed:.2f}s | Status: {resp.status_code} | {resp.text[:100]}")
    except Exception as e:
        print(f"Request {req_num}: ERROR | {type(e).__name__} - {e}")

async def main():
    async with httpx.AsyncClient() as client:
        print("Starting sequential requests to test round-robin logic...\n")
        # Send 8 requests sequentially
        for i in range(1, 9):
            await send_request(client, i)

if __name__ == "__main__":
    asyncio.run(main())
