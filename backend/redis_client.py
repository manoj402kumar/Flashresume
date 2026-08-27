import os
import redis.asyncio as redis

# The actual production Redis URL is injected by Render via the environment.
# Locally, it will use localhost if no REDIS_URL is provided in .env.
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

def get_redis_client():
    return redis.from_url(REDIS_URL, decode_responses=True)

redis_client = get_redis_client()
