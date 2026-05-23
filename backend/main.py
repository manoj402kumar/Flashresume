import os
import asyncio
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone

# Load environment variables before importing routers that depend on them
load_dotenv()

from routers import parse, analyze, generate, payments, admin, sessions, feedback
from supabase import create_client, Client as SupabaseClient

# Supabase client for main.py endpoints
_SUPABASE_URL = os.getenv("SUPABASE_URL", "")
_SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY", "")
try:
    _supabase: SupabaseClient = create_client(_SUPABASE_URL, _SUPABASE_KEY)
except Exception:
    _supabase = None  # type: ignore

app = FastAPI(title="FlashResume API", version="1.0.0")

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

@app.get("/")
def root():
    return {"message": "FlashResume API is running", "version": "1.0.0"}

@app.get("/health")
def health():
    """Keep-alive endpoint — pinged by cron jobs to prevent Render sleep.
    Also pings Supabase to prevent 7-day free-tier inactivity pause.
    This is a sync def, so FastAPI runs it in a thread pool — never blocks the event loop.
    """
    db_status = "inactive"
    if _supabase:
        try:
            _supabase.table("resume_sessions").select("id").limit(1).execute()
            db_status = "active"
        except Exception as e:
            db_status = f"error: {str(e)}"
    return {"status": "ok", "supabase": db_status}

@app.get("/health/queue")
async def get_queue_status():
    """Active sessions count — polled every 5s by the Admin Dashboard.
    Uses asyncio.to_thread so the Supabase query never blocks the event loop.
    """
    if not _supabase:
        return {"processing": 0}
    try:
        five_mins_ago = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
        res = await asyncio.to_thread(
            lambda: _supabase.table("resume_sessions")
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
