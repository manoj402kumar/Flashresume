from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
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


@router.get("/admin/analytics/revenue")
async def get_analytics_revenue(
    time_filter: str = "all", 
    plan_filter: str = "all",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    if not supabase:
        return {}

    now = datetime.now(timezone.utc)
    
    dt_start = None
    dt_end = now
    
    if time_filter == "today":
        dt_start = now - timedelta(hours=24)
    elif time_filter == "week":
        dt_start = now - timedelta(days=7)
    elif time_filter == "month":
        dt_start = now - timedelta(days=30)
    elif time_filter == "custom" and start_date and end_date:
        try:
            dt_start = datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc)
            dt_end = datetime.fromisoformat(end_date).replace(tzinfo=timezone.utc)
            dt_end = dt_end.replace(hour=23, minute=59, second=59)
        except Exception:
            pass
            
    try:
        # Fetch Payments
        payments_query = supabase.table("payments").select("amount, plan_type, created_at").eq("status", "success")
        if dt_start:
            payments_query = payments_query.gte("created_at", dt_start.isoformat())
        if dt_end:
            payments_query = payments_query.lte("created_at", dt_end.isoformat())
        if plan_filter != "all":
            payments_query = payments_query.eq("plan_type", plan_filter)
            
        payments_res = payments_query.execute()
        payments = payments_res.data or []
        
        # Fetch Subscriptions (Active only)
        subs_query = supabase.table("subscriptions").select("plan_type, created_at").eq("is_active", True)
        if dt_start:
            subs_query = subs_query.gte("created_at", dt_start.isoformat())
        if dt_end:
            subs_query = subs_query.lte("created_at", dt_end.isoformat())
        if plan_filter != "all":
            subs_query = subs_query.eq("plan_type", plan_filter)
            
        subs_res = subs_query.execute()
        subs = subs_res.data or []
        
        # Calculate Totals
        total_revenue = sum(p.get("amount", 0) for p in payments) // 100
        active_subscriptions = len(subs)
        
        # Breakdown
        plan_counts = {"regular": 0, "student": 0, "pay_per_use": 0}
        plan_mrr = {"regular": 0, "student": 0, "pay_per_use": 0}
        
        for s in subs:
            ptype = s.get("plan_type")
            if ptype in plan_counts: plan_counts[ptype] += 1
            else: plan_counts[ptype] = 1
            
        for p in payments:
            ptype = p.get("plan_type")
            amt = p.get("amount", 0) // 100
            if ptype in plan_mrr: plan_mrr[ptype] += amt
            else: plan_mrr[ptype] = amt
            
        free_users = 0
        if plan_filter == "all":
            users_query = supabase.table("users").select("id", count="exact")
            if dt_start: users_query = users_query.gte("created_at", dt_start.isoformat())
            if dt_end: users_query = users_query.lte("created_at", dt_end.isoformat())
            u_res = users_query.execute()
            total_users = u_res.count if hasattr(u_res, 'count') and u_res.count is not None else len(u_res.data or [])
            free_users = max(0, total_users - sum(plan_counts.values()))
            
        breakdown = [
            {
                "name": "Free", "price": 0, "users": free_users, "mrr": 0,
                "color": "bg-[#eff1f2]", "textColor": "text-[#595c5d]", "barColor": "bg-[#595c5d]/30"
            },
            {
                "name": "Student", "price": 99, "users": plan_counts.get("student", 0), "mrr": plan_mrr.get("student", 0),
                "color": "bg-[#12f8d7]/15", "textColor": "text-[#006859]", "barColor": "bg-gradient-to-r from-[#006859] to-[#12f8d7]"
            },
            {
                "name": "Regular", "price": 199, "users": plan_counts.get("regular", 0), "mrr": plan_mrr.get("regular", 0),
                "color": "bg-purple-50", "textColor": "text-purple-700", "barColor": "bg-gradient-to-r from-purple-500 to-purple-400"
            },
            {
                "name": "One-Time", "price": 29, "users": 0, "mrr": plan_mrr.get("pay_per_use", 0),
                "color": "bg-blue-50", "textColor": "text-blue-700", "barColor": "bg-blue-400"
            }
        ]
        
        if plan_filter == "student":
            breakdown = [b for b in breakdown if b["name"] == "Student"]
        elif plan_filter == "regular":
            breakdown = [b for b in breakdown if b["name"] == "Regular"]
        elif plan_filter == "pay_per_use":
            breakdown = [b for b in breakdown if b["name"] == "One-Time"]
            
        trend = build_trend_data(payments, dt_start, dt_end, time_filter, "amount", lambda x: x // 100)
        
        return {
            "total_revenue": total_revenue,
            "active_subscriptions": active_subscriptions,
            "subscription_count": len(subs) + len([p for p in payments if p.get("plan_type") == "pay_per_use"]),
            "breakdown": breakdown,
            "trend": trend
        }
    except Exception as e:
        print(f"Revenue Analytics Error: {e}")
        return {}

def build_trend_data(records, dt_start, dt_end, time_filter, value_key=None, transform=None):
    trend = []
    if not records:
        return trend
        
    now = dt_end or datetime.now(timezone.utc)
    
    if time_filter == "today":
        for i in range(23, -1, -1):
            start_hr = now - timedelta(hours=i+1)
            end_hr = now - timedelta(hours=i)
            label = start_hr.strftime("%H:00")
            trend.append({"label": label, "start": start_hr, "end": end_hr, "value": 0})
    elif time_filter == "week" or (time_filter == "custom" and (dt_end - (dt_start or now - timedelta(days=7))).days < 14):
        days = 7
        if time_filter == "custom" and dt_start:
            days = (dt_end - dt_start).days + 1
        for i in range(days-1, -1, -1):
            d = now - timedelta(days=i)
            label = d.strftime("%a %d") if time_filter == "custom" else d.strftime("%a")
            start_d = d.replace(hour=0, minute=0, second=0, microsecond=0)
            end_d = start_d + timedelta(days=1)
            trend.append({"label": label, "start": start_d, "end": end_d, "value": 0})
    elif time_filter == "month" or (time_filter == "custom" and (dt_end - (dt_start or now - timedelta(days=30))).days < 60):
        days = 30
        if time_filter == "custom" and dt_start:
            days = (dt_end - dt_start).days + 1
        for i in range(days-1, -1, -1):
            d = now - timedelta(days=i)
            label = d.strftime("%d %b")
            start_d = d.replace(hour=0, minute=0, second=0, microsecond=0)
            end_d = start_d + timedelta(days=1)
            trend.append({"label": label, "start": start_d, "end": end_d, "value": 0})
    else:
        months = 12
        if time_filter == "custom" and dt_start:
            months = (dt_end.year - dt_start.year) * 12 + dt_end.month - dt_start.month + 1
        for i in range(months-1, -1, -1):
            m = (now.month - i - 1) % 12 + 1
            y = now.year + ((now.month - i - 1) // 12)
            label = datetime(y, m, 1).strftime("%b %y")
            start_m = datetime(y, m, 1, tzinfo=timezone.utc)
            next_m = m % 12 + 1
            next_y = y + (1 if m == 12 else 0)
            end_m = datetime(next_y, next_m, 1, tzinfo=timezone.utc)
            trend.append({"label": label, "start": start_m, "end": end_m, "value": 0})
            
    for r in records:
        ts = r.get("created_at") or r.get("downloaded_at")
        if not ts: continue
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
        except:
            continue
            
        val = 1
        if value_key and value_key in r:
            val = r[value_key]
            if transform: val = transform(val)
            
        for b in trend:
            if b["start"] <= dt < b["end"]:
                b["value"] += val
                break
                
    for b in trend:
        del b["start"]
        del b["end"]
        
    return trend

@router.get("/admin/analytics/downloads")
async def get_analytics_downloads(
    time_filter: str = "all", 
    plan_filter: str = "all",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    if not supabase:
        return {}
        
    now = datetime.now(timezone.utc)
    dt_start = None
    dt_end = now
    
    if time_filter == "today":
        dt_start = now - timedelta(hours=24)
    elif time_filter == "week":
        dt_start = now - timedelta(days=7)
    elif time_filter == "month":
        dt_start = now - timedelta(days=30)
    elif time_filter == "custom" and start_date and end_date:
        try:
            dt_start = datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc)
            dt_end = datetime.fromisoformat(end_date).replace(tzinfo=timezone.utc)
            dt_end = dt_end.replace(hour=23, minute=59, second=59)
        except Exception:
            pass

    try:
        # Fetch downloads with LIMIT 10000 (Blocker 1 Fix)
        dl_query = supabase.table("resume_downloads").select("user_id, downloaded_at").limit(10000).order("downloaded_at", desc=True)
        if dt_start: dl_query = dl_query.gte("downloaded_at", dt_start.isoformat())
        if dt_end: dl_query = dl_query.lte("downloaded_at", dt_end.isoformat())
        
        dl_res = dl_query.execute()
        downloads = dl_res.data or []
        
        user_ids = list(set(d.get("user_id") for d in downloads if d.get("user_id")))
        
        user_plans = {}
        if user_ids:
            # Batch if large, but IN can usually handle 1000s
            subs_res = supabase.table("subscriptions").select("user_id, plan_type").in_("user_id", user_ids).eq("is_active", True).execute()
            for s in subs_res.data or []:
                user_plans[s["user_id"]] = s["plan_type"]
                
            missing_users = [uid for uid in user_ids if uid not in user_plans]
            if missing_users:
                pmt_res = supabase.table("payments").select("user_id, plan_type").in_("user_id", missing_users).eq("status", "success").eq("plan_type", "pay_per_use").execute()
                for p in pmt_res.data or []:
                    user_plans[p["user_id"]] = "pay_per_use"
                    
        if plan_filter != "all":
            downloads = [d for d in downloads if d.get("user_id") and user_plans.get(d["user_id"], "free") == plan_filter]
            
        unique_users = len(set(d.get("user_id") for d in downloads if d.get("user_id")))
        
        plan_counts = {"regular": 0, "student": 0, "pay_per_use": 0, "free": 0}
        for d in downloads:
            uid = d.get("user_id")
            ptype = user_plans.get(uid, "free") if uid else "free"
            if ptype in plan_counts: plan_counts[ptype] += 1
            else: plan_counts[ptype] = 1
            
        trend = build_trend_data(downloads, dt_start, dt_end, time_filter)
        
        return {
            "total_downloads": len(downloads),
            "unique_users": unique_users,
            "downloads_by_plan": plan_counts,
            "trend": trend
        }
    except Exception as e:
        print(f"Download Analytics Error: {e}")
        return {}

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
