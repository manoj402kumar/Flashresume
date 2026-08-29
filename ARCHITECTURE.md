

> [!NOTE]
> **Update**: The single-use SSE ticket (`/stream-ticket`) and `?token=` architecture has been fully replaced with a Fetch-based SSE implementation utilizing `Authorization: Bearer` headers. All references to GETDEL tickets are strictly historical.

# FlashResume - System Architecture

> Last verified: 2026-08-28

## Complete Flow & Component Interaction

---

## 🏗️ SYSTEM OVERVIEW & ARCHITECTURAL PATTERNS

FlashResume is built using a **Two-Tier Service Architecture** separating a lightweight API gateway from a dedicated heavy background worker.

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER JOURNEY                             │
├─────────────────────────────────────────────────────────────────┤
│  Upload → Analyze → Preview → Generate → Result → Download PDF  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Interaction Architecture

```
┌─────────────────┐      HTTP POST      ┌───────────────────────────┐
│                 ├────────────────────►│   CORE API GATEWAY        │
│                 │                     │   (FastAPI / main.py)     │
│                 │  SSE Stream / Polling│   - Input Validation      │
│  NEXT.JS 16     │◄────────────────────┤   - Job Creation (202)    │
│  FRONTEND       │                     │   - SSE Event Streaming   │
│  (Vercel)       │                     └─────────────┬─────────────┘
│                 │                                   │
│                 │                                   │ Redis Queue & PubSub
│                 │                                   ▼
│                 │                     ┌───────────────────────────┐
│                 │                     │    REDIS INFRASTRUCTURE   │
│                 │                     │  - Pending Queue          │
│                 │                     │  - Processing Queue       │
│                 │                     │  - Job State Hashes       │
│                 │                     │  - Pub/Sub Channels       │
│                 │                     │  - Quota Rate Limiter     │
│                 │                     └─────────────┬─────────────┘
│                 │                                   │
│                 │                                   │ BRPOPLPUSH / Claim-Check
│                 │                                   ▼
│                 │                     ┌───────────────────────────┐
│                 │                     │   HEAVY WORKER SERVICE    │
│                 │                     │   (worker.py)             │
│                 │                     │   - 3-Layer PDF Parser    │
│                 │                     │   - LLM Orchestrator      │
│                 │                     │   - LaTeX Sandbox         │
└─────────────────┘                     └───────────────────────────┘
```

---

## 📱 FRONTEND ARCHITECTURE

### Page Flow
```
src/app/
├── page.tsx                 # Home (Upload resume + Job Description)
├── analyze/page.tsx         # Analysis Results (ATS score + matched/missing keywords)
├── preview/page.tsx         # Preview Changes (AI optimization summary)
├── generate/page.tsx        # Generation Progress (SSE listener & state machine)
└── result/page.tsx          # Final Resume (Editable preview + PDF download)
```

### Component Hierarchy & Interaction
```
┌─────────────────────────────────────────────────────────────┐
│                         page.tsx                             │
│  Upload Form (File or Text) + Job Description               │
│  → Calls: POST /api/parse & POST /api/analyze (Asynchronous)│
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      analyze/page.tsx                        │
│  ATS Score Display + Keyword Analysis                       │
│  → Stores: approved_project & analysis in state/storage     │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      preview/page.tsx                        │
│  Optimization Plan & Project Replacement Preview             │
│  → Triggers: Resume Generation                              │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     generate/page.tsx                        │
│  Submits Job → Listens on /api/jobs/{job_id}/stream (SSE)   │
│  Receives real-time state: QUEUED → PROCESSING → COMPLETE   │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      result/page.tsx                         │
│  Interactive Resume Editor + PDF Download (LaTeX Engine)     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 BACKEND ARCHITECTURE & TWO-TIER SERVICE SPLIT

### 1. Core API Gateway (`main.py`, `routers/`)
- **FastAPI Application**: Non-blocking asynchronous API layer responsible for accepting requests, validating payloads, authenticating users, managing session state, and dispatching jobs to Redis.
- **Routers**:
  - `routers/parse.py`: Endpoint `POST /api/parse`. Validates incoming file, stores raw payload in transient storage using claim-check, enqueues job in Redis, and returns `202 Accepted` with `job_id`.
  - `routers/analyze.py`: Endpoint `POST /api/analyze` and `POST /api/check-projects`. Submits analysis jobs asynchronously.
  - `routers/generate.py`: Endpoint `POST /api/generate`. Submits optimization jobs to the queue.
  - `routers/latex_pdf.py`: Endpoint `POST /api/generate-pdf-latex`. Submits LaTeX PDF compilation tasks.
  - `routers/jobs.py`: SSE Streaming endpoint `GET /api/jobs/{job_id}/stream` and Polling endpoint `GET /api/jobs/{job_id}/status`. Subscribes to Redis Pub/Sub *before* inspecting initial status to eliminate race conditions.

### 2. Heavy Background Worker (`worker.py`)
- **Autonomous Python Process**: Consumes jobs from `queue:jobs:pending` via `BRPOPLPUSH`. Executed independently from the FastAPI process.
- **Task Handlers**:
  - `handle_parse_job`: Executes the 3-layer PDF parsing engine (`services/parse_orchestrator.py`).
  - `handle_generate_job`: Invokes multi-LLM orchestrator (`llm/master_llm_caller.py`) with complete optimization prompt and strict structural constraints.
  - `handle_compile_latex_job`: Compiles LaTeX code to PDF using sandboxed `pdflatex` process (`services/latex_compiler.py`).
- **Pub/Sub Completion Notification**: Saves final result to Redis hash `job:data:{job_id}` *prior* to publishing status `COMPLETE` to ensure zero race conditions in client listeners.

---

## 💾 TRANSIENT STORAGE & CLAIM-CHECK PATTERN

### Storage Architecture
To prevent queue payload bloat and high memory pressure in Redis:
1. **Transient Binary Storage**: Raw PDF uploads are stored temporarily using `StorageService` (Supabase Storage in production or localized file storage in development).
2. **Claim-Check Pattern**: The job payload placed in Redis contains only a thin JSON reference:
   ```json
   {
     "job_id": "c1f7a098-...",
     "job_type": "parse",
     "file_key": "transient/resumes/2026/08/c1f7a098.pdf",
     "owner_id": "usr_9981"
   }
   ```
3. **Aggressive Cleanup Lifecycle**: Workers retrieve the binary via `file_key`, parse or compile the contents, and immediately purge the transient storage object upon task completion or terminal Dead Letter Queue (DLQ) entry.
4. **Result TTL**: Formatted result objects stored in `job:data:{job_id}` expire automatically via 1-hour Redis TTL.

---

## ⚡ QUEUE RELIABILITY & FAULT TOLERANCE

### 1. Reliable Queue Pattern (`BRPOPLPUSH`)
- Jobs move atomically from `queue:jobs:pending` to `queue:jobs:processing`.
- Guarantees job safety against unexpected worker process termination or worker container crashes.

### 2. Visibility Timeout & Zombie Recovery
- Background supervisor process monitors `queue:jobs:processing` using atomic Lua scripts.
- Tasks residing in processing state longer than `VISIBILITY_TIMEOUT` (e.g., 300 seconds) are automatically reclaimed, retried (incrementing retry count up to `MAX_RETRIES=3`), or routed to `queue:jobs:dlq`.

### 3. Concurrency Idempotency (`SETNX`)
- Enqueuing calls compute a deterministic payload hash.
- Redis `SETNX` lock key prevents duplicate concurrent submissions from creating redundant background jobs.

---

## 🧠 LLM FALLBACK CHAIN & RATE LIMITING

### Master Caller Logic (`master_llm_caller.py`)

> **Note**: The LLM provider chain was refactored from a linear 3-layer model to a two-pool round-robin architecture. See `ALGORITHM_DOCUMENTATION_FOLLOWUP.md` for details on this change and the required documentation update.

```
master_llm_caller.py → call_llm_balanced()
    ↓
1. DeepSeek (deepseek-v4-flash) — primary attempt
    ↓ (on error, 429, or circuit-tripped)
2. POOL_1 — Round-Robin across Mistral variants (18 slots across 3 API keys):
   mistral-medium-3.5 / mistral-medium-2604 / mistral-large-2512 / mistral-medium-2508 / mistral-large-latest
    ↓ (on exhaustion)
3. POOL_2 — Round-Robin across fallback providers (16 slots):
   Ministral-14b / Mistral-small / Cloudflare llama-3.3-70b / NVIDIA Ministral / Cloudflare mistral-small-3.1 / NVIDIA mistral-nemotron
```

**Circuit Breaker**: Each `(provider, model_id, key_label)` slot has an independent circuit breaker. 429s trip for 120s; 402s trip until midnight; 401s trip for 24h. Tripped state is persisted to Supabase `llm_usage` table.

**Global Round-Robin Counter**: Pool index is persisted in Supabase `rr_counters` table, ensuring workers resume from a different slot after restart (avoids always hammering the same provider).

### Response Cleaning Pipeline
1. Strips reasoning blocks (`<think>...</think>`).
2. Removes Markdown code blocks (` ```json ... ``` `).
3. Fallback regex JSON extraction.
4. Pydantic schema validation.

### Distributed Token Bucket Rate Limiter (`quota_manager.py`)
- Centralized `RedisQuotaManager` executes distributed token-bucket Lua scripts.
- Enforces strict Requests Per Minute (RPM) limits (default 15 RPM per provider) across worker processes to shield upstream LLM providers from rate-limit exhaustion.
- Quota consumed before each LLM call in `call_llm_balanced()`.

---

## 🔒 SECURITY ARCHITECTURE

1. **LaTeX RCE Sandboxing**:
   - `pdflatex` executed strictly with `-no-shell-escape` flag.
   - Wrapped in Python `asyncio` execution sandbox with hard 15-second timeout.
   - Deployed under non-root Linux user (`USER appuser` in Dockerfile).

2. **Authorization Isolation**:
   - `GET /api/jobs/{job_id}/stream` verifies Supabase JWT token (`?token=...`).
   - Prevents unauthorized users from subscribing to other users' job events.

3. **Ephemeral Resource Cleanup**:
   - `worker.py` wraps file parsing and compilation in `try...finally` blocks with explicit `os.remove()` calls.

4. **Input Protection**:
   - File extension and MIME-type white-listing (PDF, DOCX, JPG, PNG).
   - Strict 10MB payload size limit on Core API Gateway.

---

## 🚀 DEPLOYMENT TOPOLOGY

### Backend Deployment (Render)
- **Service 1: Core API Gateway** (Render Web Service)
  - Build: `pip install -r backend/requirements.txt`
  - Command: `uvicorn main:app --host 0.0.0.0 --port 10000`
- **Service 2: Heavy Worker** (Render Background Worker)
  - Build: `pip install -r backend/requirements.txt`
  - Command: `python worker.py`
- **Service 3: Redis Broker** (Render Redis Instance)

### Frontend Deployment (Vercel)
- Next.js 16 App Router deployed on Vercel with environment variable:
  `NEXT_PUBLIC_API_URL=https://flashresume-backend.onrender.com`

---

## 🎯 VERIFICATION & RECOVERY STATUS

> All verifications performed using test scripts in `test_all_fixed.py`, `test_job_pipeline_e2e.py`, and direct code inspection. See `VERIFICATION_REPORT.md` for full evidence.

- **Object Storage Claim-Check**: Verified — worker retrieves PDF bytes from `storage_service`, not Redis. File deleted only after `COMPLETE` status is persisted.
- **Queue Reliability**: Verified — `BRPOPLPUSH` guarantees atomic dequeue; Lua-based zombie recovery requeues timed-out jobs.
- **Idempotency**: Verified — enqueue uses atomic `SET NX EX` (single command); 10 concurrent requests produce 1 job ID.
- **Token Limiter**: Verified — distributed Lua token bucket, 20/20 requests correctly throttled to `max_rpm=15`.
- **LaTeX Security**: Verified — `pdflatex -no-shell-escape`, 15s timeout, non-root `appuser` in Docker.
- **SSE Stream Reliability**: Verified — initial state hydration before pub/sub subscription; `await asyncio.sleep(0.5)` after terminal frame prevents proxy truncation.
- **Transient PDF Incident**: RESOLVED — PDF stored in Object Storage (not Redis), deleted only after confirmed `COMPLETE`. (Historical: was Redis base64+TTL, fixed in current implementation.)
- **Authorization**: Verified — `GET /api/jobs/{job_id}/stream` and `/status` enforce JWT ownership check.

---

**Status**: ✅ VERIFIED — TWO-TIER ARCHITECTURE IMPLEMENTED  
**Last verified**: 2026-08-28
