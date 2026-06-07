import os
import redis.asyncio as aioredis

_redis_client = None
_redis_failed = False

async def get_redis():
    """Returns async Redis client, or None if Redis is unavailable."""
    global _redis_client, _redis_failed
    if _redis_client is not None:
        return _redis_client
    if _redis_failed:
        return None
    url = os.getenv("REDIS_URL")
    if not url:
        return None
    try:
        client = aioredis.from_url(
            url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=0.5,   # Fast fail — don't block startup
            socket_timeout=0.3,
            ssl_cert_reqs=None
        )
        await client.ping()               # Confirm connection is alive
        _redis_client = client
        print("[Redis] Connected successfully.")
        return _redis_client
    except Exception as e:
        print(f"[Redis] Unavailable — falling back to local counter. ({e})")
        _redis_failed = True
        return None
