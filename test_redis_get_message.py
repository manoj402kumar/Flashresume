import asyncio
from redis import asyncio as aioredis

async def test():
    redis = aioredis.from_url("redis://localhost:6379")
    pubsub = redis.pubsub()
    await pubsub.subscribe("test_channel")
    
    print("Waiting for message with timeout=1.0...")
    try:
        msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
        print(f"Message: {msg}")
    except Exception as e:
        print(f"Exception: {type(e)} {e}")

asyncio.run(test())
