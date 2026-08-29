import asyncio
import httpx
from redis import asyncio as aioredis
import json
import uuid

async def test():
    redis = aioredis.from_url("redis://localhost:6379")
    job_id = str(uuid.uuid4())
    ticket = str(uuid.uuid4())
    
    job_data = {
        "id": job_id,
        "type": "analyze_resume",
        "payload": json.dumps({"resume_text": "hello"}),
        "status": "QUEUED",
        "user_id": "test_user"
    }
    await redis.hset(f"job:data:{job_id}", mapping=job_data)
    await redis.set(f"sse_ticket:{ticket}", json.dumps({"user_id": "test_user", "job_id": job_id}), ex=60)
    
    url = f"http://localhost:8000/api/jobs/{job_id}/stream?ticket={ticket}"
    print(f"Requesting: {url}")
    
    async with httpx.AsyncClient() as client:
        try:
            async with client.stream("GET", url) as response:
                print(f"HTTP Status: {response.status_code}")
                async for chunk in response.aiter_bytes():
                    print("Chunk:", chunk)
                    # wait 2 seconds then disconnect to observe what the server does
                    await asyncio.sleep(2)
                    break
        except Exception as e:
            print(f"Exception: {e}")

asyncio.run(test())
