import os
import asyncio
import logging
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
from contextlib import asynccontextmanager

# Load environment variables before importing routers that depend on them
load_dotenv()

from routers import parse, analyze, generate, payments, admin, sessions, feedback, affiliate
import supabase_client as sc
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from rate_limiter import limiter
from redis_client import redis_client

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Enforce Redis connectivity at startup (fail-fast readiness)
    try:
        await asyncio.wait_for(redis_client.ping(), timeout=3.0)
    except Exception as e:
        import logging
        logging.critical(f"FATAL: Redis is unreachable at startup: {e}")
        raise RuntimeError(f"Redis is unreachable. Service cannot start. Details: {e}")

    # Eagerly load the persisted peak from Supabase into Redis
    if sc.supabase:
        try:
            res = await asyncio.wait_for(
                asyncio.to_thread(
                    lambda: sc.supabase.table("system_metrics")
                        .select("value")
                        .eq("id", "peak_concurrent_users")
                        .execute()
                ),
                timeout=1.0
            )
            if hasattr(res, 'data') and res.data and len(res.data) > 0:
                count = res.data[0]["value"].get("count", 0)
                ts = res.data[0]["value"].get("timestamp")
                await redis_client.set("presence:peak_count", count)
                if ts:
                    await redis_client.set("presence:peak_timestamp", str(ts))
                print(f"[Startup] Peak concurrent loaded into Redis: {count} (at {ts})")
        except Exception as e:
            print(f"[Startup] Failed to load peak concurrent (non-fatal): {e}")
            
    yield

    # Teardown logic can go here

app = FastAPI(title="FlashResume API", version="1.0.0", lifespan=lifespan)

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
            if clean_url.startswith("https://") and "www." not in clean_url:
                ALLOWED_ORIGINS.append(clean_url.replace("https://", "https://."))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

class _SuppressHealthPolls(logging.Filter):
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
app.include_router(affiliate.router, prefix="/api")

from routers import jobs
from routers import debug, latex_pdf
app.include_router(jobs.router, prefix="/api/jobs")
app.include_router(latex_pdf.router, prefix="/api")

_peak_upsert_tasks: set = set()

_peak_upsert_tasks: set = set()

class PingRequest(BaseModel):
    user_id: str

@app.post("/api/presence/ping")
async def ping_presence(data: PingRequest):
    """Distributed presence tracking backed by Redis ZSET. 100% stateless across API nodes."""
    now_ts = time.time()
    try:
        # Add user timestamp to Redis ZSET
        await redis_client.zadd("presence:active_users", {data.user_id: now_ts})
        # Evict stale sessions (>180s)
        await redis_client.zremrangebyscore("presence:active_users", 0, now_ts - 180)
        current_count = await redis_client.zcard("presence:active_users")

        cached_peak = await redis_client.get("presence:peak_count")
        peak_count = int(cached_peak) if cached_peak else 0

        if current_count > peak_count:
            await redis_client.set("presence:peak_count", current_count)
            now_iso = datetime.now(timezone.utc).isoformat()
            await redis_client.set("presence:peak_timestamp", now_iso)
            if sc.supabase:
                try:
                    task = asyncio.create_task(asyncio.to_thread(
                        lambda: sc.supabase.table("system_metrics").upsert({
                            "id": "peak_concurrent_users",
                            "value": {"count": current_count, "timestamp": now_iso}
                        }).execute()
                    ))
                    _peak_upsert_tasks.add(task)
                    task.add_done_callback(_peak_upsert_tasks.discard)
                except Exception:
                    pass

        return {"status": "ok", "live": current_count}
    except Exception as e:
        return {"status": "error", "live": 0}

@app.get("/api/presence/count")
async def get_presence_count():
    """Distributed presence count from Redis ZSET."""
    now_ts = time.time()
    try:
        await redis_client.zremrangebyscore("presence:active_users", 0, now_ts - 180)
        live_count = await redis_client.zcard("presence:active_users")
        cached_peak = await redis_client.get("presence:peak_count")
        peak_timestamp = await redis_client.get("presence:peak_timestamp")
        return {
            "live": live_count,
            "peak": int(cached_peak) if cached_peak else 0,
            "peak_timestamp": peak_timestamp,
        }
    except Exception:
        return {"live": 0, "peak": 0, "peak_timestamp": None}

@app.get("/")
def root():
    return {"message": "FlashResume API is running", "version": "1.0.0"}

@app.get("/health")
@limiter.limit("120/minute")
def health(request: Request):
    db_status = "inactive"
    if sc.supabase:
        try:
            sc.supabase.table("resume_sessions").select("id").limit(1).execute()
            db_status = "active"
        except Exception as e:
            db_status = f"error: {str(e)}"
    return {"status": "ok", "supabase": db_status}

@app.get("/health/queue")
@limiter.limit("120/minute")
async def get_queue_status(request: Request):
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
    except Exception:
        return {"processing": 0}

@app.get("/health/readiness")
@limiter.limit("120/minute")
async def readiness(request: Request):
    try:
        await redis_client.ping()
        return {"status": "ready", "redis": "connected"}
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Service Unavailable: Redis disconnected")
try:
    import test_control
    app.include_router(test_control.router, prefix="/api")
except Exception as e:
    pass
try:
    import test_control2
    app.include_router(test_control2.router, prefix="/api")
except Exception:
    pass
try:
    import test_control3
    app.include_router(test_control3.router, prefix="/api")
except Exception:
    pass
try:
    import test_control4
    app.include_router(test_control4.router, prefix="/api")
except Exception:
    pass
