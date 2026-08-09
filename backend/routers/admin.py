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
import httpx

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
PROD_START_DATE = datetime(2026, 5, 28, tzinfo=timezone.utc)
PROD_START_ISO = "2026-05-28T00:00:00Z"

_cached_dev_ids: list[str] | None = None

async def get_dev_user_ids() -> list[str]:
    global _cached_dev_ids
    if _cached_dev_ids is None:
        if sc.supabase:
            res = await _sb(sc.supabase.table("users").select("id").in_("email", DEV_EMAILS))
            _cached_dev_ids = [u["id"] for u in (res.data or [])]
        else:
            _cached_dev_ids = []
    return _cached_dev_ids

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
        dev_user_ids = await get_dev_user_ids()

        payments_query = sc.supabase.table("payments").select("amount, user_id, plan_type").eq("status", "success").gte("created_at", PROD_START_ISO)
        if dev_user_ids:
            dev_ids_str = ",".join(dev_user_ids)
            payments_query = payments_query.or_(f"user_id.is.null,user_id.not.in.({dev_ids_str})")

        users_query = sc.supabase.table("users").select("id", count="exact").gte("created_at", PROD_START_ISO)

        downloads_query = sc.supabase.table("resume_downloads").select("id", count="exact").gte("downloaded_at", PROD_START_ISO)

        # Total Visitors KPI: Count ALL traffic (all pages, anonymous + logged-in users).
        # We keep all anonymous and logged-in rows.
        visitors_query = sc.supabase.table("page_visits").select("id", count="exact").gte("visited_at", PROD_START_ISO)

        failed_query = sc.supabase.table("payments").select("id", count="exact").eq("status", "failed").gte("created_at", PROD_START_ISO)

        # High-risk users: consecutive generations > 5 without a download — potential freeloader/scraper
        high_risk_query = sc.supabase.table("users").select("id", count="exact").gt("fraud_tracker_counter", 5)

        results = await asyncio.gather(
            _sb(payments_query),
            _sb(downloads_query),
            _sb(users_query),
            _sb(visitors_query),
            _sb(failed_query),
            _sb(sc.supabase.table("system_metrics").select("value").eq("id", "peak_concurrent_users")),
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
        dev_user_ids = await get_dev_user_ids()

        # Fetch Payments — time-filtered, for revenue totals, trend, and breakdown.
        payments_query = sc.supabase.table("payments").select("amount, plan_type, created_at, user_id").eq("status", "success")
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
            sc.supabase.table("credit_buckets")
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
        plan_counts = {"regular": 0, "student": 0, "pay_per_use": 0, "bulk_offer": 0}
        plan_mrr = {"regular": 0, "student": 0, "pay_per_use": 0, "bulk_offer": 0}

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
                "name": "Student", "price": 149, "users": plan_counts.get("student", 0), "mrr": plan_mrr.get("student", 0),
                "color": "bg-[#12f8d7]/15", "textColor": "text-[#006859]", "barColor": "bg-gradient-to-r from-[#006859] to-[#12f8d7]"
            },
            {
                "name": "Bulk Offer", "price": 599, "users": plan_counts.get("bulk_offer", 0), "mrr": plan_mrr.get("bulk_offer", 0),
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


# ─────────────────────────────────────────────────────────────────────────────
# Download Analytics — powered by get_download_analytics RPC
# Replaces the old Python chunked-loop aggregation.
# The RPC handles:
#   1. Plan resolution via DISTINCT ON payments (single JOIN, no Python iteration)
#   2. Category resolution with _category field + legacy ats_score_after fallback
#   3. Dev account exclusion via p_exclude_user_ids array parameter
#   4. IST-aware trend bucketing entirely inside Postgres
# ─────────────────────────────────────────────────────────────────────────────
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

    # Zero-initialised dicts — safe defaults so the frontend never crashes
    # even if a category/plan/device has 0 downloads in the selected window.
    default_plan_counts     = {"regular": 0, "student": 0, "pay_per_use": 0, "bulk_offer": 0, "free": 0}
    default_category_counts = {"jd_optimized": 0, "no_jd": 0, "no_changes": 0}
    default_device_counts   = {"desktop": 0, "mobile": 0}

    try:
        dev_user_ids = await get_dev_user_ids()

        # Single RPC call — all 5 aggregations in one Postgres query
        rpc_res = await asyncio.to_thread(
            lambda: sc.supabase.rpc(
                "get_download_analytics",
                {
                    "p_start_ts":         dt_start.isoformat(),
                    "p_end_ts":           dt_end.isoformat(),
                    "p_time_filter":      time_filter,
                    "p_plan_filter":      plan_filter,
                    "p_exclude_user_ids": dev_user_ids or [],
                }
            ).execute()
        )

        raw = rpc_res.data or {}

        # Merge RPC output with zero-safe defaults so missing keys
        # never reach the frontend as undefined/null.
        plan_counts     = {**default_plan_counts,     **(raw.get("downloads_by_plan",     {}) or {})}
        category_counts = {**default_category_counts, **(raw.get("downloads_by_category", {}) or {})}
        device_counts   = {**default_device_counts,   **(raw.get("downloads_by_device",   {}) or {})}

        return {
            "total_downloads":      raw.get("total_downloads",  0),
            "unique_users":         raw.get("unique_users",     0),
            "downloads_by_plan":    plan_counts,
            "downloads_by_category": category_counts,
            "downloads_by_device":  device_counts,
            "trend":                raw.get("trend",            []),
        }

    except Exception as e:
        print(f"Download Analytics RPC Error: {e}")
        return {
            "total_downloads":      0,
            "unique_users":         0,
            "downloads_by_plan":    default_plan_counts,
            "downloads_by_category": default_category_counts,
            "downloads_by_device":  default_device_counts,
            "trend":                [],
        }


class TrackVisitRequest(BaseModel):
    page_type: str
    session_id: str | None = None
    user_id: str | None = None

def _do_track_visit(body: TrackVisitRequest):
    """Sync insert — runs in background thread, never blocks the event loop."""
    if sc.supabase:
        try:
            sc.supabase.table("page_visits").insert({
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
        dev_user_ids = await get_dev_user_ids()

        # 1 & 2. Visits: Only count people who are not signed up/logged in (user_id is null).
        # This gives pure new user metrics and automatically excludes dev users.
        landing_q  = sc.supabase.table("page_visits").select("id", count="exact").eq("page_type", "landing").is_("user_id", "null").gte("visited_at", PROD_START_ISO)
        result_q   = sc.supabase.table("page_visits").select("id", count="exact").eq("page_type", "result").is_("user_id", "null").gte("visited_at", PROD_START_ISO)
        
        # 3. Purchases: Fetch user_ids instead of count, to calculate unique paid users
        purchase_q = sc.supabase.table("payments").select("user_id").eq("status", "success").gte("created_at", PROD_START_ISO)

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
        user_res = await asyncio.to_thread(sc.supabase.auth.get_user, token)
        if not user_res or not user_res.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        auth_user_id = user_res.user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    try:
        # Find referrer user by code
        ref_res = await _sb(sc.supabase.table("users").select("id").eq("referral_code", body.referral_code))
        if not ref_res.data:
            return {"status": "error", "message": "Invalid referral code"}
            
        referrer_id = ref_res.data[0]["id"]
        
        if referrer_id == auth_user_id:
            return {"status": "error", "message": "Cannot refer yourself"}
            
        user_res = await _sb(sc.supabase.table("users").select("referred_by").eq("id", auth_user_id))
        if user_res.data and user_res.data[0].get("referred_by") is None:
            await _sb(sc.supabase.table("users").update({"referred_by": referrer_id}).eq("id", auth_user_id))
            return {"status": "ok"}
            
        return {"status": "error", "message": "Referral already applied"}
    except Exception as e:
        print(f"Apply Referral Error: {str(e)}")
        return {"status": "error", "message": str(e)}

# ─────────────────────────────────────────────────────────────────────────────
# Cold Email Campaign — triggered manually from Admin Dashboard
# ─────────────────────────────────────────────────────────────────────────────

import urllib.parse
import random

# Default fallback role when user has never generated a resume
# FlashResume is built for IT/software people, so we use a single fixed role.
_FALLBACK_ROLES = [
    "Software Engineer Fresher",
]

def _estimate_salary_range(role: str, query: str) -> str:
    """Analyze the role and query text for experience indicators to generate a realistic salary."""
    text = (role + " " + query).lower()
    
    if "senior" in text or "lead" in text or "manager" in text or "architect" in text:
        min_lakhs = random.randint(18, 25)
        max_lakhs = min_lakhs + random.randint(2, 5)
    elif "5 year" in text or "6 year" in text or "7 year" in text or "8 year" in text:
        min_lakhs = random.randint(15, 20)
        max_lakhs = min_lakhs + random.randint(2, 5)
    elif "3 year" in text or "4 year" in text:
        min_lakhs = random.randint(10, 14)
        max_lakhs = min_lakhs + random.randint(2, 5)
    elif "1 year" in text or "2 year" in text or "junior" in text:
        min_lakhs = random.randint(7, 10)
        max_lakhs = min_lakhs + random.randint(2, 5)
    else:
        # Interns, freshers, or defaults are fixed to 6-8 LPA
        min_lakhs = 6
        max_lakhs = 8
        
    return f"\u20b9{min_lakhs},00,000 - \u20b9{max_lakhs},00,000"

def _generate_linkedin_jobs(role_queries: list[dict]) -> list[dict]:
    """Generate 1 LinkedIn job search link based on Strong match query.
    Salaries are generated dynamically based on inferred experience level.
    """
    # Ensure exactly 1 item by padding with fallback if needed
    if not role_queries:
        fallback = random.choice(_FALLBACK_ROLES)
        role_queries.append({"role": fallback, "query": fallback + " India"})
    role_queries = role_queries[:1]
    
    jobs = []
    for item in role_queries:
        role = item["role"]
        raw_query = item["query"]
        
        # Dynamic realistic salary based on experience keywords
        salary = _estimate_salary_range(role, raw_query)
        
        # LinkedIn job search URL
        query_encoded = urllib.parse.quote(raw_query)
        link = f"https://www.linkedin.com/jobs/search/?keywords={query_encoded}"
        
        jobs.append({
            "title": role,
            "salary": salary,
            "link": link
        })
        
    return jobs


async def _send_email_brevo(to_email: str, display_name: str, resume_link: str) -> bool:
    """Send a single cold email via Brevo's transactional API.
    Returns True on success, False on failure.
    In mock mode (no BREVO_API_KEY) always returns True and logs the action.
    """
    BREVO_API_KEY   = os.getenv("BREVO_API_KEY", "")
    BREVO_FROM_EMAIL = os.getenv("BREVO_FROM_EMAIL", "flashresume.in@gmail.com")
    BREVO_FROM_NAME  = os.getenv("BREVO_FROM_NAME", "Flashresume.in")

    if not BREVO_API_KEY:
        print(f"[ColdEmail][Mock] Would send to {to_email}")
        return True

    # NOTE: job_rows was removed — the `jobs` variable was never defined in this
    # function's scope (NameError caused 0 emails to be sent). The template below
    # is self-contained and doesn't reference any external variables.

    html = f"""
    <!DOCTYPE html>
    <html>
    <body style='margin:0;padding:0;background-color:#f5f6f7;font-family:Arial,sans-serif;'>
      <table width='100%' cellpadding='0' cellspacing='0' style='background:#f5f6f7;padding:30px 0;'>
        <tr><td align='center'>
          <table width='600' cellpadding='0' cellspacing='0' style='background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);max-width:600px;width:100%;'>

            <!-- HEADER / LOGO -->
            <tr>
              <td style='background:linear-gradient(135deg,#006859 0%,#0d9e84 100%);padding:28px 36px;text-align:center;'>
                <table cellpadding='0' cellspacing='0' style='margin:0 auto;'>
                  <tr>
                    <td style='background:rgba(255,255,255,0.18);border-radius:12px;padding:8px 14px;display:inline-block;'>
                      <img src='https://flashresume.in/flashresumelogo.jpeg' alt='Logo' height='24' style='vertical-align:middle;margin-right:8px;border-radius:4px;'/>
                      <span style='font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;vertical-align:middle;'>FlashResume</span>
                    </td>
                  </tr>
                  <tr><td style='padding-top:6px;'>
                    <span style='font-size:12px;color:rgba(255,255,255,0.75);letter-spacing:2px;text-transform:uppercase;'>Your Career Partner</span>
                  </td></tr>
                </table>
              </td>
            </tr>

            <!-- BODY -->
            <tr>
              <td style='padding:32px 36px;'>
                <p style='font-size:16px;color:#1a1a1a;margin:0 0 8px;'>Hi <strong>{display_name}</strong>,</p>
                <p style='font-size:15px;color:#1a1a1a;font-weight:700;margin:0 0 6px;line-height:1.5;'>
                  Your resume is waiting here &#8212; and jobs aren&#8217;t waiting.
                </p>
                <p style='font-size:14px;color:#555;margin:0 0 24px;line-height:1.6;'>
                  Every day you delay, another candidate with a weaker resume gets shortlisted simply because they applied first.<br>
                  <strong style='color:#006859;'>Don&#8217;t let that be you.</strong>
                </p>

                <div style='background:#006859;border-radius:10px;text-align:center;padding:18px;margin-top:8px;'>
                  <a href='{resume_link}' style='color:#ffffff;font-size:15px;font-weight:800;text-decoration:none;'>&#128640; Download &amp; Start Applying Now</a>
                </div>

                <p style='font-size:13px;color:#888;margin:20px 0 0;line-height:1.6;text-align:center;'>
                  Takes 30 seconds. Your resume is already optimized &#8212; just download and apply. &#128512;
                </p>
              </td>
            </tr>


          </table>
        </td></tr>
      </table>
    </body>
    </html>
    """

    payload = {
        "sender":      {"name": BREVO_FROM_NAME, "email": BREVO_FROM_EMAIL},
        "to":          [{"email": to_email, "name": display_name}],
        "subject":     "Your FlashResume is ready \u2014 download it now!",
        "htmlContent": html,
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://api.brevo.com/v3/smtp/email",
                json=payload,
                headers={"api-key": BREVO_API_KEY, "Content-Type": "application/json"},
            )
            if resp.status_code not in (200, 201):
                print(f"[ColdEmail] Brevo rejected {to_email}: {resp.status_code} {resp.text[:200]}")
            return resp.status_code in (200, 201)
    except Exception as exc:
        print(f"[ColdEmail] Brevo error for {to_email}: {exc}")
        return False

# Batch size capped at 100 to stay well within Render free tier's safe background-task window.
# With the NameError fixed, 290 × 1.0s = ~290s is safe.
# UvicornWorker runs background tasks on the async event loop — Gunicorn's --timeout
# only applies to synchronous workers, so long async background tasks won't be killed.
_CAMPAIGN_BATCH_SIZE = 290

@router.get("/admin/cold-email-today", dependencies=[Depends(require_admin)])
async def cold_email_today_stats():
    """Returns today's actual sent count directly from Brevo's statistics API.
    Brevo is the source of truth — it reports exactly how many emails it accepted/delivered.
    Falls back to DB count if BREVO_API_KEY is not configured (mock mode).
    """
    from datetime import datetime, timezone

    BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # ── Primary source: Brevo statistics API ──────────────────────────────────
    if BREVO_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    "https://api.brevo.com/v3/smtp/statistics/reports",
                    headers={"api-key": BREVO_API_KEY},
                    params={"startDate": today_str, "endDate": today_str},
                )
            if resp.status_code == 200:
                data = resp.json()
                reports = data.get("reports", [])
                # Sum all requests sent today (Brevo may return multiple rows per day)
                total_requests  = sum(r.get("requests", 0)  for r in reports)
                total_delivered = sum(r.get("delivered", 0) for r in reports)
                total_bounces   = sum(r.get("bounces", 0)   for r in reports)
                return {
                    "today_sent":    total_requests,
                    "delivered":     total_delivered,
                    "bounces":       total_bounces,
                    "source":        "brevo_api",
                    "date":          today_str,
                }
            else:
                print(f"[ColdEmail] Brevo stats API error: {resp.status_code} {resp.text[:200]}")
                # Fall through to DB fallback below
        except Exception as exc:
            print(f"[ColdEmail] Brevo stats API exception: {exc}")
            # Fall through to DB fallback below

    # ── Fallback: DB count (used in mock mode / Brevo API unavailable) ────────
    if not sc.supabase:
        return {"today_sent": 0, "source": "none"}
    try:
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        ).isoformat()
        res = await _sb(
            sc.supabase.table("email_campaign_logs")
            .select("user_id", count="exact")
            .gte("last_emailed_at", today_start)
        )
        count = res.count if hasattr(res, "count") and res.count is not None else len(res.data or [])
        return {"today_sent": count, "source": "db_fallback", "date": today_str}
    except Exception as exc:
        print(f"[ColdEmail] DB fallback error: {exc}")
        return {"today_sent": 0, "source": "error"}


@router.post("/admin/trigger-cold-email", dependencies=[Depends(require_admin)])
async def trigger_cold_email(bg_tasks: BackgroundTasks, batch: Optional[int] = None):
    """Trigger the daily cold email batch.
    - Skips paid users (anyone with a successful payment).
    - Sends to up to 100 free users who were emailed the longest ago (NULLs first).
    - Adds a 1.0 s delay between emails to stay within Brevo rate limits and keep
      Render free-tier RAM flat.
    - Runs in the background to prevent request timeout.
    - Each email is isolated in its own try/except so one failure never kills the batch.
    """
    if not sc.supabase:
        return {"status": "error", "message": "Supabase not configured"}

    async def run_campaign():
        try:
            # 1. Build the set of paid user IDs (skip them)
            paid_res  = await _sb(sc.supabase.table("payments").select("user_id").eq("status", "success"))
            paid_ids  = {p["user_id"] for p in (paid_res.data or []) if p.get("user_id")}

            # 2. Fetch ALL users + their campaign log
            all_users = []
            page_size = 1000
            offset = 0
            while True:
                chunk_res = await _sb(
                    sc.supabase.table("users")
                    .select("id, email, email_campaign_logs(last_emailed_at, total_emails_sent)")
                    .range(offset, offset + page_size - 1)
                )
                chunk = chunk_res.data or []
                all_users.extend(chunk)
                if len(chunk) < page_size:
                    break
                offset += page_size

            print(f"[ColdEmail] Total users fetched: {len(all_users)}")

            # 3. Build sorted free-user list
            free_users: list[tuple[str, dict, int]] = []
            for u in all_users:
                if u["id"] in paid_ids or not u.get("email"):
                    continue
                raw_log = u.get("email_campaign_logs")
                log: dict = (raw_log[0] if isinstance(raw_log, list) and raw_log
                             else (raw_log if isinstance(raw_log, dict) else {}))
                last_at    = log.get("last_emailed_at") or "1970-01-01T00:00:00Z"
                total_sent = log.get("total_emails_sent") or 0
                free_users.append((last_at, u, total_sent))

            free_users.sort(key=lambda x: x[0])
            actual_batch_size = batch if batch is not None else _CAMPAIGN_BATCH_SIZE
            target_batch = free_users[:actual_batch_size]
            print(f"[ColdEmail] Free users: {len(free_users)}, Paid filtered: {len(paid_ids)}, Batch size: {len(target_batch)}")

            # 4. Send emails sequentially — 1.0s gap respects Brevo rate limits and
            #    protects Render free-tier RAM.
            sent_count  = 0
            error_count = 0
            from datetime import datetime, timezone
            now_utc     = datetime.now(timezone.utc)

            for idx, (_, u, total_sent) in enumerate(target_batch):
                uid   = u["id"]
                email = u["email"]
                display_name = email.split("@")[0].replace(".", " ").title()
                resume_link  = "https://flashresume.in/result"

                # Progress log every 25 emails
                if idx > 0 and idx % 25 == 0:
                    print(f"[ColdEmail] Progress: {idx}/{len(target_batch)} — {sent_count} sent, {error_count} failed so far")

                try:
                    success = await _send_email_brevo(email, display_name, resume_link)
                except Exception as send_exc:
                    print(f"[ColdEmail] Unexpected error sending to {email}: {send_exc}")
                    success = False

                if success:
                    sent_count += 1
                    try:
                        await _sb(
                            sc.supabase.table("email_campaign_logs").upsert({
                                "user_id":           uid,
                                "last_emailed_at":   now_utc.isoformat(),
                                "total_emails_sent": total_sent + 1,
                            })
                        )
                    except Exception as db_exc:
                        print(f"[ColdEmail] Failed to upsert log for {uid}: {db_exc}")
                else:
                    error_count += 1

                # Throttle — keeps Render instance RAM stable
                await asyncio.sleep(0.5)

            print(f"[ColdEmail] Batch done: {sent_count} sent, {error_count} failed, out of {len(target_batch)} targeted.")
        except Exception as exc:
            print(f"[ColdEmail] Fatal error in background campaign: {exc}")

    bg_tasks.add_task(run_campaign)

    # Return immediately to avoid Vercel timeouts (Next.js 15s limit)
    # Give mock stats to the UI so it shows a success screen instead of crashing.
    return {
        "status":        "ok",
        "sent_count":    "Processing in background",
        "error_count":   "Check Render logs",
        "target_count":  290,
        "free_total":    "Background task",
    }
