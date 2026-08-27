import asyncio
import time
import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from backend.queue_manager import queue_manager
from backend.redis_client import redis_client
from backend.queue_manager import QUEUE_PENDING, QUEUE_PROCESSING

async def test():
    await redis_client.delete(QUEUE_PENDING)
    await redis_client.delete(QUEUE_PROCESSING)
    job_id = await queue_manager.enqueue("dummy_task", {"test": True})
    print("Pending after enqueue:", await redis_client.llen(QUEUE_PENDING))
    
    claimed = await queue_manager.dequeue(timeout=1)
    print("Processing after dequeue:", await redis_client.llen(QUEUE_PROCESSING))
    
    await redis_client.hset(f"job:data:{job_id}", "picked_up_at", time.time() - 600)
    await queue_manager.recover_zombies()
    
    print("Pending after recover:", await redis_client.llen(QUEUE_PENDING))
    print("Processing after recover:", await redis_client.llen(QUEUE_PROCESSING))

asyncio.run(test())
