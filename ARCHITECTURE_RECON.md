# Architecture Reconnaissance & Migration Status

## Architectural Overview & Reconnaissance Findings

- **Frontend**: Next.js 15 App Router, React 19, Tailwind CSS. Shifting state handling from heavy client-side `localStorage` dependencies to streaming job state updates via SSE (`/api/jobs/{job_id}/stream`).
- **Backend Architecture**: Two-tier split between a lightweight Core API (`main.py`) and a dedicated Heavy Background Worker (`worker.py`).
- **Endpoints**: `routers/parse.py`, `routers/analyze.py`, `routers/generate.py`, `routers/latex_pdf.py`, and `routers/jobs.py` in `backend/routers/`.
- **PDF Parsing Pipeline**: 3-layer fallback: `pdfplumber` (fast text) → `PyMuPDF` (Canva/complex layout) → `PyMuPDF + Tesseract OCR` (scanned images). Handled asynchronously inside `worker.py`.
- **LLM Orchestration**: Orchestrated in `master_llm_caller.py` with multi-provider fallback (Gemini → Qwen → DeepSeek) protected by a distributed Lua token bucket rate limiter (`quota_manager.py`).
- **State Management & Database**: Redis acts as the core queue, status hash store, and pub/sub broker. Supabase PostgreSQL handles system metrics and user authentication.

## Completed Migration Summary

1. **Core API Gateway**:
   - Intercepts incoming POST requests.
   - Saves file uploads to transient storage using the Claim-Check pattern (`StorageService`).
   - Enqueues lightweight job reference payloads (`job_id`, `file_key`, `owner_id`) into Redis queue `queue:jobs:pending`.
   - Returns `202 Accepted` with `job_id` instantly to the frontend.
   - Provides non-blocking SSE endpoint (`GET /api/jobs/{job_id}/stream`) for real-time status notifications.

2. **Heavy Background Worker (`worker.py`)**:
   - Independent Python worker consuming jobs using `BRPOPLPUSH` from `queue:jobs:pending` into `queue:jobs:processing`.
   - Executes PDF parsing, LLM resume optimization, and LaTeX compilation asynchronously.
   - Saves final result payloads into `job:data:{job_id}` in Redis before issuing Pub/Sub `COMPLETE` event.
   - Performs aggressive cleanup of transient storage files and temporary disk artifacts upon completion.

3. **Queue Reliability & Recovery**:
   - Visibility timeout worker monitor reclaims crashed/stalled tasks atomically via Lua script (`recover_zombies()`).
   - Idempotent payload lock using Redis `SETNX`.

## Key Files
- **Backend Core**: `backend/main.py`, `backend/worker.py`, `backend/queue_manager.py`, `backend/redis_client.py`, `backend/llm/quota_manager.py`
- **Backend Routers**: `backend/routers/parse.py`, `backend/routers/analyze.py`, `backend/routers/generate.py`, `backend/routers/latex_pdf.py`, `backend/routers/jobs.py`
- **Frontend Core**: `src/app/generate/page.tsx`, `src/lib/api.ts`

---
**Status**: MIGRATION COMPLETED & AUTHORITATIVE
