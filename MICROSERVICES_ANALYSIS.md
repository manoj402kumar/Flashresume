# FlashResume Microservices Architecture Analysis

## 1. Executive Summary
FlashResume is transitioning from a single-process FastAPI monolith to a Two-Tier architecture: a **Core API / Orchestration Service** and a **Heavy Compute Worker Service**, coordinated via a **Redis-based asynchronous queue**.

## 2. Core API / Orchestration Service
- Responsible for HTTP request handling, authentication, authorization, validation, and idempotency.
- Handles job creation and queueing.
- Must return `202 Accepted` quickly.
- Must provide SSE (Server-Sent Events) for real-time status delivery to the Next.js frontend.
- Must store transient job data (e.g. uploaded PDFs) securely with a strict TTL (claim-check pattern) rather than putting large payloads in Redis.
- NO heavy compute (no PDF parsing, OCR, or LaTeX) happens here.

## 3. Redis-Based Queueing
- Manages the asynchronous job handoff.
- Requirements include:
  - Reliable delivery mechanisms (e.g. ACK + visibility timeout recovery to prevent zombie tasks).
  - Retry logic with exponential backoff.
  - Dead Letter Queue (DLQ) handling.
  - Distributed token-bucket protection for LLM quotas.
  - Storage of transient job processing state.

## 4. Heavy Compute Worker Service
- An isolated process running asynchronously.
- Responsibilities:
  - PDF/OCR processing (pdfplumber → PyMuPDF → Tesseract OCR).
  - LaTeX compilation (`pdflatex -no-shell-escape` inside an unprivileged, read-only container).
  - Memory and resource limits enforced (streaming for large files).
  - Strict temporary disk cleanup (for success, failure, timeout, crash).
  - Calling LLM providers with retry semantics and bounded concurrent execution.

## 5. Security & Threat Modeling
- **LaTeX Compilation Isolation:** Must disable shell escape and run in a read-only unprivileged state.
- **Data Protection:** Transient PII storage strictly limited (e.g., 5 min TTL) to avoid persistent PII.
- **Resource Exhaustion:** Bounded file sizes, CPU/memory for workers, bounded DB connections.

## 6. Job State Machine
Expected states:
`CREATED` → `QUEUED` → `PROCESSING` → `PARSING` → `GENERATING` → `COMPILING` → `COMPLETE`
Failure branches: `FAILED`, `RETRYING`, `DLQ`.

## 7. LLM Orchestration
- Preserve existing provider fallback chain.
- Implement centralized distributed token-bucket protection using Redis.
- Differentiate between transient failures (timeout/429) and permanent failures.

## 8. Deployment Target
- Next.js Frontend (Vercel)
- Core API (FastAPI) (Render)
- Heavy Worker (Python) (Render)
- Redis instance
- Supabase (PostgreSQL)
