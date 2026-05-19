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


@router.get("/admin/revenue-breakdown")
async def get_revenue_breakdown():
    if not supabase:
        return []
    
    try:
        # Total users
        users_res = supabase.table("users").select("id", count="exact").execute()
        total_users = users_res.count if hasattr(users_res, 'count') and users_res.count is not None else (len(users_res.data) if users_res.data else 0)
        
        # Active subscriptions grouped by plan
        subs_res = supabase.table("subscriptions").select("plan_type").eq("is_active", True).execute()
        
        # Payments grouped by plan (for MRR) - sum of all successful payments
        payments_res = supabase.table("payments").select("plan_type, amount").eq("status", "success").execute()
        
        # Aggregate
        plan_counts = {"regular": 0, "student": 0, "pay_per_use": 0}
        plan_mrr = {"regular": 0, "student": 0, "pay_per_use": 0}
        
        if subs_res.data:
            for sub in subs_res.data:
                ptype = sub.get("plan_type")
                if ptype in plan_counts:
                    plan_counts[ptype] += 1
                else:
                    plan_counts[ptype] = 1
                    
        if payments_res.data:
            for p in payments_res.data:
                ptype = p.get("plan_type")
                amt = p.get("amount", 0) // 100
                if ptype in plan_mrr:
                    plan_mrr[ptype] += amt
                else:
                    plan_mrr[ptype] = amt
                    
        # Calculate Free users (total users - active subs)
        active_subs_count = sum(plan_counts.values())
        free_users = max(0, total_users - active_subs_count)
        
        breakdown = [
            {
                "name": "Free",
                "price": 0,
                "users": free_users,
                "mrr": 0,
                "color": "bg-[#eff1f2]",
                "textColor": "text-[#595c5d]",
                "barColor": "bg-[#595c5d]/30"
            },
            {
                "name": "Student",
                "price": 49,
                "users": plan_counts.get("student", 0),
                "mrr": plan_mrr.get("student", 0),
                "color": "bg-[#12f8d7]/15",
                "textColor": "text-[#006859]",
                "barColor": "bg-gradient-to-r from-[#006859] to-[#12f8d7]"
            },
            {
                "name": "Regular",
                "price": 99,
                "users": plan_counts.get("regular", 0),
                "mrr": plan_mrr.get("regular", 0),
                "color": "bg-purple-50",
                "textColor": "text-purple-700",
                "barColor": "bg-gradient-to-r from-purple-500 to-purple-400"
            }
        ]
        
        return breakdown
    except Exception as e:
        print(f"Revenue Breakdown Error: {str(e)}")
        return []

@router.get("/admin/download-trends")
async def get_download_trends():
    if not supabase:
        return {"daily": [], "weekly": [], "monthly": []}
    
    try:
        # Fetch all downloads with downloaded_at
        res = supabase.table("resume_downloads").select("downloaded_at").execute()
        downloads = res.data or []
        
        now = datetime.now(timezone.utc)
        
        # We need to build the arrays
        # Daily: last 7 days
        daily = []
        for i in range(6, -1, -1):
            d = now - timedelta(days=i)
            label = d.strftime("%a") # Mon, Tue...
            daily.append({"label": label, "value": 0, "date": d.date()})
            
        # Weekly: last 4 weeks
        weekly = []
        for i in range(3, -1, -1):
            label = f"Wk {4-i}"
            start = now - timedelta(days=(i+1)*7)
            end = now - timedelta(days=i*7)
            weekly.append({"label": label, "value": 0, "start": start, "end": end})
            
        # Monthly: last 12 months
        monthly = []
        for i in range(11, -1, -1):
            m = (now.month - i - 1) % 12 + 1
            y = now.year + ((now.month - i - 1) // 12)
            label = datetime(y, m, 1).strftime("%b") # Jan, Feb...
            monthly.append({"label": label, "value": 0, "month": m, "year": y})

        # Process data
        for row in downloads:
            if not row.get("downloaded_at"): continue
            
            try:
                dt = datetime.fromisoformat(row["downloaded_at"].replace("Z", "+00:00"))
            except:
                continue
                
            # Populate daily
            for d in daily:
                if d["date"] == dt.date():
                    d["value"] += 1
                    break
                    
            # Populate weekly
            for w in weekly:
                if w["start"] <= dt <= w["end"]:
                    w["value"] += 1
                    break
                    
            # Populate monthly
            for m in monthly:
                if m["month"] == dt.month and m["year"] == dt.year:
                    m["value"] += 1
                    break
                    
        # Cleanup extra keys
        for d in daily: del d["date"]
        for w in weekly: 
            del w["start"]
            del w["end"]
        for m in monthly:
            del m["month"]
            del m["year"]
            
        return {
            "daily": daily,
            "weekly": weekly,
            "monthly": monthly
        }
    except Exception as e:
        print(f"Download Trends Error: {str(e)}")
        return {"daily": [], "weekly": [], "monthly": []}

class TrackVisitRequest(BaseModel):
    page_type: str
    session_id: str | None = None
    user_id: str | None = None

@router.post("/analytics/track-visit")
async def track_visit(body: TrackVisitRequest):
    if not supabase:
        return {"status": "skipped"}
    try:
        supabase.table("page_visits").insert({
            "page_type": body.page_type,
            "session_id": body.session_id,
            "user_id": body.user_id
        }).execute()
        return {"status": "ok"}
    except Exception as e:
        print(f"Track Visit Error: {str(e)}")
        return {"status": "error"}

@router.get("/admin/funnel-stats")
async def get_funnel_stats():
    if not supabase:
        return {"landing": 0, "result": 0, "purchases": 0}
        
    try:
        landing = supabase.table("page_visits").select("id", count="exact").eq("page_type", "landing").execute()
        result = supabase.table("page_visits").select("id", count="exact").eq("page_type", "result").execute()
        
        purchases = supabase.table("payments").select("id", count="exact").eq("status", "success").execute()
        
        def extract_count(res):
            if hasattr(res, 'count') and res.count is not None:
                return res.count
            return len(res.data) if res.data else 0
            
        return {
            "landing": extract_count(landing),
            "result": extract_count(result),
            "purchases": extract_count(purchases)
        }
    except Exception as e:
        print(f"Funnel Stats Error: {str(e)}")
        return {"landing": 0, "result": 0, "purchases": 0}


class ApplyReferralRequest(BaseModel):
    referral_code: str
    user_id: str

@router.post("/user/apply-referral")
async def apply_referral(body: ApplyReferralRequest):
    if not supabase:
        return {"status": "error", "message": "Supabase not configured"}
    
    try:
        # Find referrer user by code
        ref_res = supabase.table("users").select("id").eq("referral_code", body.referral_code).execute()
        if not ref_res.data:
            return {"status": "error", "message": "Invalid referral code"}
            
        referrer_id = ref_res.data[0]["id"]
        
        # Don't allow self-referral
        if referrer_id == body.user_id:
            return {"status": "error", "message": "Cannot refer yourself"}
            
        # Update user's referred_by ONLY if it's currently null
        user_res = supabase.table("users").select("referred_by").eq("id", body.user_id).execute()
        if user_res.data and user_res.data[0].get("referred_by") is None:
            supabase.table("users").update({"referred_by": referrer_id}).eq("id", body.user_id).execute()
            return {"status": "ok"}
            
        return {"status": "skipped", "message": "Already referred"}
    except Exception as e:
        print(f"Apply Referral Error: {str(e)}")
        return {"status": "error", "message": str(e)}
