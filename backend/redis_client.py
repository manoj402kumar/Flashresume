import os
import redis.asyncio as redis

# The actual production Redis URL is injected by Render via the environment.
# Locally, it will use localhost if no REDIS_URL is provided in .env.
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# Bounded connection pool (max 500 connections) to prevent socket exhaustion
_pool = redis.ConnectionPool.from_url(
    REDIS_URL,
    max_connections=int(os.getenv("REDIS_MAX_CONNECTIONS", "500")),
    decode_responses=True
)

redis_client = redis.Redis(connection_pool=_pool)

def get_redis_client():
    return redis_client
