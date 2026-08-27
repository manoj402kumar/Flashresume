import time
from redis_client import redis_client

class RedisQuotaManager:
    # Lua script for atomic Token Bucket consumption
    # KEYS[1] = bucket_key (e.g. llm_quota:rpm:provider)
    # ARGV[1] = capacity (max tokens)
    # ARGV[2] = fill_rate (tokens per second)
    # ARGV[3] = now (current timestamp in seconds)
    # ARGV[4] = requested_tokens
    LUA_CONSUME = """
    local bucket_key = KEYS[1]
    local capacity = tonumber(ARGV[1])
    local fill_rate = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    local requested = tonumber(ARGV[4])

    local last_tokens = tonumber(redis.call('HGET', bucket_key, 'tokens'))
    if last_tokens == nil then
        last_tokens = capacity
    end

    local last_refreshed = tonumber(redis.call('HGET', bucket_key, 'last_refreshed'))
    if last_refreshed == nil then
        last_refreshed = now
    end

    local delta = math.max(0, now - last_refreshed)
    local filled_tokens = math.min(capacity, last_tokens + (delta * fill_rate))

    if filled_tokens >= requested then
        local new_tokens = filled_tokens - requested
        redis.call('HSET', bucket_key, 'tokens', new_tokens)
        redis.call('HSET', bucket_key, 'last_refreshed', now)
        -- Set TTL to avoid stale keys lying around forever (capacity / fill_rate is the max time to refill)
        redis.call('EXPIRE', bucket_key, math.ceil(capacity / fill_rate) + 60)
        return 1
    end

    return 0
    """

    async def consume(self, provider: str, max_rpm: int, requested: int = 1) -> bool:
        """
        Token bucket for RPM.
        """
        now = time.time()
        key = f"llm_quota:rpm:{provider}"
        capacity = max_rpm
        fill_rate = max_rpm / 60.0  # tokens per second
        
        result = await redis_client.eval(self.LUA_CONSUME, 1, key, capacity, fill_rate, now, requested)
        return result == 1
        
    async def acquire(self, provider: str, max_concurrent: int, timeout: int = 30) -> str:
        """Legacy semaphore for backward compat with existing code structure"""
        if await self.consume(provider, max_rpm=100):  # Fallback assumption 100 RPM
            return "dummy_lock"
        return ""

    async def release(self, provider: str, lock_id: str):
        # Token buckets do not "release" tokens on completion, they refill over time.
        pass

quota_manager = RedisQuotaManager()
