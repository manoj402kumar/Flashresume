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

from datetime import datetime, timedelta, timezone

@router.get("/health/queue")
async def get_queue_status():
    # Proxy for active sessions: sessions created in the last 5 minutes
    if not supabase:
        return {"processing": 0}
    try:
        five_mins_ago = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
        res = supabase.table("resume_sessions").select("id", count="exact").gte("created_at", five_mins_ago).execute()
        active_count = res.count if hasattr(res, 'count') and res.count is not None else (len(res.data) if res.data else 0)
        return {"processing": active_count}
    except Exception as e:
        print(f"Health Queue Error: {str(e)}")
        return {"processing": 0}

@router.get("/admin/stats")
async def get_admin_stats():
    uptime_seconds = int(time.time() - SERVER_START_TIME)
    
    stats = {
        "uptime_seconds": uptime_seconds,
        "total_revenue": 0,
        "total_downloads": 0,
        "active_subs": 0
    }
    
    if not supabase:
        return stats
        
    try:
        # 1. Total Revenue (sum of all successful payments)
        payments_res = supabase.table("payments").select("amount").eq("status", "success").execute()
        if payments_res.data:
            stats["total_revenue"] = sum(p["amount"] for p in payments_res.data) // 100
            
        # 2. Total Downloads (using resume_downloads table)
        downloads = supabase.table("resume_downloads").select("id", count="exact").execute()
        if hasattr(downloads, 'count') and downloads.count is not None:
            stats["total_downloads"] = downloads.count
        else:
            stats["total_downloads"] = len(downloads.data) if downloads.data else 0
            
        # 3. Active Subscribers
        subs = supabase.table("subscriptions").select("id", count="exact").eq("is_active", True).execute()
        if hasattr(subs, 'count') and subs.count is not None:
            stats["active_subs"] = subs.count
        else:
            stats["active_subs"] = len(subs.data) if subs.data else 0

        return stats
    except Exception as e:
        print(f"Admin Stats Error: {str(e)}")
        # Return partial stats so UI doesn't crash
        return stats
