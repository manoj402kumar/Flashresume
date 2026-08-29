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
USER_JOBS_PREFIX = "user:active_jobs:"

VISIBILITY_TIMEOUT = 300  # 5 minutes
MAX_RETRIES = 3
MAX_PENDING_JOBS = 200
MAX_ACTIVE_JOBS_PER_USER = 2

class QueueCapacityError(Exception):
    """Raised when the global queue admission limit is exceeded."""
    pass

class UserJobLimitError(Exception):
    """Raised when a single user exceeds their concurrent active job limit."""
    pass

class QueueManager:
    # Atomic Lua script for queue admission control
    # KEYS[1] = QUEUE_PENDING
    # KEYS[2] = job_key (e.g. job:data:{job_id})
    # KEYS[3] = user_active_key (e.g. user:active_jobs:{user_id} or empty string)
    # ARGV[1] = MAX_PENDING_JOBS
    # ARGV[2] = MAX_ACTIVE_JOBS_PER_USER
    # ARGV[3] = job_id
    # ARGV[4] = job_data_json
    LUA_ENQUEUE = """
    local q_pending = KEYS[1]
    local job_key = KEYS[2]
    local user_jobs_key = KEYS[3]

    local max_pending = tonumber(ARGV[1])
    local max_per_user = tonumber(ARGV[2])
    local job_id = ARGV[3]
    local job_data_raw = ARGV[4]

    -- 1. Global Queue Depth Admission Check
    local pending_count = redis.call('LLEN', q_pending)
    if pending_count >= max_pending then
        return -1
    end

    -- 2. Per-User Concurrency Check
    if user_jobs_key ~= "" then
        local user_job_count = redis.call('SCARD', user_jobs_key)
        if user_job_count >= max_per_user then
            return -2
        end
        redis.call('SADD', user_jobs_key, job_id)
        redis.call('EXPIRE', user_jobs_key, 3600)
    end

    -- 3. Atomic Enqueue & Hash Creation
    local job_data = cjson.decode(job_data_raw)
    for k, v in pairs(job_data) do
        redis.call('HSET', job_key, k, tostring(v))
    end
    redis.call('LPUSH', q_pending, job_id)

    return 1
    """

    async def enqueue(self, job_type: str, payload: dict, job_id: str = None, user_id: str = None) -> str:
        if job_id is None:
            job_id = str(uuid.uuid4())

        user_id = user_id or payload.get("user_id") or ""
        user_key = f"{USER_JOBS_PREFIX}{user_id}" if user_id else ""

        job_data = {
            "id": job_id,
            "type": job_type,
            "payload": json.dumps(payload),
            "status": "QUEUED",
            "created_at": time.time(),
            "updated_at": time.time(),
            "retries": 0,
            "error": "",
            "user_id": user_id
        }

        result = await redis_client.eval(
            self.LUA_ENQUEUE,
            3,
            QUEUE_PENDING,
            f"{JOB_PREFIX}{job_id}",
            user_key,
            MAX_PENDING_JOBS,
            MAX_ACTIVE_JOBS_PER_USER,
            job_id,
            json.dumps(job_data)
        )

        if result == -1:
            raise QueueCapacityError("Global queue capacity reached (MAX_PENDING_JOBS=200). Please retry in 30 seconds.")
        elif result == -2:
            raise UserJobLimitError(f"User {user_id} has reached maximum concurrent active jobs ({MAX_ACTIVE_JOBS_PER_USER}).")

        return job_id

    async def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        data = await redis_client.hgetall(f"{JOB_PREFIX}{job_id}")
        if not data:
            return None
        if "payload" in data and isinstance(data["payload"], str):
            try:
                data["payload"] = json.loads(data["payload"])
            except Exception:
                pass
        if "result" in data and isinstance(data["result"], str):
            try:
                data["result"] = json.loads(data["result"])
            except Exception:
                pass
        data["retries"] = int(data.get("retries", 0))
        return data

    async def update_job_status(self, job_id: str, status: str, error: str = ""):
        await redis_client.hset(f"{JOB_PREFIX}{job_id}", mapping={
            "status": status,
            "updated_at": time.time(),
            "error": error
        })
        await redis_client.publish(f"job_updates:{job_id}", json.dumps({"status": status, "error": error}))

    async def dequeue(self, timeout: int = 5) -> Optional[str]:
        job_id = await redis_client.brpoplpush(QUEUE_PENDING, QUEUE_PROCESSING, timeout=timeout)
        if job_id:
            await redis_client.hset(f"{JOB_PREFIX}{job_id}", mapping={
                "status": "PROCESSING",
                "picked_up_at": time.time(),
                "updated_at": time.time()
            })
            await redis_client.publish(f"job_updates:{job_id}", json.dumps({"status": "PROCESSING"}))
        return job_id

    async def _cleanup_user_job(self, job_id: str):
        job = await self.get_job(job_id)
        if job and job.get("user_id"):
            await redis_client.srem(f"{USER_JOBS_PREFIX}{job['user_id']}", job_id)

    async def ack(self, job_id: str):
        await redis_client.lrem(QUEUE_PROCESSING, 1, job_id)
        await self.update_job_status(job_id, "COMPLETE")
        await self._cleanup_user_job(job_id)
        await redis_client.expire(f"{JOB_PREFIX}{job_id}", 3600)  # Keep result for 1 hour

    async def fail_job(self, job_id: str, error_msg: str):
        await redis_client.lrem(QUEUE_PROCESSING, 1, job_id)
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
            await redis_client.rpush(QUEUE_PENDING, job_id)
            await redis_client.publish(f"job_updates:{job_id}", json.dumps({"status": "RETRYING", "error": error_msg}))
        else:
            await self.update_job_status(job_id, "FAILED", error=error_msg)
            await self._cleanup_user_job(job_id)
            await redis_client.rpush(QUEUE_DLQ, job_id)

    async def recover_zombies(self):
        """Find jobs in processing that have exceeded VISIBILITY_TIMEOUT and requeue or DLQ them. Race-safe."""
        processing_jobs = await redis_client.lrange(QUEUE_PROCESSING, 0, -1)
        now = time.time()
        for job_id in processing_jobs:
            lua_script = """
            local job_id = ARGV[1]
            local timeout = tonumber(ARGV[2])
            local now = tonumber(ARGV[3])
            local q_processing = KEYS[1]
            local job_key = KEYS[2]
            
            local picked_up = redis.call('HGET', job_key, 'picked_up_at')
            if picked_up then
                if (now - tonumber(picked_up)) > timeout then
                    local removed = redis.call('LREM', q_processing, 1, job_id)
                    if removed > 0 then
                        return 1
                    end
                end
            end
            return 0
            """
            result = await redis_client.eval(
                lua_script, 2, QUEUE_PROCESSING, f"{JOB_PREFIX}{job_id}", 
                job_id, VISIBILITY_TIMEOUT, now
            )
            if result == 1:
                print(f"[QueueManager] Atomically recovered zombie task: {job_id}")
                await self.fail_job_requeue(job_id, "Worker crashed or timed out (Visibility Timeout Exceeded)")

    async def fail_job_requeue(self, job_id: str, error_msg: str):
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
            await self._cleanup_user_job(job_id)
            await redis_client.lpush(QUEUE_DLQ, job_id)

queue_manager = QueueManager()
