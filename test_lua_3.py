import asyncio
import time
from backend.redis_client import redis_client

async def test():
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
    job_id = "job_123"
    await redis_client.hset(f"job:data:{job_id}", "picked_up_at", time.time() - 600)
    await redis_client.lpush("queue:jobs:processing", job_id)
    
    now = time.time()
    result = await redis_client.eval(
        lua_script, 2, "queue:jobs:processing", f"job:data:{job_id}", 
        job_id, 300, now
    )
    print("Result:", result)
asyncio.run(test())
