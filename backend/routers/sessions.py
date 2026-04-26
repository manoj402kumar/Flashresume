import os
from fastapi import APIRouter, HTTPException
from supabase import create_client, Client

router = APIRouter()

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://your-project.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"Supabase init error in sessions.py: {e}")
    supabase = None

@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    try:
        res = supabase.table("resume_sessions").select("*").eq("id", session_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Session not found")
            
        return res.data[0]
    except Exception as e:
        print(f"Error fetching session: {e}")
        raise HTTPException(status_code=404, detail="Session not found")
