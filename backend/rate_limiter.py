from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request
import asyncio

def dynamic_key_func(request: Request) -> str:
    """Rate-limit by email if available, fallback to IP."""
    try:
        # Check if the route is otp-related
        if "otp" in request.url.path:
            body = asyncio.get_event_loop().run_until_complete(request.json())
            email = body.get('email')
            if email:
                return f"otp:{email.strip().lower()}"
    except Exception:
        pass
    return get_remote_address(request)

limiter = Limiter(key_func=dynamic_key_func)
