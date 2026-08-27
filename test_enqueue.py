import asyncio
import sys
import os
import time
import json
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from backend.redis_client import redis_client

async def test():
    job_id = "test_123"
    job_data = {
        "id": job_id,
        "type": "my_type",
        "payload": json.dumps({"test": 123}),
        "status": "QUEUED",
        "created_at": time.time(),
        "updated_at": time.time(),
        "retries": 0,
        "error": ""
    }
    
    async with redis_client.pipeline() as pipe:
        pipe.hset(f"job:data:{job_id}", mapping=job_data)
        pipe.lpush("queue:jobs:pending", job_id)
        res = await pipe.execute()
    print("Res:", res)
    print("Pending:", await redis_client.llen("queue:jobs:pending"))

asyncio.run(test())
