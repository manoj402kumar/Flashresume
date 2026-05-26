from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request
import asyncio

def dynamic_key_func(request: Request) -> str:
    """Rate-limit by IP for all requests."""
    return get_remote_address(request)

limiter = Limiter(key_func=dynamic_key_func)
