from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from supabase import create_client, Client
import os

router = APIRouter()

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://your-project.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"Supabase client initialization failed: {e}")
    supabase = None

class FeedbackRequest(BaseModel):
    user_id: str
    session_id: str
    rating: int
    suggestion: str = ""

@router.post("/feedback/submit")
async def submit_feedback(body: FeedbackRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    session = supabase.table("resume_sessions").select("download_count, user_id").eq("id", body.session_id).single().execute()
    
    if not session.data:
        raise HTTPException(404, "Session not found")
    if session.data["user_id"] != body.user_id:
        raise HTTPException(403, "Not your session")
    if (session.data.get("download_count") or 0) < 1:
        raise HTTPException(400, "Feedback only accepted after first download")
        

        
    supabase.table("feedback").insert({
        "user_id": body.user_id,
        "session_id": body.session_id,
        "rating": body.rating,
        "suggestion": body.suggestion
    }).execute()
    
    return {"success": True}

@router.get("/admin/feedback")
async def get_feedback():
    if not supabase:
        return []
    result = supabase.table("feedback").select("*, users(email)").order("created_at", desc=True).limit(100).execute()
    return result.data


class IncrementDownloadRequest(BaseModel):
    session_id: str
    user_id: str | None = None

@router.post("/resume/increment-download")
async def increment_download(body: IncrementDownloadRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    session = supabase.table("resume_sessions").select("download_count, user_id").eq("id", body.session_id).single().execute()
    new_count = (session.data.get("download_count") or 0) + 1
    
    supabase.table("resume_sessions").update({"download_count": new_count}).eq("id", body.session_id).execute()
    
    global_count = 0
    # Determine the actual user_id to log for
    actual_user_id = body.user_id or session.data.get("user_id")
    
    if actual_user_id:
        try:
            # Log the download globally
            supabase.table("resume_downloads").insert({
                "user_id": actual_user_id,
                "session_id": body.session_id
            }).execute()
            
            # Count total global downloads
            downloads_res = supabase.table("resume_downloads").select("id", count="exact").eq("user_id", actual_user_id).execute()
            if hasattr(downloads_res, 'count') and downloads_res.count is not None:
                global_count = downloads_res.count
            else:
                global_count = len(downloads_res.data) if downloads_res.data else 0
        except Exception as e:
            print(f"Error logging to resume_downloads: {e}")
    
    return {
        "download_count": new_count,
        "global_download_count": global_count
    }

@router.get("/admin/llm-stats")
async def llm_stats():
    if not supabase:
        return []
    result = supabase.table("llm_usage").select("*").order("created_at", desc=True).limit(100).execute()
    return result.data
