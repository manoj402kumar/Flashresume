# FlashResume Operations Runbook

> **Last verified**: 2026-08-28  
> **Verified against**: `backend/render.yaml`, `backend/worker.py`, `backend/queue_manager.py`, `backend/main.py`

## Deployment Topology
- **Frontend**: Next.js 16 deployed on Vercel.
- **Backend API**: FastAPI application (`main.py`), containerized via Docker, deployed as a Render **Web Service**. Horizontally scalable and fully stateless (all state lives in Redis/Supabase).
- **Worker Fleet**: One or more Render **Background Worker** services, each running `python worker.py`. Each worker process handles `WORKER_CONCURRENCY` jobs concurrently (default: `4`, configurable via ENV). Scale by increasing the number of Render Background Worker instances.
- **Database**: PostgreSQL (Supabase). Stores resume sessions, LLM usage telemetry, round-robin counters, circuit breaker state.
- **Transient Storage**: Supabase Storage bucket `transient-resumes` (production). Falls back to `/backend/storage/transient/` for single-node local development.
- **Redis**: Render Redis instance (or Upstash). Used for: job queue, job state hashes, rate limiting, presence tracking, LLM quota token bucket, pub/sub.

> ⚠️ **Important**: Raw PDFs must never be stored in Redis. Always stored in Object Storage. Redis stores only opaque `file_key` references.

## Starting Services

### Local Development
```bash
# Terminal 1: Core API
cd ~/Desktop/Flashresume/backend
source venv/bin/activate
python -m uvicorn main:app --port 8000 --reload

# Terminal 2: Heavy Worker
cd ~/Desktop/Flashresume/backend
source venv/bin/activate
python worker.py
```
Or use the convenience scripts from the project root:
```bash
./start.sh --reload     # starts Core API
./start_worker.sh       # starts worker
```

### Health Checks
```bash
# Basic API health
curl http://localhost:8000/health

# Redis connectivity readiness (returns 503 if Redis is down)
curl http://localhost:8000/health/readiness

# Queue depth (number of sessions active in last 5 minutes)
curl http://localhost:8000/health/queue
```

## Scaling
- **API**: Scale API nodes as needed. API nodes are fully stateless.
- **Workers**: Deploy additional Render Background Worker instances (each runs `python worker.py`). Increase `WORKER_CONCURRENCY` env var to increase per-process job concurrency.
  > ⚠️ **LLM quota note**: Ensure LLM provider RPM quotas can handle `N_workers × WORKER_CONCURRENCY`. The distributed token bucket protects against storms but insufficient quota causes graceful fallback degradation.

## Monitoring & Alerting
Monitor the following metrics:
- **API 5xx errors**: Indicates API unavailability or Redis disconnects.
- **Queue Depth (`GET /health/queue`)**: Alert if continuously growing without draining.
- **Worker Memory**: Alert if continuously growing beyond 300MB/node.
- **Redis Connections**: Alert if approaching configured connection limit (e.g. 500).
- **LLM Rate Limits (429)**: Track metrics in Supabase `llm_usage` table; use `GET /api/admin/llm-stats` admin endpoint.
- **Presence count**: `GET /api/presence/count` for live and peak concurrent user counts.

## Queue Inspection (Redis CLI)
```bash
# Pending job queue depth
redis-cli LLEN queue:jobs:pending

# Processing queue depth
redis-cli LLEN queue:jobs:processing

# Dead-Letter Queue (DLQ) depth
redis-cli LLEN queue:jobs:dlq

# Inspect a specific job
redis-cli HGETALL job:data:<job_id>

# Per-user active job count
redis-cli SMEMBERS user:active_jobs:<user_id>
```

## Incident Response

### Orphaned Jobs / DLQ
- Check Redis Dead-Letter Queue: `redis-cli LLEN queue:jobs:dlq`
- Inspect failed job: `redis-cli HGETALL job:data:<job_id>`
- Visibility timeout (300s) automatically requeues jobs from `queue:jobs:processing` if workers crash.
- After `MAX_RETRIES=3` failures, jobs move permanently to DLQ. Manual re-enqueueing required via admin API.

### Redis Disconnect / 503
- Check readiness: `curl http://localhost:8000/health/readiness`
- Verify `REDIS_URL` env var points to live Redis instance.
- All job endpoints return `503 Service Unavailable` cleanly when Redis is down.

### Worker Crash
- Worker ignores SIGHUP; handles SIGTERM/SIGINT for graceful shutdown (waits for active tasks).
- Zombie recovery loop runs every 60s and requeues stalled processing jobs.

## Database Migrations
- See `DATABASE_MIGRATIONS.md` before attempting any database schema modifications.
- Destructive changes are strictly prohibited.
