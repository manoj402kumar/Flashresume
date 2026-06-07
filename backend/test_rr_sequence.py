import asyncio
import httpx
import time
import os
from dotenv import load_dotenv

load_dotenv()

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
    
    print(f"Request {req_num}: Sending...", end=" ")
    start = time.time()
    try:
        resp = await client.post(url, json=payload, timeout=120.0)
        elapsed = time.time() - start
        if resp.status_code == 200:
            data = resp.json()
            model_used = data.get("_model_used", "Unknown")
            print(f"SUCCESS in {elapsed:.2f}s | _model_used: {model_used}")
        else:
            print(f"FAILED in {elapsed:.2f}s | Status: {resp.status_code} | {resp.text[:100]}")
    except Exception as e:
        print(f"ERROR | {type(e).__name__} - {e}")

async def main():
    try:
        from supabase import create_client, Client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_KEY")
        if url and key:
            sb: Client = create_client(url, key)
            result = sb.rpc("increment_rr_counter", {"p_counter_name": "pool_1_global", "p_pool_size": 12}).execute()
            print(f"Supabase RPC Starting Index: {result.data} (Test script consumed this index, first API call will use the NEXT one!)")
        else:
            print("Supabase credentials missing.")
    except Exception as e:
        print(f"Could not fetch Supabase starting index: {e}")
        
    print("\nStarting sequential requests to test round-robin logic...\n")
    
    async with httpx.AsyncClient() as client:
        # Send 12 requests sequentially
        for i in range(1, 13):
            await send_request(client, i)

if __name__ == "__main__":
    asyncio.run(main())
