from fastapi import Header, HTTPException
import supabase_client as sc
import asyncio

async def verify_user(authorization: str = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required: Missing or invalid Authorization header")
    
    token = authorization.split(" ", 1)[1]
    if not sc.supabase:
        raise HTTPException(status_code=500, detail="Authentication provider not configured")
        
    try:
        user_resp = await sc.sb(lambda: sc.supabase.auth.get_user(token))
        if user_resp and user_resp.user:
            return user_resp.user.id
        raise HTTPException(status_code=401, detail="Authentication required: Invalid token")
    except Exception as e:
        # If Supabase returns an error (expired, invalid signature, etc.)
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=401, detail=f"Authentication required: Invalid or expired token")
