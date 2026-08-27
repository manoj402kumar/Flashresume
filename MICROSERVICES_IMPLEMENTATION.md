# Microservices Implementation Document

## 1. Architecture Map
- **Frontend (Next.js)**: Enqueues jobs for parsing/generation, receives `job_id`, then waits using SSE (`/api/jobs/{job_id}/stream`).
- **Core API (FastAPI)**: Lightweight HTTP router. Processes requests by validating input, saving temp files, and enqueuing onto Redis. Returns 202 quickly.
- **Worker Service**: A separate `worker.py` process running asynchronously that pulls from the Redis queue. Handles:
  - `parse_pdf`
  - `generate_resume` (LLM calls)
  - `compile_latex`
- **Redis Queue**: Uses Lists `QUEUE_PENDING` and `QUEUE_PROCESSING` to track job state and enforce visibility timeouts.
- **LLM Rate Limiting**: Uses a Redis token bucket/semaphore approach to limit concurrency per provider across distributed workers.

## 2. Job State Machine
`CREATED` → `QUEUED` (in pending list) → `PROCESSING` (worker picks up) → `COMPLETE` (or `FAILED` / `RETRYING`).
Zombies are auto-recovered by `queue_manager.py` if stuck in `PROCESSING` past 5 minutes.

## 3. Security
- **Transient Storage**: PDF files are saved to `tempfile` and processed by the worker on the same disk (or could be shared). It guarantees removal in a `finally` block.
- **LaTeX Sandboxing**: `pdflatex` is invoked with `-no-shell-escape`, `-interaction=nonstopmode`, and `-halt-on-error` inside an isolated temporary directory with a timeout.

## 4. Frontend Integration
Instead of modifying UI components, the `api.ts` `fetch` requests now encapsulate the async flow: they POST to the endpoints, receive `job_id`, and immediately invoke `waitForJobSSE` which connects to the EventSource and resolves the promise when the job sends a `COMPLETE` status. This provides 100% backward compatibility with React-PDF UI.
