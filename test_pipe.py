import asyncio
from backend.redis_client import redis_client

async def test():
    async with redis_client.pipeline() as pipe:
        pipe.hset("h", mapping={"a": "b"})
        pipe.lpush("q", "item")
        res = await pipe.execute()
    print("Execute result:", res)
    print("Len:", await redis_client.llen("q"))

asyncio.run(test())
