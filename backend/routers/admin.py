from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import time
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

router = APIRouter()

# Server start time for uptime tracking
SERVER_START_TIME = time.time()

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://your-project.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"Supabase client initialization failed: {e}")
    supabase = None

@router.get("/health/queue")
async def get_queue_status():
    # Since AI generation is synchronous right now, queue is always 0
    return {"processing": 0}

@router.get("/admin/stats")
async def get_admin_stats():
    uptime_seconds = int(time.time() - SERVER_START_TIME)
    
    stats = {
        "uptime_seconds": uptime_seconds,
        "revenue": 0,
        "downloads": 0,
        "subscribers": 0
    }
    
    if not supabase:
        return stats
        
    try:
        # 1. Total Revenue (sum of all successful payments)
        # Note: supabase-py doesn't have aggregate sum easily, so we fetch and sum or use RPC.
        # For simplicity, we fetch them (in a real app with 1M rows, use an RPC)
        payments_res = supabase.table("payments").select("amount").eq("status", "success").execute()
        if payments_res.data:
            # amount is in paise, so divide by 100 for INR
            stats["revenue"] = sum(p["amount"] for p in payments_res.data) // 100
            
        # 2. Total Downloads (from resume_downloads table or resume_sessions)
        # Let's count resume_sessions for now as a proxy if downloads isn't heavily populated yet.
        # Using count="exact" is supported in Supabase
        sessions_res = supabase.table("resume_sessions").select("id", count="exact").execute()
        if hasattr(sessions_res, 'count') and sessions_res.count is not None:
            stats["downloads"] = sessions_res.count
        else:
            stats["downloads"] = len(sessions_res.data) if sessions_res.data else 0
            
        # 3. Paid Subscribers (active regular or student)
        subs_res = supabase.table("subscriptions")\
            .select("id", count="exact")\
            .eq("is_active", True)\
            .neq("plan_type", "one_time")\
            .execute()
        if hasattr(subs_res, 'count') and subs_res.count is not None:
            stats["subscribers"] = subs_res.count
        else:
            stats["subscribers"] = len(subs_res.data) if subs_res.data else 0

        return stats
    except Exception as e:
        print(f"Admin Stats Error: {str(e)}")
        # Return partial stats so UI doesn't crash
        return stats
