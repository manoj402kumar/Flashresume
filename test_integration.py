import asyncio
import sys
import os

# Ensure backend can be imported
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from backend.queue_manager import queue_manager
from backend.redis_client import redis_client

async def test_queue():
    print("Testing Queue Enqueue...")
    job_id = await queue_manager.enqueue("dummy_job", {"foo": "bar"})
    print(f"Enqueued job: {job_id}")
    
    print("Testing Dequeue...")
    dequeued_id = await queue_manager.dequeue(timeout=1)
    print(f"Dequeued job: {dequeued_id}")
    
    assert job_id == dequeued_id
    
    print("Testing ACK...")
    await queue_manager.ack(job_id)
    job = await queue_manager.get_job(job_id)
    assert job["status"] == "COMPLETE"
    print("Queue tests passed.")

if __name__ == "__main__":
    asyncio.run(test_queue())
