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
    """Wraps any synchronous Supabase query in asyncio.to_thread."""
    return await asyncio.to_thread(query_lambda)
