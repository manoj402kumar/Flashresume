# FlashResume — Documentation Audit Master Report

> **Audit Date**: 2026-08-28  
> **Auditor**: Antigravity AI  
> **Scope**: All `.md` files in repository (excluding `backend/venv/`, `node_modules/`, `redis-stable/`)  
> **Verified against**: Live source code (`main.py`, `worker.py`, `queue_manager.py`, `master_llm_caller.py`, `jobs.py`, `storage_service.py`, `render.yaml`)

---

## Summary

| Metric | Count |
|--------|-------|
| Total Markdown files (project scope) | 35 |
| Files inspected | 35 |
| Files modified (non-algorithm) | 8 |
| Files newly created (audit deliverables) | 3 |
| Files intentionally unchanged | 24 |
| Algorithm files protected (not modified) | 2 |

---

## Modified Files

| File | Reason | What Changed | Code Evidence |
|------|--------|--------------|---------------|
| `ARCHITECTURE.md` | Stale LLM chain (Gemini→Qwen→DeepSeek); stale Next.js version; stale claim-check description | Updated LLM section to document current DeepSeek→POOL_1→POOL_2 round-robin with circuit breaker; fixed Next.js 15→16; rewrote verification section to reflect Object Storage (not Redis base64); added last-verified date | `backend/llm/master_llm_caller.py` POOL_1/POOL_2 constants; `package.json` Next.js version |
| `README.md` | Stale LLM chain (Mistral→NVIDIA→Cloudflare); stale tech stack; incomplete env vars | Updated LLM fallback chain; expanded backend tech stack section; updated `.env` example to show all current API key variables; removed stale `PREFERRED_LLM=gemini` reference; added last-verified date | `backend/llm/master_llm_caller.py` `POOL_1`, `POOL_2`, `_CALLERS` |
| `VERIFICATION_REPORT.md` | Claim Check row said "Redis Base64 + TTL" — superseded by Object Storage; Idempotency row said "Hash + SETNX" — superseded by atomic `SET NX EX` | Added historical context note; updated Claim Check and Temp Cleanup rows to reflect Object Storage; updated Idempotency to atomic `SET NX EX`; added SSE flush delay note; added last-verified date | `backend/worker.py:handle_parse_job()` (uses `storage_service`); `backend/routers/parse.py` (uses `redis_client.set(…, nx=True, ex=…)`) |
| `OPERATIONS.md` | Stale worker fleet description ("WORKER_COUNT=3 supervisor"); missing health check commands; minimal incident response | Corrected worker fleet description (Render Background Worker instances, `WORKER_CONCURRENCY` per process); added `Starting Services` section with all local commands; added `Health Checks` section; added `Queue Inspection (Redis CLI)` section; expanded `Incident Response`; added last-verified date | `backend/render.yaml` (one worker service, `python worker.py`); `backend/worker.py` (`WORKER_CONCURRENCY=4`) |
| `SECURITY_AUDIT.md` | SSE auth description said only `?token=` — current code also accepts `Authorization: Bearer` header; missing rate limiter documentation | Updated SSE section to document dual-mode auth (header + query param); added Section 7 on SlowAPI distributed rate limiting; added last-verified date | `backend/routers/jobs.py:get_authenticated_user_id()` and `stream_job_status()` |
| `TRANSIENT_PDF_MISSING_INCIDENT.md` | Historical document with no current-status note | Added `Current Status: RESOLVED` callout block at top explaining Object Storage migration | `backend/worker.py:handle_parse_job()` |
| `SSE_JOB_TIMEOUT_INCIDENT.md` | Historical document with no current-status note | Added `Current Status: RESOLVED` callout block at top | `backend/routers/jobs.py` (asyncio.sleep(0.5)) |
| `ENGINEERING_POSTMORTEM.md` | Historical document with no current-status section | Added `Section 6: Current Status` table showing all corrective actions implemented | `backend/worker.py`, `backend/queue_manager.py`, `backend/routers/jobs.py` |

---

## Newly Created Files (Audit Deliverables)

| File | Purpose |
|------|---------|
| `ALGORITHM_DOCUMENTS.md` | Complete inventory of algorithm-related Markdown files; safety gate results |
| `ALGORITHM_DOCUMENTATION_FOLLOWUP.md` | Detailed algorithm follow-up report: LLM chain change, ATS scoring, `ats_score_after` random seed discrepancy |
| `DOCUMENTATION_AUDIT.md` | This file — master audit report |

---

## Unchanged Files

| File | Reason |
|------|--------|
| `ALGORITHM_REFERENCE.md` | **PROTECTED** — Algorithm document. Not modified per audit rules. |
| `src/content/blog/how-to-optimize-resume-for-ats.md` | **PROTECTED** — User-facing algorithm content. Not modified per audit rules. |
| `GUARDRAILS.md` | Accurate and complete. Matches current code architecture. No update needed. |
| `ARCHITECTURE_DECISIONS.md` | Accurate ADR records for Object Storage, Redis boundary, Job State Machine, SSE contract, StorageService abstraction. All implemented. No update needed. |
| `CAPACITY.md` | Accurately documents the 100-user baseline with MEASURED/CONFIGURED labels. No update needed. |
| `DATABASE_MIGRATIONS.md` | Accurate migration policy. No update needed. |
| `MICROSERVICES_ANALYSIS.md` | Historical analysis document describing the transition to two-tier. Still accurate as context. No update needed. |
| `MICROSERVICES_IMPLEMENTATION.md` | Historical implementation plan. Implemented. No update needed. |
| `CLEANUP_SUMMARY.md` | Historical cleanup log. Preserved as-is. |
| `BACKEND_CLEANUP.md` | Historical cleanup log. Preserved as-is. |
| `ARCHITECTURE_RECON.md` | Historical investigation. Preserved as-is. |
| `BROWSER_FETCH_INCIDENT.md` | Historical incident. No current-status note needed (self-contained). |
| `HYDRATION_MISMATCH_RESEARCH.md` | Historical research. Preserved as-is. |
| `JOB_PIPELINE_INCIDENT.md` | Historical incident. Preserved as-is. |
| `JOB_TIMEOUT_INCIDENT.md` | Historical incident. Preserved as-is. |
| `LOCAL_BACKEND_STARTUP_INCIDENT.md` | Historical incident. Preserved as-is. |
| `REDIS_CONNECTIVITY_RESEARCH.md` | Historical research. Preserved as-is. |
| `PDF_RETRIEVAL_RESEARCH.md` | Historical research. Preserved as-is. |
| `SSE_JOB_TIMEOUT_RESEARCH.md` | Historical research. Preserved as-is. |
| `gap_report.md` | Historical gap analysis. Items documented as known gaps; not resolved as part of this audit. |
| `AGENT_SKILL_MATRIX.md` | Agent metadata. Not operational documentation. |
| `ACTION_LOG.md` | Session action log. Not operational documentation. |
| `SIMPLIFICATION_SUMMARY.md` | Historical simplification notes. Preserved. |
| `DOCUMENTATION_CLEANUP.md` | Documentation cleanup notes. Preserved. |
| `SEO_DOCUMENTATION.md` | SEO metadata. No changes needed. |
| `PROJECT_SUGGESTION_FIX.md` | Bug fix doc. Preserved. |
| `CERTIFICATION_IMPLEMENTATION.md` | Feature implementation notes. Preserved. |

---

## Historical Files

| File | Historical Purpose | Current Status Clarification Added |
|------|-------------------|-------------------------------------|
| `TRANSIENT_PDF_MISSING_INCIDENT.md` | Documents the Redis base64 unconditional-DELETE bug | ✅ Yes — "Current Status: RESOLVED" block added at top |
| `SSE_JOB_TIMEOUT_INCIDENT.md` | Documents SSE proxy truncation issue | ✅ Yes — "Current Status: RESOLVED" block added at top |
| `ENGINEERING_POSTMORTEM.md` | Root-cause analysis of architectural fragility | ✅ Yes — Section 6 "Current Status" table added |
| `ARCHITECTURE_RECON.md` | Historical system investigation/mapping | No — document is internally consistent and clearly dated |
| `BROWSER_FETCH_INCIDENT.md` | Frontend fetch error analysis | No — self-contained and clearly historical |
| `HYDRATION_MISMATCH_RESEARCH.md` | React hydration research | No — self-contained research |
| `JOB_PIPELINE_INCIDENT.md` | Job pipeline failure investigation | No — self-contained |
| `JOB_TIMEOUT_INCIDENT.md` | Job timeout investigation | No — self-contained |
| `LOCAL_BACKEND_STARTUP_INCIDENT.md` | Local startup failure investigation | No — self-contained |
| `REDIS_CONNECTIVITY_RESEARCH.md` | Redis connectivity research | No — self-contained |
| `PDF_RETRIEVAL_RESEARCH.md` | PDF retrieval research | No — self-contained |
| `SSE_JOB_TIMEOUT_RESEARCH.md` | SSE timeout research | No — self-contained |

---

## Algorithm Files

| File | Related Code | Algorithm Status | Documentation Update Required? |
|------|-------------|------------------|---------------------------------|
| `ALGORITHM_REFERENCE.md` | `backend/prompts/generation_prompt.py`, `backend/services/resume_generator.py` | UNCHANGED — algorithm logic untouched | NO — algorithm logic accurate; LLM provider chain section not present in this doc |
| `src/content/blog/how-to-optimize-resume-for-ats.md` | `backend/prompts/analysis_prompt.py` | UNKNOWN — scoring formula in LLM prompt, variance possible | POTENTIALLY — if formula changes, blog should update |

> ✅ **CONFIRMED**: No algorithm Markdown files were modified during this audit.

---

## Code Issues Discovered

| File | Issue | Severity | Recommendation |
|------|-------|----------|----------------|
| `backend/worker.py` L113-118 | `ats_score_after = random.randint(86, 93)` — score after generation is randomly seeded, not computed from actual output. `ALGORITHM_REFERENCE.md` says `// Calculated after generation` which is misleading. | HIGH | See `ALGORITHM_DOCUMENTATION_FOLLOWUP.md`. Human decision required: (A) document as intentional UX design, or (B) implement real post-generation scoring. Do NOT silently change. |
| `gap_report.md` Item 4 | `WORKER_COUNT` env var referenced as hardcoded in `supervisor.py` — but `supervisor.py` is not present in current repository (worker is started directly via `python worker.py`). `WORKER_COUNT` is not consumed by any current file. | MEDIUM | If horizontal scaling of workers is needed, document it as "deploy multiple Render Background Worker instances" (current) rather than `WORKER_COUNT`. No code change needed; update gap_report.md if desired. |
| `gap_report.md` Item 1 | Describes storage fallback to `/tmp/flashresume_storage/transient` — current code uses `/backend/storage/transient/` for single-node local. May be moot if Object Storage is always used in production. | LOW | Verify production always uses Supabase Storage; update gap_report.md if desired. |

---

## Database Status

| Item | Status |
|------|--------|
| Schema changed | **NO** |
| Migration created | **NO** |
| Existing production data changed | **NO** |
| Destructive operations | **NO** |

Current migration policy is unchanged and accurately documented in `DATABASE_MIGRATIONS.md`.

---

## Documentation Contradictions Found and Resolved

| Contradiction | File A (stale) | File B (current) | Resolution |
|---------------|---------------|-----------------|------------|
| LLM chain | `ARCHITECTURE.md` said Gemini→Qwen→DeepSeek | `master_llm_caller.py` shows DeepSeek→POOL_1→POOL_2 | Updated `ARCHITECTURE.md` |
| LLM chain | `README.md` said Mistral→NVIDIA→Cloudflare | `master_llm_caller.py` shows actual pool structure | Updated `README.md` |
| Claim Check implementation | `VERIFICATION_REPORT.md` said "Redis Base64 + TTL" | `worker.py` uses `storage_service.get_file_bytes()` | Updated `VERIFICATION_REPORT.md` with historical context |
| Temp Cleanup | `VERIFICATION_REPORT.md` said "Redis memory purge" | `worker.py` uses `storage_service.delete_file()` | Updated `VERIFICATION_REPORT.md` |
| Idempotency | `VERIFICATION_REPORT.md` said "Hash + SETNX" | Current code uses `SET NX EX` (atomic single command) | Updated `VERIFICATION_REPORT.md` |
| Worker fleet | `OPERATIONS.md` said "Supervisor running WORKER_COUNT=3" | `render.yaml` shows one Background Worker service; worker uses `WORKER_CONCURRENCY` env var per process | Updated `OPERATIONS.md` |
| SSE Authorization | `SECURITY_AUDIT.md` described only `?token=` query param | `jobs.py` also accepts `Authorization: Bearer` header | Updated `SECURITY_AUDIT.md` |
| Frontend version | `ARCHITECTURE.md` said Next.js 15 | `package.json` and `README.md` say Next.js 16 | Updated both documents |

---

## Algorithm Safety Gate

| Area | Status |
|------|--------|
| ATS scoring formula | UNCHANGED |
| Bullet enhancement decision logic | UNCHANGED |
| Project count enforcement (MAX 2) | UNCHANGED |
| Section ordering (mandatory 6 steps) | UNCHANGED |
| Metric authenticity rules | UNCHANGED |
| Fresher-specific heuristics | UNCHANGED |
| LLM provider chain | REFACTORED (no algorithm behavior change) |
| `ats_score_after` | POTENTIALLY CHANGED (random seed vs. "Calculated") — see Code Issues above |

---

## Current Authoritative Architecture Summary

### Frontend
- **Next.js 16** App Router on Vercel. TypeScript + Tailwind CSS v4 + Framer Motion + `@react-pdf/renderer`.
- API client (`src/lib/api.ts`) communicates with backend over HTTP; uses `EventSource` for SSE streaming.
- State persisted to `localStorage` with **20-minute TTL envelopes** (`src/lib/storage.ts`); in-memory fallback for Safari Private Mode.
- Undo/redo history stacks persisted to localStorage with same TTL mechanism.

### Core API (FastAPI / `main.py`)
- Lightweight gateway: auth, validation, rate limiting, job dispatch. No heavy compute.
- Rate limiter: **SlowAPI + Redis** (`100 req/min/IP`) — distributed across all API nodes.
- Routes: `POST /api/parse` → `POST /api/analyze` → `POST /api/generate` → `GET /api/jobs/{id}/status` → `GET /api/jobs/{id}/stream`
- Health: `GET /health`, `GET /health/readiness` (Redis ping), `GET /health/queue` (queue depth).
- Presence: `POST /api/presence/ping` / `GET /api/presence/count` (Redis ZSET, 180s TTL per user).

### Redis (Responsibilities)
- `queue:jobs:pending` / `queue:jobs:processing` / `queue:jobs:dlq` — job queue
- `job:data:{job_id}` — job state hash (status, result, payload reference, retries)
- `job_updates:{job_id}` — pub/sub channel for SSE delivery
- `presence:active_users` — ZSET for concurrent user tracking
- `presence:peak_count` / `presence:peak_timestamp` — peak counter
- `user:active_jobs:{user_id}` — SET for per-user concurrency control
- Token bucket Lua scripts — distributed LLM quota enforcement
- SlowAPI rate limit tracking — distributed across API nodes
- ❌ **RAW PDFs MUST NOT be stored in Redis** (per GUARDRAILS.md)

### Object Storage
- **Production**: Supabase Storage bucket `transient-resumes` (private).
- **Development**: `/backend/storage/transient/` local directory.
- **Lifecycle**: Uploaded on parse request → `file_key` passed to worker via Redis payload → file retrieved by worker → deleted after `COMPLETE` or via orphan cleanup.

### Worker (`worker.py`)
- Autonomous Python process consuming jobs via `BRPOPLPUSH`.
- **Concurrency**: `WORKER_CONCURRENCY=4` jobs per process (asyncio Semaphore-bounded).
- **Graceful shutdown**: SIGTERM/SIGINT handled; waits for active tasks.
- **Zombie recovery**: Background loop every 60s using Lua atomic script; visibility timeout 300s; max retries 3.
- **DLQ**: Jobs failing `MAX_RETRIES=3` times → `queue:jobs:dlq`.
- **Task types**: `parse_pdf`, `generate_resume`, `analyze_resume`, `compile_latex`.

### LLM (`master_llm_caller.py`)
- **Chain**: DeepSeek → POOL_1 (Mistral, 18 slots, 3 API keys) → POOL_2 (Ministral/Cloudflare/NVIDIA, 16 slots).
- **Concurrency**: Global `asyncio.Semaphore(5)` across worker tasks.
- **Circuit breaker**: Per-(provider, model, key) slot; persisted to Supabase.
- **Round-robin**: Global counter persisted to Supabase `rr_counters` table.
- **Quota**: Distributed token bucket via Redis Lua (`quota_manager.py`), 15 RPM per provider.

### PostgreSQL / Supabase
- Stores: `resume_sessions` (generated output metadata), `llm_usage` (telemetry), `rr_counters` (RR state), `system_metrics` (peak users).
- Does NOT store: raw PDFs, job queue state, rate limit state (all in Redis).

### SSE Protocol
- Client connects to `GET /api/jobs/{id}/stream`.
- Server subscribes to `job_updates:{id}` pub/sub **then** immediately emits current job state (race-safe hydration).
- Events: `event: status` → `event: result` (COMPLETE) or `event: error` (FAILED/missing).
- Terminal events followed by `await asyncio.sleep(0.5)` to prevent proxy truncation.
- Fallback: Client polls `GET /api/jobs/{id}/status` on SSE failure.

---

## Final Documentation Status

**DOCUMENTATION SYNCHRONIZED WITH FOLLOW-UP ITEMS**

All non-algorithm current documentation has been updated to accurately reflect the implementation.

Follow-up items requiring human decision before documentation can be finalized:
1. **`ats_score_after` random seed** — decide whether to document as intentional UX or implement real scoring (see `ALGORITHM_DOCUMENTATION_FOLLOWUP.md`).
2. **`gap_report.md`** — gaps documented but not all resolved; may be updated separately.
3. **Algorithm documentation** — `ALGORITHM_REFERENCE.md` LLM provider section (not present in that doc) and `README.md` now updated; full POOL_1/POOL_2 model list in `ARCHITECTURE.md` is now the authoritative reference.
