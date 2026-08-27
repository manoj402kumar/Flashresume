import time
import json
import uuid
import asyncio
from typing import Optional, Dict, Any
from redis_client import redis_client

QUEUE_PENDING = "queue:jobs:pending"
QUEUE_PROCESSING = "queue:jobs:processing"
QUEUE_DLQ = "queue:jobs:dlq"
JOB_PREFIX = "job:data:"

VISIBILITY_TIMEOUT = 300  # 5 minutes
MAX_RETRIES = 3

class QueueManager:
    async def enqueue(self, job_type: str, payload: dict, job_id: str = None) -> str:
        if job_id is None:
            job_id = str(uuid.uuid4())
            
        job_data = {
            "id": job_id,
            "type": job_type,
            "payload": json.dumps(payload),
            "status": "QUEUED",
            "created_at": time.time(),
            "updated_at": time.time(),
            "retries": 0,
            "error": ""
        }
        async with redis_client.pipeline() as pipe:
            pipe.hset(f"{JOB_PREFIX}{job_id}", mapping=job_data)
            pipe.lpush(QUEUE_PENDING, job_id)
            await pipe.execute()
        return job_id

    async def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        data = await redis_client.hgetall(f"{JOB_PREFIX}{job_id}")
        if not data:
            return None
        data["payload"] = json.loads(data["payload"])
        data["retries"] = int(data.get("retries", 0))
        return data

    async def update_job_status(self, job_id: str, status: str, error: str = ""):
        await redis_client.hset(f"{JOB_PREFIX}{job_id}", mapping={
            "status": status,
            "updated_at": time.time(),
            "error": error
        })
        # If frontend needs SSE, we could publish to a pubsub channel here
        await redis_client.publish(f"job_updates:{job_id}", json.dumps({"status": status, "error": error}))

    async def dequeue(self, timeout: int = 5) -> Optional[str]:
        # Move from pending to processing reliably
        # BRPOPLPUSH blocks until an item is available
        job_id = await redis_client.brpoplpush(QUEUE_PENDING, QUEUE_PROCESSING, timeout=timeout)
        if job_id:
            # Mark it as processing and timestamp it for visibility timeout
            await redis_client.hset(f"{JOB_PREFIX}{job_id}", mapping={
                "status": "PROCESSING",
                "picked_up_at": time.time(),
                "updated_at": time.time()
            })
            await redis_client.publish(f"job_updates:{job_id}", json.dumps({"status": "PROCESSING"}))
        return job_id

    async def ack(self, job_id: str):
        # Remove from processing list
        await redis_client.lrem(QUEUE_PROCESSING, 1, job_id)
        await self.update_job_status(job_id, "COMPLETE")
        # Do not delete the job data immediately so frontend can fetch it. TTL can handle it.
        await redis_client.expire(f"{JOB_PREFIX}{job_id}", 3600)  # Keep result for 1 hour

    async def fail_job(self, job_id: str, error_msg: str):
        # Remove from processing list
        await redis_client.lrem(QUEUE_PROCESSING, 1, job_id)
        
        job = await self.get_job(job_id)
        if not job:
            return

        retries = job["retries"]
        if retries < MAX_RETRIES:
            # Requeue with backoff (or immediately for simplicity if backoff is handled elsewhere)
            # For backoff, we could use a ZSET for delayed jobs. For now, push to pending.
            await redis_client.hset(f"{JOB_PREFIX}{job_id}", mapping={
                "retries": retries + 1,
                "status": "RETRYING",
                "error": error_msg,
                "updated_at": time.time()
            })
            await redis_client.rpush(QUEUE_PENDING, job_id)
            await redis_client.publish(f"job_updates:{job_id}", json.dumps({"status": "RETRYING", "error": error_msg}))
        else:
            # DLQ
            await self.update_job_status(job_id, "FAILED", error=error_msg)
            await redis_client.rpush(QUEUE_DLQ, job_id)

    async def recover_zombies(self):
        """Find jobs in processing that have exceeded VISIBILITY_TIMEOUT and requeue or DLQ them. Race-safe."""
        # We need to atomically check the timestamp and move it. 
        # A simple way without complex Lua for moving is:
        processing_jobs = await redis_client.lrange(QUEUE_PROCESSING, 0, -1)
        now = time.time()
        for job_id in processing_jobs:
            # We can use a small Lua script to atomically check picked_up_at and move the job
            # but since we already have logic in fail_job, we can use a WATCH or lock.
            # Let's use a Lua script for the atomic check-and-remove from processing list
            lua_script = """
            local job_id = ARGV[1]
            local timeout = tonumber(ARGV[2])
            local now = tonumber(ARGV[3])
            local q_processing = KEYS[1]
            local job_key = KEYS[2]
            
            local picked_up = redis.call('HGET', job_key, 'picked_up_at')
            if picked_up then
                if (now - tonumber(picked_up)) > timeout then
                    -- Remove from processing list atomically
                    local removed = redis.call('LREM', q_processing, 1, job_id)
                    if removed > 0 then
                        return 1
                    end
                end
            end
            return 0
            """
            
            # Note: eval executes the script. If it returns 1, we successfully claimed the zombie.
            result = await redis_client.eval(
                lua_script, 2, QUEUE_PROCESSING, f"{JOB_PREFIX}{job_id}", 
                job_id, VISIBILITY_TIMEOUT, now
            )
            
            if result == 1:
                print(f"[QueueManager] Atomically recovered zombie task: {job_id}")
                await self.fail_job_requeue(job_id, "Worker crashed or timed out (Visibility Timeout Exceeded)")

    async def fail_job_requeue(self, job_id: str, error_msg: str):
        # We bypassed the normal fail_job's LREM because the Lua script already did it.
        job = await self.get_job(job_id)
        if not job:
            return

        retries = job["retries"]
        if retries < MAX_RETRIES:
            await redis_client.hset(f"{JOB_PREFIX}{job_id}", mapping={
                "retries": retries + 1,
                "status": "RETRYING",
                "error": error_msg,
                "updated_at": time.time()
            })
            await redis_client.lpush(QUEUE_PENDING, job_id)
            await redis_client.publish(f"job_updates:{job_id}", json.dumps({"status": "RETRYING", "error": error_msg}))
        else:
            await self.update_job_status(job_id, "FAILED", error=error_msg)
            await redis_client.lpush(QUEUE_DLQ, job_id)

queue_manager = QueueManager()
