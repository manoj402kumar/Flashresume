# FlashResume Codebase Knowledge

## 0. Document Metadata
- **Generated**: 2026-08-28
- **Purpose**: Forensic engineering knowledge base representing the actual runtime truth of the FlashResume repository.
- **Target Audience**: Future AI coding agents and human engineers.

## 1. Executive System Summary
FlashResume is a Next.js (frontend) and FastAPI (backend) platform designed to optimize resumes for ATS compatibility without fabricating achievements. Heavy compute tasks (PDF parsing, LLM generation, LaTeX compilation) are asynchronously offloaded to a Redis-backed Python worker fleet.

## 2. Truth Ledger
This ledger represents the reconciliation of documented claims against observed implementation.

| Claim | Code | Test | Runtime | Docs | Final Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| PDFs are stored in Redis | `storage_service.py` | `test_transient_pdf_lifecycle.py` | N/A | `BACKEND_ARCHITECTURE.md` | **CONTRADICTED**. PDFs use Supabase/Local storage. |
| SSE completes securely | `jobs.py:84` | `test_full_sse.py` | N/A | `SSE_JOB_TIMEOUT_INCIDENT.md` | **VERIFIED_CODE**. Explicit `event: error` and 0.5s sleep flush implemented. |
| Single atomic idempotency | `parse.py:64` | `test_transient_pdf_lifecycle.py` | N/A | `ENGINEERING_POSTMORTEM.md` | **VERIFIED_CODE**. Uses `set nx=True, ex=3600`. |
| Distributed queue limits | `queue_manager.py:36` | N/A | N/A | `CAPACITY.md` | **VERIFIED_CODE**. Uses atomic Lua script for admission control. |

## 3. Repository Topology
- **`backend/`**: FastAPI application, worker process, queue manager, storage services, LLM orchestration.
- **`src/`**: Next.js App Router frontend, UI components, API client (`lib/api.ts`).
- **`supabase/`**: Database migrations and configuration.
- **`public/`**: Static assets.

## 4. Technology & Dependency Inventory
**Frontend**: Next.js 16.2.3, React 19, Tailwind CSS v4, Framer Motion, `@react-pdf/renderer` v4.
**Backend**: Python 3.11, FastAPI, Uvicorn, Gunicorn, `redis>=5.0.0`, `supabase>=2.0.0`, `pdfplumber`, `pypdfium2`, `tesseract-ocr`.
**Infrastructure**: Vercel (Frontend), Render (Backend + Worker), Upstash (Redis), Supabase (PostgreSQL + Object Storage).

## 5. Current Architecture
The system consists of a REST API, an asynchronous Worker Fleet, and a Redis instance for coordination. 
- **Frontend** uploads a file to **API**.
- **API** persists binary to **Object Storage** and enqueues a JSON reference to **Redis**.
- **Worker** claims the job via `BRPOPLPUSH`, downloads the binary, performs compute (parsing/LLM/LaTeX), persists results to a Redis hash, and emits a pub/sub event.
- **Frontend** receives the result via Server-Sent Events (SSE).

## 6. Frontend Architecture
Next.js App Router utilizing React Server Components (RSC) where possible, but heavily reliant on Client Components for real-time SSE streams and interactive UI.
- **API Integration**: Centralized in `src/lib/api.ts`. Includes a robust `waitForJobSSE` function that handles the strict Server-Sent Events protocol, timeouts (120s-180s), and error unwrapping.

## 7. Backend Architecture
FastAPI application orchestrated by `main.py`.
- Includes distributed presence tracking (`/api/presence/ping`) using Redis `ZSET`.
- **Concurrency**: Gunicorn runs with 1 worker (`-w 1`) cycling every 500 requests to prevent OOM errors on Render's free tier. Worker process runs concurrently using `asyncio.Semaphore(WORKER_CONCURRENCY)`.

## 8. API Contracts
- `POST /api/parse`: Accepts `multipart/form-data` (max 5MB). Returns `202 Accepted` with `{"job_id": "uuid"}`.
- `POST /api/analyze`: Accepts JSON. Returns `202 Accepted` with `{"job_id": "uuid"}`.
- `POST /api/generate`: Accepts JSON. Returns `202 Accepted` with `{"job_id": "uuid"}`.
- `GET /api/jobs/{job_id}/stream`: Returns `text/event-stream`. Uses `Authorization: Bearer` for ownership verification.

## 9. Cross-Layer Contracts
**SSE Payload Contract:**
- Producer: `backend/routers/jobs.py`
- Consumer: `src/lib/api.ts`
- Status: **VERIFIED_CODE**. The backend yields `event: result\ndata: {JSON}\n\n`. The frontend correctly parses `event.data`. A historical bug regarding Nginx truncation was fixed by injecting `await asyncio.sleep(0.5)` before closing the stream.

## 10. Async Job Architecture
- **Queue Implementation**: Redis `LPUSH` (pending) and `BRPOPLPUSH` (processing).
- **Producer**: FastAPI routes via `queue_manager.py:enqueue()`.
- **Consumer**: `worker.py:worker_loop()`.
- **Claim Mechanism**: `BRPOPLPUSH` from `queue:jobs:pending` to `queue:jobs:processing`.
- **ACK Mechanism**: `LREM` from processing queue, update status to `COMPLETE`.
- **Zombie Recovery**: Handled by `recover_zombies()` in `queue_manager.py` using Lua scripts (Visibility Timeout = 300s).

## 11. Job State Machines
Explicit job state machine enforced in `queue_manager.py`:
1. `QUEUED`: Initial state upon enqueue.
2. `PROCESSING`: Set when worker pops from queue.
3. `COMPLETE`: Set when worker finishes and ACKs.
4. `RETRYING`: Set if worker fails and `retries < 3`.
5. `FAILED`: Set if worker fails and `retries >= 3` (moves to DLQ).

## 12. Redis Architecture
Redis is strictly used for coordination, NOT for large binary storage.
- `queue:jobs:pending` (List)
- `queue:jobs:processing` (List)
- `queue:jobs:dlq` (List)
- `job:data:{job_id}` (Hash): Stores status, payload, result, error, retries. TTL=3600s after completion.
- `job_updates:{job_id}` (Pub/Sub): Live SSE updates.
- `idempotency:parse:{sha256}` (String): TTL=3600s, atomic `SET NX EX`.
- `presence:active_users` (ZSET): Used for live traffic tracking.

## 13. Storage & Data Lifecycle
- **PDF Uploads**: Stored in Supabase Private Bucket `transient-resumes` (or local fallback `/tmp/flashresume_storage/transient`).
- **Data Lifecycle**: `worker.py` ONLY deletes the transient file from storage AFTER the job is successfully marked `COMPLETE` (or after 1 hour via cleanup cron).
- **PII**: Resumes contain PII. Transient storage is private (`0o600` local, or Supabase RBAC).

## 14. PDF Pipeline
1. `pdfplumber`: Fast text extraction.
2. `pypdfium2`: Layout preservation (fallback).
3. `tesseract-ocr`: Executed via subprocess if the PDF is scanned (image-only).
- **Danger Zone**: OCR is memory intensive and can crash small containers.

## 15. LaTeX/PDF Generation
- Uses `pdflatex` via subprocess.
- **Security Mitigation**: Uses `-no-shell-escape` flag to prevent arbitrary code execution (RCE). Temporary directories are strictly isolated.

## 16. LLM Architecture
Orchestrated via `backend/services/`.
- **Primary**: DeepSeek / Mistral / NVIDIA.
- **Failover**: Implements a strict fallback chain if a provider returns `429` (Quota Exceeded) or `503`.

## 17. Authentication & Authorization
- Supabase Auth (JWT).
- API routes extract the JWT via `Authorization: Bearer <token>`.
- `jobs.py:stream_job_status` verifies that the `user_id` inside the JWT matches the `user_id` attached to the `job:data:{job_id}` payload, preventing IDOR (Insecure Direct Object Reference).

## 18. Security Threat Model
| Threat | Attack Surface | Mitigation | Status |
| :--- | :--- | :--- | :--- |
| **IDOR** | SSE Streams (`/api/jobs/{id}/stream`) | Job payload stores `owner_id`. Stream strictly matches against JWT. | **VERIFIED_CODE** |
| **RCE** | LaTeX Compilation | Subprocess array args, `-no-shell-escape`. | **VERIFIED_CODE** |
| **Queue Exhaustion** | `/api/parse` | Lua script enforces `MAX_PENDING_JOBS=200` globally and `MAX_ACTIVE=2` per user. | **VERIFIED_CODE** |

## 19. Performance & Capacity
- **API Concurrency**: 1 Gunicorn worker.
- **Worker Concurrency**: Defaults to `WORKER_CONCURRENCY=4`, enforced by `asyncio.Semaphore`.
- **Known Bottleneck**: LLM API latency and Worker concurrency limits. A 100-user spike will queue jobs; `queue_manager.py` protects against memory exhaustion by rejecting jobs over 200.

## 20. Failure & Recovery
- **Worker Crash**: If a worker OOMs or crashes during `PROCESSING`, the job remains in the processing queue. After 300s (Visibility Timeout), the supervisor `recover_zombies()` script requeues it.
- **Browser Disconnect**: If the user closes the tab, SSE disconnects. The worker finishes the job and persists it to Redis. Upon reconnect, the frontend hits `/api/jobs/{id}/status`, receives `COMPLETE`, and fetches the result.

## 21. User Journeys
**Upload -> Optimize -> Result**:
1. User uploads PDF.
2. `api.ts` -> `POST /api/parse`.
3. Backend stores binary in Supabase, enqueues `parse_pdf` job, returns `job_id`.
4. `api.ts` -> connects to `/api/jobs/{job_id}/stream` (SSE).
5. Worker claims job, parses PDF, persists result to Redis, emits `COMPLETE` pub/sub event.
6. `api.ts` receives result, closes SSE.

## 22. Testing & Verification
- `test_transient_pdf_lifecycle.py`: Proves the new object-storage lifecycle and retry semantics (Status: **PASS**).
- `test_full_sse.py`: Proves the SSE TCP flush fix (Status: **PASS**).

## 23. Deployment & Operations
- Frontend: Vercel.
- Backend/Worker: Render Docker environments (`render.yaml`).
- Cron: Vercel triggers `/api/cron/*` endpoints.

## 24. Invariants
1. **At-Least-Once Delivery**: A queued job must retain its required PDF binary until the job has completed successfully or hit the DLQ. (Enforced: `worker.py:61`).
2. **Job Isolation**: A user cannot read SSE events for a job they do not own. (Enforced: `jobs.py:34`).
3. **Queue Admission**: The global queue must not exceed 200 pending jobs. (Enforced: `queue_manager.py:48`).

## 25. Danger Zones
⚠️ **DO NOT MODIFY WITHOUT UNDERSTANDING**
- `backend/queue_manager.py`: Contains complex atomic Lua scripts. Modifying `LUA_ENQUEUE` can easily break rate limits or queue invariants.
- `backend/worker.py:handle_parse_job`: The order of operations (Retrieve -> Compute -> Persist -> Delete) is critical for retry safety. DO NOT delete the transient file before `COMPLETE` is persisted.
- `backend/routers/jobs.py`: SSE implementation. The `await asyncio.sleep(0.5)` is mandatory to prevent Nginx from truncating the final event frame.

## 26. Technical Debt
- **P2 (Scalability)**: Worker concurrency is currently limited by memory per container (PDFs and OCR are heavy). True horizontal scaling requires multiple Render worker instances, which works fine due to Redis `BRPOPLPUSH`, but costs scale linearly.

## 27. Architectural Decisions
- **ADR-001: Move transient binaries out of Redis**. Redis crashed due to base64 PDF bloat. Binaries moved to Supabase Storage/Local FS. Redis only stores the UUID reference.
- **ADR-002: Atomic Job Idempotency**. `SETNX` and `SETEX` were replaced with a single atomic `SET NX EX` to prevent crash deadlocks on duplicate uploads.

## 28. Contradictions
- *None currently active.* The architecture has been brought into alignment with the code following recent bug fixes.

## 29. Unknowns
- **UNKNOWN-001**: Exact memory consumption per Tesseract OCR thread. If `WORKER_CONCURRENCY=4` and 4 scanned PDFs arrive simultaneously, the worker container might still OOM.

## 30. AI Agent Guardrails
- **Read `worker.py` carefully before modifying job flows.**
- **Never store binary data in Redis.**
- **Do not remove `asyncio.sleep(0.5)` from SSE endpoints.**
- **Respect the `get_authenticated_user_id` checks in `jobs.py`.**

## 31. Complete System Map
`Frontend (Next.js)` -> `API (FastAPI)` -> `Supabase Storage (Binary)`
`API (FastAPI)` -> `Redis (Queue & Coordination)` -> `Worker (Python)`
`Worker (Python)` -> `LLM APIs (DeepSeek/Mistral)`
`Worker (Python)` -> `LaTeX Subprocess (PDF Gen)`
`Worker (Python)` -> `Redis (Result Hash + Pub/Sub)` -> `API (SSE)` -> `Frontend`

## 32. File Index
- `backend/main.py`: App entry, presence tracking.
- `backend/queue_manager.py`: Queue admission, Lua scripts, Zombie recovery.
- `backend/worker.py`: Compute orchestrator, retry logic.
- `backend/storage_service.py`: Supabase/Local binary object storage.
- `backend/routers/jobs.py`: SSE real-time state pushing.
- `backend/routers/parse.py`: Request validation, idempotency.
- `src/lib/api.ts`: Client API layer, SSE parsing logic.

## 33. Final Verification Summary
The architecture as described here matches the implementation in the codebase as of 2026-08-28. Major historical bugs involving Redis abuse, non-atomic locks, and SSE truncation have been resolved in the actual source code.
