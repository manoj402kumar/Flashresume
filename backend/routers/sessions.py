import os
import asyncio
from fastapi import APIRouter, HTTPException
import supabase_client as sc

router = APIRouter()

@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    if not sc.supabase:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    try:
        res = await asyncio.to_thread(
            lambda: sc.supabase.table("resume_sessions").select("id, generated_output").eq("id", session_id).execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="Session not found")
        return res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching session: {e}")
        raise HTTPException(status_code=404, detail="Session not found")
