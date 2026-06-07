from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request
import base64
import json

def extract_user_id_from_jwt(auth_header: str) -> str | None:
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ")[1]
    parts = token.split(".")
    if len(parts) != 3:
        return None
    try:
        # Pad base64
        payload_b64 = parts[1]
        payload_b64 += "=" * ((4 - len(payload_b64) % 4) % 4)
        payload_json = base64.urlsafe_b64decode(payload_b64).decode('utf-8')
        payload = json.loads(payload_json)
        return payload.get("sub")
    except Exception:
        return None

def dynamic_key_func(request: Request) -> str:
    """Rate-limit by User ID if authenticated, fallback to IP for anonymous requests."""
    auth_header = request.headers.get("authorization")
    user_id = extract_user_id_from_jwt(auth_header)
    
    if user_id:
        return f"user:{user_id}"
    
    return f"ip:{get_remote_address(request)}"

limiter = Limiter(key_func=dynamic_key_func)
