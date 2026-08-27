import asyncio
import httpx
import json

async def run_e2e():
    base_url = "http://localhost:8000/api"
    payload = {
        "resume_text": "Sample software engineer resume...",
        "job_description": "Software engineer role...",
        "ats_score_before": 50
    }
    
    async with httpx.AsyncClient() as client:
        resp = await client.post(f"{base_url}/generate", json=payload)
        assert resp.status_code == 202
        job_id = resp.json()["job_id"]
        print(f"Job created: {job_id}")
        
        async with client.stream("GET", f"{base_url}/jobs/{job_id}/stream") as stream:
            async for line in stream.aiter_lines():
                if line:
                    print("SSE:", line)

asyncio.run(run_e2e())
