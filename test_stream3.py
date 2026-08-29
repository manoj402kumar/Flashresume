import asyncio
import httpx
from redis import asyncio as aioredis
import json
import uuid

async def test():
    # Bypass auth and directly inject a job and ticket into Redis
    redis = aioredis.from_url("redis://localhost:6379")
    job_id = str(uuid.uuid4())
    ticket = str(uuid.uuid4())
    
    # 1. Add job to redis
    job_data = {
        "id": job_id,
        "type": "analyze_resume",
        "payload": json.dumps({"resume_text": "hello"}),
        "status": "QUEUED",
        "user_id": "test_user"
    }
    await redis.hset(f"job:data:{job_id}", mapping=job_data)
    
    # 2. Add ticket
    await redis.set(f"sse_ticket:{ticket}", json.dumps({"user_id": "test_user", "job_id": job_id}), ex=60)
    
    # 3. Request stream
    url = f"http://localhost:8000/api/jobs/{job_id}/stream?ticket={ticket}"
    print(f"Requesting: {url}")
    
    async with httpx.AsyncClient() as client:
        try:
            async with client.stream("GET", url) as response:
                print(f"HTTP Status: {response.status_code}")
                print(f"Headers: {response.headers}")
                chunk = await response.aread()
                print(f"Raw stream response: {chunk}")
        except Exception as e:
            print(f"Exception: {e}")

asyncio.run(test())
