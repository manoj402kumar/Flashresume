from fastapi import APIRouter, HTTPException, Depends
from routers.admin import require_admin
from pydantic import BaseModel
from supabase_client import supabase, sb

router = APIRouter()

class FeedbackRequest(BaseModel):
    user_id: str
    session_id: str
    rating: int
    suggestion: str = ""

@router.post("/feedback/submit")
async def submit_feedback(body: FeedbackRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    session = await sb(lambda: supabase.table("resume_sessions").select("download_count, user_id").eq("id", body.session_id).single().execute())
    
    if not session.data:
        raise HTTPException(404, "Session not found")
    if session.data["user_id"] != body.user_id:
        raise HTTPException(403, "Not your session")
    if (session.data.get("download_count") or 0) < 1:
        raise HTTPException(400, "Feedback only accepted after first download")
        

        
    await sb(lambda: supabase.table("feedback").insert({
        "user_id": body.user_id,
        "session_id": body.session_id,
        "rating": body.rating,
        "suggestion": body.suggestion
    }).execute())
    
    return {"success": True}

@router.get("/admin/feedback", dependencies=[Depends(require_admin)])
async def get_feedback():
    if not supabase:
        return []
    result = await sb(lambda: supabase.table("feedback").select("*, users(email)").order("created_at", desc=True).limit(100).execute())
    return result.data


class IncrementDownloadRequest(BaseModel):
    session_id: str
    user_id: str | None = None

@router.post("/resume/increment-download")
async def increment_download(body: IncrementDownloadRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    # 1. Verify session ownership before doing anything
    session = await sb(lambda: supabase.table("resume_sessions")
        .select("download_count, user_id")
        .eq("id", body.session_id).single().execute())
    if not session.data:
        raise HTTPException(404, "Session not found")
        
    actual_user_id = body.user_id or session.data.get("user_id")

    # 2. Atomic DB-side increment — no Python read-then-write race
    updated = await sb(lambda: supabase.rpc("increment_download_count",
        {"p_session_id": body.session_id}).execute())

    new_count = updated.data or 0
    global_count = 0
    
    # 3. Log global download (UNIQUE constraint makes this idempotent on retry)
    if actual_user_id:
        try:
            await sb(lambda: supabase.table("resume_downloads").insert({
                "user_id": actual_user_id,
                "session_id": body.session_id,
            }).execute())
        except Exception:
            pass  # UNIQUE constraint violation = already logged, safe to ignore
            
        try:
            # Count total platform downloads (across all users)
            downloads_res = await sb(lambda: supabase.table("resume_downloads").select("id", count="exact").execute())
            if hasattr(downloads_res, 'count') and downloads_res.count is not None:
                global_count = downloads_res.count
            else:
                global_count = len(downloads_res.data) if downloads_res.data else 0
        except Exception as e:
            print(f"Error counting resume_downloads: {e}")
            
    return {
        "download_count": new_count,
        "total_platform_downloads": global_count
    }

@router.get("/admin/llm-stats", dependencies=[Depends(require_admin)])
async def llm_stats():
    if not supabase:
        return []
    result = await sb(lambda: supabase.table("llm_usage").select("*").order("created_at", desc=True).limit(100).execute())
    return result.data
