import os
import asyncio
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel

# Load environment variables before importing routers that depend on them
load_dotenv()

from routers import parse, analyze, generate, payments, admin, sessions, feedback
import supabase_client as sc
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from rate_limiter import limiter

app = FastAPI(title="FlashResume API", version="1.0.0")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://flashresume.in",
    "https://www.flashresume.in",
]

FRONTEND_URL = os.getenv("FRONTEND_URL")
if FRONTEND_URL:
    for url in FRONTEND_URL.split(","):
        clean_url = url.strip()
        if clean_url:
            ALLOWED_ORIGINS.append(clean_url)
            # Auto-add www. version if it's a root domain
            if clean_url.startswith("https://") and "www." not in clean_url:
                ALLOWED_ORIGINS.append(clean_url.replace("https://", "https://www."))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# ── Suppress noisy health-poll log lines from filling the terminal ──
class _SuppressHealthPolls(logging.Filter):
    """Filter out repetitive admin polling requests from uvicorn access log."""
    _QUIET = {"/health/queue", "/api/admin/llm-stats"}
    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        return not any(path in msg for path in self._QUIET)

logging.getLogger("uvicorn.access").addFilter(_SuppressHealthPolls())

app.include_router(parse.router, prefix="/api")
app.include_router(analyze.router, prefix="/api")
app.include_router(generate.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")
app.include_router(feedback.router, prefix="/api")

ACTIVE_SESSIONS = {}
peak_record = {"count": -1, "timestamp": None}
_peak_upsert_tasks: set = set()  # Hold references to prevent GC
_peak_load_lock = asyncio.Lock()  # Prevents race condition during lazy-load


@app.on_event("startup")
async def load_peak_on_startup():
    """Eagerly load the persisted peak from Supabase at server boot.
    This eliminates the lazy-load race condition where multiple simultaneous
    pings all see peak_record["count"] == -1 and potentially overwrite Supabase
    with a lower current count before the real peak is loaded.
    """
    if not sc.supabase:
        peak_record["count"] = 0
        return
    try:
        res = await asyncio.to_thread(
            lambda: sc.supabase.table("system_metrics")
                .select("value")
                .eq("id", "peak_concurrent_users")
                .execute()
        )
        if hasattr(res, 'data') and res.data and len(res.data) > 0:
            peak_record["count"] = res.data[0]["value"].get("count", 0)
            peak_record["timestamp"] = res.data[0]["value"].get("timestamp")
        else:
            peak_record["count"] = 0
        print(f"[Startup] Peak concurrent loaded: {peak_record['count']} (at {peak_record['timestamp']})")
    except Exception as e:
        print(f"[Startup] Failed to load peak concurrent (non-fatal): {e}")
        peak_record["count"] = 0

class PingRequest(BaseModel):
    user_id: str

@app.post("/api/presence/ping")
async def ping_presence(data: PingRequest):
    if not sc.supabase:
        return {"status": "error"}
        
    now = datetime.now(timezone.utc)
    ACTIVE_SESSIONS[data.user_id] = now
    
    # Cleanup stale sessions — timeout is 180s (3 min) to match the 2-min ping interval
    # in PresenceTracker.tsx. The extra 60s is a safety buffer for slow/backgrounded browsers.
    stale = [k for k, v in ACTIVE_SESSIONS.items() if (now - v).total_seconds() > 180]
    for k in stale:
        del ACTIVE_SESSIONS[k]
        
    current_count = len(ACTIVE_SESSIONS)
    
    # Fallback lazy-load in case startup event didn't complete (e.g. Supabase was slow).
    # Double-checked lock prevents multiple simultaneous pings from all racing to load
    # and potentially overwriting Supabase with a stale/lower count.
    if peak_record["count"] == -1:
        async with _peak_load_lock:
            if peak_record["count"] == -1:  # Re-check inside lock
                try:
                    res = await asyncio.to_thread(lambda: sc.supabase.table("system_metrics").select("value").eq("id", "peak_concurrent_users").execute())
                    if hasattr(res, 'data') and res.data and len(res.data) > 0:
                        peak_record["count"] = res.data[0]["value"].get("count", 0)
                        peak_record["timestamp"] = res.data[0]["value"].get("timestamp")
                    else:
                        peak_record["count"] = 0
                except Exception:
                    peak_record["count"] = 0  # Safe fallback — never leave at -1
            
    if current_count > peak_record["count"]:
        peak_record["count"] = current_count
        peak_record["timestamp"] = now.isoformat()
        try:
            # Upsert new peak — store task reference to prevent GC before completion
            task = asyncio.create_task(asyncio.to_thread(
                lambda: sc.supabase.table("system_metrics").upsert({
                    "id": "peak_concurrent_users",
                    "value": {"count": current_count, "timestamp": now.isoformat()}
                }).execute()
            ))
            _peak_upsert_tasks.add(task)
            task.add_done_callback(_peak_upsert_tasks.discard)
        except Exception:
            pass
            
    return {"status": "ok", "live": current_count}

@app.get("/api/presence/count")
async def get_presence_count():
    """Lightweight endpoint for admin dashboard Live Users + Peak cards.
    Reads ONLY from in-memory state — zero Supabase egress per call.
    Polled every 30 seconds by the admin dashboard instead of the old
    15-second full-stats refresh that ran 7 Supabase queries each time.
    """
    now = datetime.now(timezone.utc)
    # Evict stale sessions (>180s = 3 min, matching the 2-min ping interval + 60s buffer)
    stale = [k for k, v in ACTIVE_SESSIONS.items() if (now - v).total_seconds() > 180]
    for k in stale:
        del ACTIVE_SESSIONS[k]
    return {
        "live": len(ACTIVE_SESSIONS),
        "peak": peak_record["count"] if peak_record["count"] != -1 else 0,
        "peak_timestamp": peak_record["timestamp"],
    }

@app.get("/")
def root():
    return {"message": "FlashResume API is running", "version": "1.0.0"}

@app.get("/health")
@limiter.limit("60/minute")
def health(request: Request):
    """Keep-alive endpoint — pinged by cron jobs to prevent Render sleep.
    Also pings Supabase to prevent 7-day free-tier inactivity pause.
    This is a sync def, so FastAPI runs it in a thread pool — never blocks the event loop.
    """
    db_status = "inactive"
    if sc.supabase:
        try:
            sc.supabase.table("resume_sessions").select("id").limit(1).execute()
            db_status = "active"
        except Exception as e:
            db_status = f"error: {str(e)}"
    return {"status": "ok", "supabase": db_status}

@app.get("/health/queue")
@limiter.limit("60/minute")
async def get_queue_status(request: Request):
    """Active sessions count — polled every 5s by the Admin Dashboard.
    Uses asyncio.to_thread so the Supabase query never blocks the event loop.
    """
    if not sc.supabase:
        return {"processing": 0}
    try:
        five_mins_ago = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
        res = await asyncio.to_thread(
            lambda: sc.supabase.table("resume_sessions")
                .select("id", count="exact")
                .gte("created_at", five_mins_ago)
                .execute()
        )
        active_count = (
            res.count if hasattr(res, "count") and res.count is not None
            else (len(res.data) if res.data else 0)
        )
        return {"processing": active_count}
    except Exception as e:
        print(f"[health/queue] Error: {e}")
        return {"processing": 0}
