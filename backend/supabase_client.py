import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

_url = os.getenv("SUPABASE_URL")
_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

if _url and _key:
    supabase: Client = create_client(_url, _key)
else:
    supabase = None
