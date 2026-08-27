# FlashResume — Engineering Postmortem & Architectural Reassessment

## 1. Executive Summary

FlashResume underwent several rapid iterations to handle asynchronous heavy workloads (PDF parsing, OCR, LLM prompt orchestration, and LaTeX compilation). While key decisions—such as isolating compute tasks into a background worker and maintaining a 3-layer PDF parser—were correct, a pattern of symptom-by-symptom patching introduced architectural fragile points.

The most critical flaw was **using Redis simultaneously as a message queue, transient binary blob store, distributed lock, state database, rate limiter, and pub/sub broker**.

This postmortem analyzes the root causes of past incidents, evaluates previous design decisions, and lays the groundwork for a controlled architectural reset.

---

## 2. Comprehensive Incident Analysis

### 2.1 Transient PDF Missing Incident (`transient:file:*`)
* **Symptom:** Worker raised `FileNotFoundError: File data not found in Redis (expired or already processed)` during job retries.
* **Root Cause:**
  1. `worker.py` executed `redis_client.delete(file_key)` **unconditionally** immediately after `redis_client.get(file_key)` before parsing completed.
  2. If the worker crashed during parsing, the file key was already gone.
  3. When `fail_job()` requeued the task for retry, subsequent worker attempts immediately threw `FileNotFoundError`.
  4. In addition, storing raw binary file data (base64-encoded strings) in Redis RAM caused 33% payload bloat and memory pressure.
* **Architectural Flaw:** Attempting to store raw binary assets in Redis and deleting them prior to confirmed job completion violated at-least-once queue safety guarantees.

### 2.2 SSE Job Status & Timeout Fragility
* **Symptom:** Frontend reported "Job timed out" or "Failed to fetch" even when jobs completed in the backend worker.
* **Root Cause:**
  1. Frontend relied on an ephemeral pub/sub stream (`job_updates:{job_id}`). If the browser connected *after* the worker published the `COMPLETE` status event, the browser waited indefinitely until the 120s timeout expired.
  2. SSE event stream sent disparate, non-standardized event schemas (`status`, `result`, `error`) without a strict sequence or reliable initial state query.
  3. Frontend timeout acted as the primary job-completion failure boundary rather than a graceful fallback.

### 2.3 Non-Atomic Idempotency Claims
* **Symptom:** Concurrent file uploads caused duplicate job creation or permanent idempotency deadlocks.
* **Root Cause:**
  1. Idempotency checks used non-atomic two-step logic (`SETNX` followed by `SETEX`). A crash between the two commands left keys in Redis permanently without TTLs.
  2. Stale or `FAILED` job IDs blocked users from re-uploading the same file.

---

## 3. What Was Done Well (To Be Preserved)

1. **Separation of Heavy Compute:**
   * Heavy tasks (PDF parsing, PyMuPDF, Tesseract OCR, LaTeX `pdflatex` compilation) are offloaded to `worker.py` outside the FastAPI request loop.
2. **Three-Layer PDF Parsing Pipeline:**
   * Layer 1: `pdfplumber` (fast text extraction)
   * Layer 2: `pypdfium2` / `PyMuPDF` (layout preservation)
   * Layer 3: `Tesseract OCR` (scanned image fallback)
3. **LLM Fallback & Orchestration:**
   * Multi-layer fallback chain (Gemini → Qwen → DeepSeek) with strict JSON extraction and response cleaning.
4. **LaTeX Compilation Safety:**
   * Non-shell-escape invocation (`-no-shell-escape`), direct array arguments to `subprocess`, and strict temporary directory cleanup.
5. **Atomic Queue Operations:**
   * Use of Redis `BRPOPLPUSH` for queue delivery and Lua scripts for zombie worker task recovery.

---

## 4. What Was Done Poorly (To Be Redesigned)

1. **Redis Overloading (Anti-Pattern):**
   * Storing raw PDF base64 contents in Redis turned Redis into an ad-hoc object store, consuming RAM and risking key eviction under load.
2. **Uncoordinated Storage Lifecycle:**
   * PDF lifetime was tied to arbitrary Redis TTLs (300s / 3600s) rather than explicit job completion state.
3. **Ambiguous Job State Machine:**
   * Status transitions were fragmented across `queue_manager.py`, `worker.py`, and `parse.py` without an explicit state transition contract.
4. **Fragile SSE Protocol:**
   * Pub/sub events were treated as the single source of truth without snapshot state hydration on connection.

---

## 5. Architectural Corrective Actions

| Component | Old Architecture | New Target Architecture (Reset) |
| :--- | :--- | :--- |
| **PDF Asset Storage** | Redis Key (`transient:file:*` base64 string) | **Option B:** Private Object Storage (Supabase Storage / Local File Storage fallback) |
| **Redis Payload** | Contains PDF bytes + metadata | Minimal reference JSON: `{"job_id": "...", "object_key": "...", "operation": "parse"}` |
| **PDF Retention** | Manual early `delete()` or Redis TTL | Preserved in Object Storage until job reaches `COMPLETE` or `DLQ` |
| **Job State** | Implicit string updates | Strict Job State Machine (`CREATED` → `QUEUED` → `PROCESSING` → `COMPLETE` / `FAILED`) |
| **SSE Protocol** | Raw pub/sub events | Snapshot state query on connection + SSE stream updates + terminal event |

---

**Status:** Document Created & Verified  
**Next Steps:** Document Architectural Decision Records (`ARCHITECTURE_DECISIONS.md`) and prepare implementation plan.

---

## 6. Current Status (2026-08-28) — All Corrective Actions Implemented

> This section documents the current resolved state. The historical analysis above is preserved.

| Component | Historical Flaw | Current Implementation | Status |
| :--- | :--- | :--- | :--- |
| **PDF Asset Storage** | Redis Key (`transient:file:*` base64) | Object Storage (`storage_service.py`), `file_key` reference in Redis payload | ✅ RESOLVED |
| **Redis Payload** | Contains PDF bytes + metadata | Minimal `{job_id, file_key, job_type, owner_id}` reference only | ✅ RESOLVED |
| **PDF Retention** | Deleted unconditionally before null-check | Deleted only after `COMPLETE` status confirmed and result persisted | ✅ RESOLVED |
| **Job State Machine** | Implicit string updates | Formal: `QUEUED → PROCESSING → COMPLETE / RETRYING / FAILED / DLQ` | ✅ RESOLVED |
| **SSE Protocol** | Raw pub/sub events, no snapshot | Snapshot state hydration on connect + live pub/sub stream + `asyncio.sleep(0.5)` terminal flush | ✅ RESOLVED |
| **Idempotency** | Two-step `setnx + setex` with crash window | Single atomic `SET key val NX EX ttl` | ✅ RESOLVED |
| **LLM Fallback** | Gemini → Qwen → DeepSeek | DeepSeek → POOL_1 (Mistral) → POOL_2 (Ministral/Cloudflare/NVIDIA) with circuit breaker | ✅ REFACTORED |

See `ARCHITECTURE_DECISIONS.md`, `ARCHITECTURE.md`, and `VERIFICATION_REPORT.md` for implementation details.

