from fastapi import APIRouter, HTTPException, Depends
from routers.admin import require_admin
from pydantic import BaseModel
import asyncio
import supabase_client as sc
from supabase_client import sb

router = APIRouter()

class FeedbackRequest(BaseModel):
    user_id: str
    session_id: str
    rating: int
    suggestion: str = ""

@router.post("/feedback/submit")
async def submit_feedback(body: FeedbackRequest):
    if not sc.supabase:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    if body.session_id:
        session = await sb(lambda: sc.supabase.table("resume_sessions").select("download_count, user_id").eq("id", body.session_id).single().execute())
        
        if not session.data:
            raise HTTPException(404, "Session not found")
        if session.data["user_id"] != body.user_id:
            raise HTTPException(403, "Not your session")
        if (session.data.get("download_count") or 0) < 1:
            raise HTTPException(400, "Feedback only accepted after first download")
    else:
        # Scratch mode has no session_id
        if not body.user_id:
            raise HTTPException(400, "User ID is required for feedback")
        
    # Prevent duplicate feedback for the same session
    # Prevent duplicate feedback for the same session (or scratch mode)
    query = sc.supabase.table("feedback").select("id").eq("user_id", body.user_id)
    if body.session_id:
        query = query.eq("session_id", body.session_id)
    else:
        # Prevent multiple scratch mode feedbacks per user if desired, or allow them?
        # The frontend asks once on first download, or 5th global download.
        # We can just check for null session_id
        query = query.is_("session_id", "null")
        
    existing = await sb(lambda: query.limit(1).execute())
    if existing.data:
        raise HTTPException(409, "Feedback already submitted for this session")

    await sb(lambda: sc.supabase.table("feedback").insert({
        "user_id": body.user_id,
        "session_id": body.session_id or None,
        "rating": body.rating,
        "suggestion": body.suggestion
    }).execute())
    
    return {"success": True}

@router.get("/admin/feedback", dependencies=[Depends(require_admin)])
async def get_feedback():
    if not sc.supabase:
        return []
    result = await sb(lambda: sc.supabase.table("feedback").select("*, users(email)").gte("created_at", "2026-05-28T00:00:00Z").order("created_at", desc=True).limit(100).execute())
    return result.data


class IncrementDownloadRequest(BaseModel):
    session_id: str
    user_id: str | None = None
    device_type: str = "desktop"

@router.post("/resume/increment-download")
async def increment_download(body: IncrementDownloadRequest):
    if not sc.supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    new_count = 0
    global_count = 0
    user_total_downloads = 0

    # Scratch mode sends empty session_id — skip session lookup & DB increment
    if body.session_id:
        # 1. Verify session ownership before doing anything
        session = await sb(lambda: sc.supabase.table("resume_sessions")
            .select("download_count, user_id")
            .eq("id", body.session_id).single().execute())
        if not session.data:
            raise HTTPException(404, "Session not found")
        actual_user_id = session.data.get("user_id")

        # 2. Atomic DB-side increment — no Python read-then-write race
        updated = await sb(lambda: sc.supabase.rpc("increment_download_count",
            {"p_session_id": body.session_id}).execute())
        new_count = updated.data or 0
    else:
        # Scratch mode: no session row — use user_id from body directly
        actual_user_id = body.user_id

    # 3. Log global download and count (UNIQUE constraint makes this idempotent on retry)
    if actual_user_id:
        try:
            await sb(lambda: sc.supabase.table("resume_downloads").insert({
                "user_id": actual_user_id,
                "session_id": body.session_id or None,
                "device_type": body.device_type,
            }).execute())
        except Exception as e:
            print(f"Download log failed: {e}")  # ⚠️ Logs real DB/Network crashes to Render!

        try:
            # Count total platform downloads (across all users) and this user's total
            global_res, user_res = await asyncio.gather(
                sb(lambda: sc.supabase.table("resume_downloads").select("id", count="exact").execute()),
                sb(lambda: sc.supabase.table("resume_downloads").select("id", count="exact").eq("user_id", actual_user_id).execute()),
            )
            if hasattr(global_res, 'count') and global_res.count is not None:
                global_count = global_res.count
            else:
                global_count = len(global_res.data) if global_res.data else 0

            # user_total_downloads = 1 means this is their very first download EVER
            if hasattr(user_res, 'count') and user_res.count is not None:
                user_total_downloads = user_res.count
            else:
                user_total_downloads = len(user_res.data) if user_res.data else 0
        except Exception as e:
            print(f"Error counting resume_downloads: {e}")

    return {
        "download_count": new_count,
        "total_platform_downloads": global_count,
        "user_total_downloads": user_total_downloads,  # 1 = first ever download by this user
    }

@router.get("/admin/llm-stats", dependencies=[Depends(require_admin)])
async def llm_stats():
    if not sc.supabase:
        return []
    result = await sb(lambda: sc.supabase.table("llm_usage").select("*").gte("created_at", "2026-05-28T00:00:00Z").order("created_at", desc=True).limit(100).execute())
    return result.data
