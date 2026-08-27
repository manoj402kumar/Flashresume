import asyncio
import time
from backend.redis_client import redis_client

async def test():
    await redis_client.hset("myjob", "picked_up_at", time.time() - 600)
    await redis_client.lpush("myproc", "123")
    script = """
    local picked_up = redis.call('HGET', KEYS[1], 'picked_up_at')
    if picked_up then
        local removed = redis.call('LREM', KEYS[2], 1, ARGV[1])
        return removed
    end
    return -1
    """
    res = await redis_client.eval(script, 2, "myjob", "myproc", "123")
    print("Removed:", res)
asyncio.run(test())
