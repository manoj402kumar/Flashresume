from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Security, Header
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from typing import Optional
import os
import time
import asyncio
import hmac
from dotenv import load_dotenv
from supabase_client import supabase

# Helper: run a synchronous supabase query on a thread pool so it
# never blocks the async event loop.
async def _sb(query):
    return await asyncio.to_thread(query.execute)

load_dotenv()

router = APIRouter()

# Emails excluded from all admin metrics (dev / test accounts)
DEV_EMAILS = ["testuser@flashresume.in", "devteam@flashresume.in"]

_ADMIN_KEY_HEADER = APIKeyHeader(name="X-Admin-Key", auto_error=False)

async def require_admin(key: str = Security(_ADMIN_KEY_HEADER)):
    expected = os.getenv("ADMIN_SECRET_KEY")
    if not expected or not hmac.compare_digest(key or "", expected):
        raise HTTPException(status_code=403, detail="Forbidden")

# Server start time for uptime tracking
SERVER_START_TIME = time.time()

from datetime import datetime, timedelta, timezone


@router.get("/admin/stats", dependencies=[Depends(require_admin)])
async def get_admin_stats():
    uptime_seconds = int(time.time() - SERVER_START_TIME)
    
    stats = {
        "uptime_seconds": uptime_seconds,
        "total_revenue": 0,
        "total_downloads": 0,
        "active_subs": 0,
        "total_logins": 0,
        "total_visitors": 0,
        "failed_payments": 0,
    }
    
    if not supabase:
        return stats
        
    try:
        # Run all 5 DB queries in parallel — non-blocking
        # Fetch dev user IDs once so we can exclude them from all metrics
        dev_users_res = await _sb(supabase.table("users").select("id").in_("email", DEV_EMAILS))
        dev_user_ids = [u["id"] for u in (dev_users_res.data or [])]

        payments_query = supabase.table("payments").select("amount, user_id, plan_type").eq("status", "success").gte("created_at", "2026-05-28T00:00:00Z")
        if dev_user_ids:
            payments_query = payments_query.not_.in_("user_id", dev_user_ids)

        users_query = supabase.table("users").select("id", count="exact").gte("created_at", "2026-05-28T00:00:00Z").not_.in_("email", DEV_EMAILS)

        subs_query = supabase.table("subscriptions").select("user_id").eq("is_active", True)
        if dev_user_ids:
            subs_query = subs_query.not_.in_("user_id", dev_user_ids)

        payments_res, downloads, subs_res, users_res, visitors_res, failed_res = await asyncio.gather(
            _sb(payments_query),
            _sb(supabase.table("resume_downloads").select("id", count="exact").gte("downloaded_at", "2026-05-28T00:00:00Z")),
            _sb(subs_query),
            _sb(users_query),
            _sb(supabase.table("page_visits").select("id", count="exact").gte("visited_at", "2026-05-28T00:00:00Z")),
            _sb(supabase.table("payments").select("id", count="exact").eq("status", "failed").gte("created_at", "2026-05-28T00:00:00Z")),
        )

        if payments_res.data:
            stats["total_revenue"] = sum(p["amount"] for p in payments_res.data) // 100

        if hasattr(downloads, 'count') and downloads.count is not None:
            stats["total_downloads"] = downloads.count
        else:
            stats["total_downloads"] = len(downloads.data) if downloads.data else 0

        # Unique paid users across ALL 3 plans:
        # 1. Active subscribers (Regular + Student) from subscriptions table
        sub_user_ids = set(s["user_id"] for s in (subs_res.data or []) if s.get("user_id"))
        # 2. Pay-per-use users from payments table
        ppu_user_ids = set(
            p["user_id"] for p in (payments_res.data or [])
            if p.get("plan_type") == "pay_per_use" and p.get("user_id")
        )
        # Union → deduplicated unique paid users
        stats["active_subs"] = len(sub_user_ids | ppu_user_ids)

        if hasattr(users_res, 'count') and users_res.count is not None:
            stats["total_logins"] = users_res.count
        else:
            stats["total_logins"] = len(users_res.data) if users_res.data else 0

        if hasattr(visitors_res, 'count') and visitors_res.count is not None:
            stats["total_visitors"] = visitors_res.count
        else:
            stats["total_visitors"] = len(visitors_res.data) if visitors_res.data else 0

        if hasattr(failed_res, 'count') and failed_res.count is not None:
            stats["failed_payments"] = failed_res.count
        else:
            stats["failed_payments"] = len(failed_res.data) if failed_res.data else 0

        return stats
    except Exception as e:
        print(f"Admin Stats Error: {str(e)}")
        return stats


@router.get("/admin/analytics/revenue", dependencies=[Depends(require_admin)])
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
    
    PROD_START_DATE = datetime(2026, 5, 28, tzinfo=timezone.utc)
    
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
            
    if not dt_start or dt_start < PROD_START_DATE:
        dt_start = PROD_START_DATE
            
    try:
        # Exclude dev/test accounts
        dev_users_res = await _sb(supabase.table("users").select("id").in_("email", DEV_EMAILS))
        dev_user_ids = [u["id"] for u in (dev_users_res.data or [])]

        # Fetch Payments
        payments_query = supabase.table("payments").select("amount, plan_type, created_at").eq("status", "success")
        if dt_start:
            payments_query = payments_query.gte("created_at", dt_start.isoformat())
        if dt_end:
            payments_query = payments_query.lte("created_at", dt_end.isoformat())
        if plan_filter != "all":
            payments_query = payments_query.eq("plan_type", plan_filter)
        if dev_user_ids:
            payments_query = payments_query.not_.in_("user_id", dev_user_ids)
            
        # Build both queries, then fire in parallel — non-blocking
        subs_query = supabase.table("subscriptions").select("plan_type, created_at").eq("is_active", True)
        if dt_start:
            subs_query = subs_query.gte("created_at", dt_start.isoformat())
        if dt_end:
            subs_query = subs_query.lte("created_at", dt_end.isoformat())
        if plan_filter != "all":
            subs_query = subs_query.eq("plan_type", plan_filter)
        if dev_user_ids:
            subs_query = subs_query.not_.in_("user_id", dev_user_ids)

        payments_res, subs_res = await asyncio.gather(
            _sb(payments_query),
            _sb(subs_query),
        )
        payments = payments_res.data or []
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
            
        breakdown = [
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
        PROD_START_DATE = datetime(2026, 5, 28, tzinfo=timezone.utc)
        if time_filter == "custom" and dt_start:
            months = (dt_end.year - dt_start.year) * 12 + dt_end.month - dt_start.month + 1
        elif time_filter == "all":
            actual_start = max(dt_start or PROD_START_DATE, PROD_START_DATE)
            months = (dt_end.year - actual_start.year) * 12 + dt_end.month - actual_start.month + 1
            months = max(1, months)
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

@router.get("/admin/analytics/downloads", dependencies=[Depends(require_admin)])
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
    
    PROD_START_DATE = datetime(2026, 5, 28, tzinfo=timezone.utc)
    
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

    if not dt_start or dt_start < PROD_START_DATE:
        dt_start = PROD_START_DATE

    try:
        # Exclude dev/test accounts
        dev_users_res = await _sb(supabase.table("users").select("id").in_("email", DEV_EMAILS))
        dev_user_ids = [u["id"] for u in (dev_users_res.data or [])]

        # Fetch downloads with LIMIT 10000
        dl_query = supabase.table("resume_downloads").select("user_id, session_id, downloaded_at, device_type").limit(10000).order("downloaded_at", desc=True)
        if dt_start: dl_query = dl_query.gte("downloaded_at", dt_start.isoformat())
        if dt_end: dl_query = dl_query.lte("downloaded_at", dt_end.isoformat())
        if dev_user_ids: dl_query = dl_query.not_.in_("user_id", dev_user_ids)
        
        dl_res = await _sb(dl_query)
        downloads = dl_res.data or []
        
        user_ids = list(set(d.get("user_id") for d in downloads if d.get("user_id")))
        
        user_plans = {}
        if user_ids:
            subs_res = await _sb(supabase.table("subscriptions").select("user_id, plan_type").in_("user_id", user_ids).eq("is_active", True))
            for s in subs_res.data or []:
                user_plans[s["user_id"]] = s["plan_type"]
                
            missing_users = [uid for uid in user_ids if uid not in user_plans]
            if missing_users:
                pmt_res = await _sb(supabase.table("payments").select("user_id, plan_type").in_("user_id", missing_users).eq("status", "success").eq("plan_type", "pay_per_use"))
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
            
        # Determine categories from sessions
        session_ids = list(set(d.get("session_id") for d in downloads if d.get("session_id")))
        session_categories = {}
        if session_ids:
            chunk_size = 200
            for i in range(0, len(session_ids), chunk_size):
                chunk = session_ids[i:i+chunk_size]
                s_res = await _sb(supabase.table("resume_sessions").select("id, generated_output").in_("id", chunk))
                for s in s_res.data or []:
                    output = s.get("generated_output") or {}
                    cat = output.get("_category")
                    if not cat:
                        # Legacy fallback: check score
                        score = output.get("ats_score_after", 0)
                        cat = "jd_optimized" if score > 0 else "unknown"
                    session_categories[s["id"]] = cat

        category_counts = {"jd_optimized": 0, "no_jd": 0, "no_changes": 0, "unknown": 0}
        device_counts = {"desktop": 0, "mobile": 0, "unknown": 0}
        
        for d in downloads:
            sid = d.get("session_id")
            cat = session_categories.get(sid, "unknown") if sid else "unknown"
            if cat in category_counts: category_counts[cat] += 1
            else: category_counts[cat] = 1
            
            dev = d.get("device_type") or "unknown"
            if dev in device_counts: device_counts[dev] += 1
            else: device_counts["unknown"] += 1
            
        trend = build_trend_data(downloads, dt_start, dt_end, time_filter)
        
        return {
            "total_downloads": len(downloads),
            "unique_users": unique_users,
            "downloads_by_plan": plan_counts,
            "downloads_by_category": category_counts,
            "downloads_by_device": device_counts,
            "trend": trend
        }
    except Exception as e:
        print(f"Download Analytics Error: {e}")
        return {}

class TrackVisitRequest(BaseModel):
    page_type: str
    session_id: str | None = None
    user_id: str | None = None

def _do_track_visit(body: TrackVisitRequest):
    """Sync insert — runs in background thread, never blocks the event loop."""
    if supabase:
        try:
            supabase.table("page_visits").insert({
                "page_type": body.page_type,
                "session_id": body.session_id,
                "user_id": body.user_id
            }).execute()
        except Exception as e:
            print(f"Track Visit Error: {str(e)}")

@router.post("/analytics/track-visit")
async def track_visit(body: TrackVisitRequest, background_tasks: BackgroundTasks):
    """Returns instantly — actual DB insert happens in the background."""
    background_tasks.add_task(_do_track_visit, body)
    return {"status": "ok"}

@router.get("/admin/funnel-stats", dependencies=[Depends(require_admin)])
async def get_funnel_stats():
    if not supabase:
        return {"landing": 0, "result": 0, "purchases": 0}
        
    try:
        # All 3 queries in parallel — non-blocking
        landing, result, purchases = await asyncio.gather(
            _sb(supabase.table("page_visits").select("id", count="exact").eq("page_type", "landing").gte("visited_at", "2026-05-28T00:00:00Z")),
            _sb(supabase.table("page_visits").select("id", count="exact").eq("page_type", "result").gte("visited_at", "2026-05-28T00:00:00Z")),
            _sb(supabase.table("payments").select("id", count="exact").eq("status", "success").gte("created_at", "2026-05-28T00:00:00Z")),
        )

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

@router.post("/user/apply-referral")
async def apply_referral(body: ApplyReferralRequest, authorization: str = Header(None)):
    if not supabase:
        return {"status": "error", "message": "Supabase not configured"}
    
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
    try:
        token = authorization.split(" ")[1]
        user_res = await asyncio.to_thread(supabase.auth.get_user, token)
        if not user_res or not user_res.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        auth_user_id = user_res.user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    try:
        # Find referrer user by code
        ref_res = await _sb(supabase.table("users").select("id").eq("referral_code", body.referral_code))
        if not ref_res.data:
            return {"status": "error", "message": "Invalid referral code"}
            
        referrer_id = ref_res.data[0]["id"]
        
        if referrer_id == auth_user_id:
            return {"status": "error", "message": "Cannot refer yourself"}
            
        user_res = await _sb(supabase.table("users").select("referred_by").eq("id", auth_user_id))
        if user_res.data and user_res.data[0].get("referred_by") is None:
            await _sb(supabase.table("users").update({"referred_by": referrer_id}).eq("id", auth_user_id))
            return {"status": "ok"}
            
        return {"status": "error", "message": "Referral already applied"}
    except Exception as e:
        print(f"Apply Referral Error: {str(e)}")
        return {"status": "error", "message": str(e)}
