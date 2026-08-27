import asyncio
from backend.redis_client import redis_client

async def test():
    await redis_client.lpush("q_pending", "job1")
    job_id = await redis_client.brpoplpush("q_pending", "q_processing", timeout=1)
    print("Dequeued:", job_id)
    pending = await redis_client.llen("q_pending")
    processing = await redis_client.llen("q_processing")
    print("Pending:", pending, "Processing:", processing)

asyncio.run(test())
