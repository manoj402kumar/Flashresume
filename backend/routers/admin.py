from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Security, Header
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from typing import Optional
import os
import time
import asyncio
import hmac
from dotenv import load_dotenv
import supabase_client as sc

# Helper: run a synchronous supabase query on a thread pool so it
# never blocks the async event loop.
async def _sb(query):
    return await asyncio.to_thread(query.execute)

load_dotenv()

router = APIRouter()

# Emails excluded from all admin metrics (dev / test accounts)
DEV_EMAILS = ["flashresume.in@gmail.com"]

_ADMIN_KEY_HEADER = APIKeyHeader(name="X-Admin-Key", auto_error=False)

async def require_admin(key: str = Security(_ADMIN_KEY_HEADER)):
    expected = os.getenv("ADMIN_SECRET_KEY")
    if not expected or not hmac.compare_digest(key or "", expected):
        raise HTTPException(status_code=403, detail="Forbidden")

# Server start time for uptime tracking
SERVER_START_TIME = time.time()

from datetime import datetime, timedelta, timezone

IST_OFFSET = timedelta(hours=5, minutes=30)


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
        "peak_concurrent_users": 0,
        "peak_timestamp": None,
        "high_risk_users": 0,
    }
    
    if not sc.supabase:
        return stats
        
    try:
        # Run all 5 DB queries in parallel — non-blocking
        # Fetch dev user IDs once so we can exclude them from all metrics
        dev_users_res = await _sb(supabase.table("users").select("id").in_("email", DEV_EMAILS))
        dev_user_ids = [u["id"] for u in (dev_users_res.data or [])]

        payments_query = supabase.table("payments").select("amount, user_id, plan_type").eq("status", "success").gte("created_at", "2026-05-28T00:00:00Z")
        if dev_user_ids:
            dev_ids_str = ",".join(dev_user_ids)
            payments_query = payments_query.or_(f"user_id.is.null,user_id.not.in.({dev_ids_str})")

        users_query = supabase.table("users").select("id", count="exact").gte("created_at", "2026-05-28T00:00:00Z")

        downloads_query = supabase.table("resume_downloads").select("id", count="exact").gte("downloaded_at", "2026-05-28T00:00:00Z")

        # Total Visitors KPI: Count ALL traffic (all pages, anonymous + logged-in users).
        # We keep all anonymous and logged-in rows.
        visitors_query = supabase.table("page_visits").select("id", count="exact").gte("visited_at", "2026-05-28T00:00:00Z")

        failed_query = supabase.table("payments").select("id", count="exact").eq("status", "failed").gte("created_at", "2026-05-28T00:00:00Z")

        # High-risk users: consecutive generations > 5 without a download — potential freeloader/scraper
        high_risk_query = supabase.table("users").select("id", count="exact").gt("fraud_tracker_counter", 5)

        results = await asyncio.gather(
            _sb(payments_query),
            _sb(downloads_query),
            _sb(users_query),
            _sb(visitors_query),
            _sb(failed_query),
            _sb(supabase.table("system_metrics").select("value").eq("id", "peak_concurrent_users")),
            _sb(high_risk_query),
            return_exceptions=True,
        )
        payments_res, downloads, users_res, visitors_res, failed_res, peak_res, high_risk_res = results

        if not isinstance(payments_res, Exception) and payments_res.data:
            stats["total_revenue"] = sum(p["amount"] for p in payments_res.data) // 100

        if not isinstance(downloads, Exception):
            if hasattr(downloads, 'count') and downloads.count is not None:
                stats["total_downloads"] = downloads.count
            else:
                stats["total_downloads"] = len(downloads.data) if downloads.data else 0

        # Paid Subscribers = unique users who paid at least once (regardless of current credits)
        if not isinstance(payments_res, Exception):
            active_user_ids = set(p["user_id"] for p in (payments_res.data or []) if p.get("user_id"))
            stats["active_subs"] = len(active_user_ids)

        if not isinstance(users_res, Exception):
            if hasattr(users_res, 'count') and users_res.count is not None:
                stats["total_logins"] = users_res.count
            else:
                stats["total_logins"] = len(users_res.data) if users_res.data else 0

        if not isinstance(visitors_res, Exception):
            if hasattr(visitors_res, 'count') and visitors_res.count is not None:
                stats["total_visitors"] = visitors_res.count
            else:
                stats["total_visitors"] = len(visitors_res.data) if visitors_res.data else 0

        if not isinstance(failed_res, Exception):
            if hasattr(failed_res, 'count') and failed_res.count is not None:
                stats["failed_payments"] = failed_res.count
            else:
                stats["failed_payments"] = len(failed_res.data) if failed_res.data else 0

        if not isinstance(peak_res, Exception) and peak_res.data and len(peak_res.data) > 0:
            val = peak_res.data[0].get("value", {})
            stats["peak_concurrent_users"] = val.get("count", 0)
            stats["peak_timestamp"] = val.get("timestamp")
        elif isinstance(peak_res, Exception):
            print(f"[Admin Stats] Peak concurrent query failed (non-fatal): {peak_res}")

        if not isinstance(high_risk_res, Exception):
            if hasattr(high_risk_res, 'count') and high_risk_res.count is not None:
                stats["high_risk_users"] = high_risk_res.count
            else:
                stats["high_risk_users"] = len(high_risk_res.data) if high_risk_res.data else 0

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
    if not sc.supabase:
        return {}

    now = datetime.now(timezone.utc)
    
    dt_start = None
    dt_end = now
    
    PROD_START_DATE = datetime(2026, 5, 28, tzinfo=timezone.utc)
    
    if time_filter == "today":
        ist_now = now + IST_OFFSET
        ist_midnight = ist_now.replace(hour=0, minute=0, second=0, microsecond=0)
        dt_start = ist_midnight - IST_OFFSET
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

        # Fetch Payments — time-filtered, for revenue totals, trend, and breakdown.
        payments_query = supabase.table("payments").select("amount, plan_type, created_at, user_id").eq("status", "success")
        if dt_start:
            payments_query = payments_query.gte("created_at", dt_start.isoformat())
        if dt_end:
            payments_query = payments_query.lte("created_at", dt_end.isoformat())
        if plan_filter != "all":
            payments_query = payments_query.eq("plan_type", plan_filter)
        if dev_user_ids:
            payments_query = payments_query.not_.in_("user_id", dev_user_ids)

        # Active Subscriptions — unique users who currently have credits > 0.
        # Source of truth: credit_buckets table (remaining_credits column).
        # This matches exactly what result/page.tsx reads to check user access.
        # status IN ('active', 'queued', 'fallback') AND remaining_credits > 0
        # Runs in PARALLEL with payments query — zero added latency.
        active_users_query = (
            supabase.table("credit_buckets")
            .select("user_id")
            .in_("status", ["active", "queued", "fallback"])
            .gt("remaining_credits", 0)
        )
        if dev_user_ids:
            active_users_query = active_users_query.not_.in_("user_id", dev_user_ids)

        payments_res, active_users_res = await asyncio.gather(
            _sb(payments_query),
            _sb(active_users_query),
        )
        payments = payments_res.data or []

        # Total Revenue — sum of all successful payments in the selected time window
        total_revenue = sum(p.get("amount", 0) for p in payments) // 100

        # Count DISTINCT users (one user can have multiple bucket rows)
        active_subscriptions = len(set(
            r["user_id"] for r in (active_users_res.data or []) if r.get("user_id")
        ))

        # Breakdown: count purchases and revenue per plan from payments
        plan_counts = {"regular": 0, "student": 0, "pay_per_use": 0}
        plan_mrr = {"regular": 0, "student": 0, "pay_per_use": 0}

        # Calculate total transactions per plan and Total MRR/Revenue
        for p in payments:
            ptype = p.get("plan_type")
            amt = p.get("amount", 0) // 100
            if ptype in plan_counts:
                plan_counts[ptype] += 1
            else:
                plan_counts[ptype] = 1
                
            if ptype in plan_mrr:
                plan_mrr[ptype] += amt
            else:
                plan_mrr[ptype] = amt

        breakdown = [
            {
                "name": "Student", "price": 99, "users": plan_counts.get("student", 0), "mrr": plan_mrr.get("student", 0),
                "color": "bg-[#12f8d7]/15", "textColor": "text-[#006859]", "barColor": "bg-gradient-to-r from-[#006859] to-[#12f8d7]"
            },
            {
                "name": "Standard", "price": 199, "users": plan_counts.get("regular", 0), "mrr": plan_mrr.get("regular", 0),
                "color": "bg-purple-50", "textColor": "text-purple-700", "barColor": "bg-gradient-to-r from-purple-500 to-purple-400"
            },
            {
                "name": "One-Time", "price": 29, "users": plan_counts.get("pay_per_use", 0), "mrr": plan_mrr.get("pay_per_use", 0),
                "color": "bg-blue-50", "textColor": "text-blue-700", "barColor": "bg-blue-400"
            }
        ]
        
        if plan_filter == "student":
            breakdown = [b for b in breakdown if b["name"] == "Student"]
        elif plan_filter == "regular":
            breakdown = [b for b in breakdown if b["name"] == "Standard"]
        elif plan_filter == "pay_per_use":
            breakdown = [b for b in breakdown if b["name"] == "One-Time"]
            
        trend = build_trend_data(payments, dt_start, dt_end, time_filter, "amount", lambda x: x // 100)

        return {
            "total_revenue": total_revenue,
            "active_subscriptions": active_subscriptions,
            # Total Purchases = all successful payment transactions in this time window
            "subscription_count": len(payments),
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
        ist_now = now + IST_OFFSET
        ist_midnight = ist_now.replace(hour=0, minute=0, second=0, microsecond=0)
        utc_midnight = ist_midnight - IST_OFFSET
        for i in range(24):
            start_hr = utc_midnight + timedelta(hours=i)
            end_hr = start_hr + timedelta(hours=1)
            ist_start_hr = start_hr + IST_OFFSET
            label = ist_start_hr.strftime("%H:00")
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
    if not sc.supabase:
        return {}
        
    now = datetime.now(timezone.utc)
    dt_start = None
    dt_end = now
    
    PROD_START_DATE = datetime(2026, 5, 28, tzinfo=timezone.utc)
    
    if time_filter == "today":
        ist_now = now + IST_OFFSET
        ist_midnight = ist_now.replace(hour=0, minute=0, second=0, microsecond=0)
        dt_start = ist_midnight - IST_OFFSET
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
        
        dl_res = await _sb(dl_query)
        downloads = dl_res.data or []
        
        user_ids = list(set(d.get("user_id") for d in downloads if d.get("user_id")))

        # Use payments as the single source of truth for plan type.
        # Most recent successful payment = the plan the user actually paid for,
        # regardless of whether their subscription is currently active.
        user_plans = {}
        if user_ids:
            pmt_res = await _sb(
                supabase.table("payments")
                .select("user_id, plan_type")
                .in_("user_id", user_ids)
                .eq("status", "success")
                .order("created_at", desc=True)
            )
            for p in pmt_res.data or []:
                uid = p.get("user_id")
                # First occurrence per user = most recent payment (desc order)
                if uid and uid not in user_plans:
                    user_plans[uid] = p.get("plan_type", "free")
                    
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
                        # Legacy fallback: no _category field on old sessions.
                        # ats_score_after > 0 means a JD was used → jd_optimized.
                        # ats_score_after = 0 means no JD → no_jd (First Resume).
                        # There is no true "unknown" — every session is one of the 3 categories.
                        score = output.get("ats_score_after", 0)
                        cat = "jd_optimized" if score > 0 else "no_jd"
                    session_categories[s["id"]] = cat

        # No "unknown" category — every download belongs to one of the 3 real categories.
        # Downloads with no session_id are classified as no_jd (no JD/session context).
        category_counts = {"jd_optimized": 0, "no_jd": 0, "no_changes": 0}
        device_counts = {"desktop": 0, "mobile": 0}
        
        for d in downloads:
            sid = d.get("session_id")
            # No session_id = no JD was used → no_jd (First Resume)
            cat = session_categories.get(sid, "no_jd") if sid else "no_jd"
            if cat in category_counts: category_counts[cat] += 1
            else: category_counts[cat] = 1
            
            dev = d.get("device_type") or "desktop"  # NULL = pre-tracking = desktop (mobile was never logged before keepalive fix)
            if dev == "mobile":
                device_counts["mobile"] += 1
            else:
                device_counts["desktop"] += 1
            
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
    if sc.supabase:
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
    if not sc.supabase:
        return {"landing": 0, "result": 0, "purchases": 0}
    try:
        # Exclude dev/test accounts from payments only.
        # Page visits are tracked anonymously (user_id=NULL), so NOT IN filter
        # would silently drop all anonymous rows — do NOT apply it to page_visits.
        dev_users_res = await _sb(supabase.table("users").select("id").in_("email", DEV_EMAILS))
        dev_user_ids = [u["id"] for u in (dev_users_res.data or [])]

        # 1 & 2. Visits: Only count people who are not signed up/logged in (user_id is null).
        # This gives pure new user metrics and automatically excludes dev users.
        landing_q  = supabase.table("page_visits").select("id", count="exact").eq("page_type", "landing").is_("user_id", "null").gte("visited_at", "2026-05-28T00:00:00Z")
        result_q   = supabase.table("page_visits").select("id", count="exact").eq("page_type", "result").is_("user_id", "null").gte("visited_at", "2026-05-28T00:00:00Z")
        
        # 3. Purchases: Fetch user_ids instead of count, to calculate unique paid users
        purchase_q = supabase.table("payments").select("user_id").eq("status", "success").gte("created_at", "2026-05-28T00:00:00Z")

        # Exclude dev accounts from purchases
        if dev_user_ids:
            purchase_q = purchase_q.not_.in_("user_id", dev_user_ids)

        # All 3 queries in parallel — non-blocking
        landing, result, purchases = await asyncio.gather(
            _sb(landing_q),
            _sb(result_q),
            _sb(purchase_q),
        )

        def extract_count(res):
            if hasattr(res, 'count') and res.count is not None:
                return res.count
            return len(res.data) if res.data else 0

        # Unique paid users
        unique_buyers = set(p["user_id"] for p in (purchases.data or []) if p.get("user_id"))

        return {
            "landing": extract_count(landing),
            "result": extract_count(result),
            "purchases": len(unique_buyers)
        }
    except Exception as e:
        print(f"Funnel Stats Error: {str(e)}")
        return {"landing": 0, "result": 0, "purchases": 0}


class ApplyReferralRequest(BaseModel):
    referral_code: str

@router.post("/user/apply-referral")
async def apply_referral(body: ApplyReferralRequest, authorization: str = Header(None)):
    if not sc.supabase:
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
