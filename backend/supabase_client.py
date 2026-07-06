import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

_url = os.getenv("SUPABASE_URL")
_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

import asyncio

if _url and _key:
    supabase: Client = create_client(_url, _key)
else:
    supabase = None

async def sb(query_lambda):
    """Wraps any synchronous Supabase query in asyncio.to_thread with auto-reconnect."""
    try:
        return await asyncio.to_thread(query_lambda)
    except Exception as e:
        if "ConnectionTerminated" in str(e) or "error_code:9" in str(e) or "Broken pipe" in str(e) or "WriteError" in str(e):
            print("[Supabase] HTTP/2 Connection dropped. Reconnecting...")
            global supabase
            supabase = create_client(_url, _key)
            return await asyncio.to_thread(query_lambda)
        raise
