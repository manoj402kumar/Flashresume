import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

_url = os.getenv("SUPABASE_URL")
_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

import asyncio
import httpx
import httpcore
from postgrest.exceptions import APIError

if _url and _key:
    supabase: Client = create_client(_url, _key)
else:
    supabase = None

async def sb(query_lambda, fallback=None):
    """Wraps any synchronous Supabase query in asyncio.to_thread with auto-reconnect."""
    global supabase
    try:
        return await asyncio.to_thread(query_lambda)
    except (httpx.ReadError, httpx.WriteError, httpx.ConnectError, httpx.RemoteProtocolError,
            httpcore.ReadError, httpcore.WriteError, httpcore.ConnectError, httpcore.RemoteProtocolError,
            ConnectionResetError, BrokenPipeError, TimeoutError) as e:
        print(f"[Supabase] Connection dropped ({type(e).__name__}: {e}). Reconnecting...")
        supabase = create_client(_url, _key)
        try:
            return await asyncio.to_thread(query_lambda)
        except Exception as retry_err:
            print(f"[Supabase] Retry after reconnect also failed: {retry_err}")
            if fallback is not None:
                return fallback
            raise
    except APIError as e:
        msg = str(e)
        if "JSON could not be generated" in msg or "cloudflare" in msg.lower():
            print(f"[Supabase] Upstream HTML/proxy error. Reconnecting... {e}")
            supabase = create_client(_url, _key)
            try:
                return await asyncio.to_thread(query_lambda)
            except Exception as retry_err:
                print(f"[Supabase] Retry after APIError failed: {retry_err}")
                if fallback is not None:
                    return fallback
                raise
        raise
    except Exception as e:
        if "ConnectionTerminated" in str(e) or "error_code:9" in str(e):
            print("[Supabase] HTTP/2 stream error. Reconnecting...")
            supabase = create_client(_url, _key)
            try:
                return await asyncio.to_thread(query_lambda)
            except Exception as retry_err:
                print(f"[Supabase] Retry after stream error failed: {retry_err}")
                if fallback is not None:
                    return fallback
                raise
        raise
