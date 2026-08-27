import asyncio
import time
from backend.redis_client import redis_client

async def test():
    await redis_client.hset("myjob", "picked_up_at", time.time() - 600)
    await redis_client.lpush("myproc", "123")
    script = """
    local picked_up = redis.call('HGET', KEYS[1], 'picked_up_at')
    return picked_up
    """
    res = await redis_client.eval(script, 1, "myjob")
    print("Picked up:", res)
asyncio.run(test())
