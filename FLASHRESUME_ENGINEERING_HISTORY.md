# FlashResume Engineering History

## 1. Historical Architecture
Initially, FlashResume was built to process resumes as quickly as possible. The architecture pushed raw PDF base64 bytes into Redis alongside job metadata to avoid provisioning a separate object storage layer. Job coordination was handled via simple Redis pub/sub and list pushes without strict state machine enforcement or idempotency locking.

## 2. Architecture Evolution Timeline
- **Initial Build**: Single FastAPI layer handling file uploads, storing base64 in Redis, and pushing a queue message.
- **Worker Isolation**: Compute (parsing, OCR, LLM, LaTeX) was extracted into a separate `worker.py` fleet to prevent the API from blocking.
- **LLM Fallback Injection**: Hardcoded OpenAI/Gemini calls were replaced with a robust multi-provider fallback orchestrator (Mistral, DeepSeek, etc.) to handle `429 Quota Exceeded` errors during high traffic.
- **Storage Migration (The Great Reset)**: Redis collapsed under the memory pressure of base64 PDFs. PDF binaries were migrated to an isolated Supabase/Local Object Storage layer. Redis was strictly relegated to metadata and coordination.

## 3. Major Architectural Decisions
- **ADR-001 (Storage)**: Binaries will NEVER be stored in Redis. They must be written to Supabase Storage or Local File System. The queue payload only passes a `file_key` string.
- **ADR-002 (Idempotency)**: All queue admissions must be gated by a strict, atomic `SET NX EX` Redis lock keyed by the SHA-256 hash of the uploaded file.
- **ADR-003 (Job Isolation)**: All job payloads must contain a `user_id`. SSE endpoints must verify the requested job belongs to the authenticated JWT `user_id` to prevent IDOR.

## 4. Failed Approaches
- **Base64 in Redis**: Attempting to use a single Redis instance as a memory queue AND an object store caused massive memory bloat and random key evictions.
- **Two-Step Locking**: Using `SETNX` on line 1 and `SETEX` on line 2 for idempotency created a crash window. If the process crashed between line 1 and 2, the lock existed forever without a TTL, permanently locking out users from retrying their uploads.
- **Implicit Status Updates**: Relying on arbitrary strings published to a pub/sub channel instead of a formal state machine caused UI hangs if a message was missed.

## 5. Incidents
- **INCIDENT-001: Transient PDF Missing**
  - *Symptom*: Jobs failed on retry with `FileNotFoundError: File data not found in Redis`.
- **INCIDENT-002: SSE Job Timeout**
  - *Symptom*: Browser reported "Job timed out" despite backend worker successfully completing the job.
- **INCIDENT-003: 100-User Capacity Bottleneck**
  - *Symptom*: System ground to a halt during heavy synthetic testing.

## 6. Root Causes
- **INCIDENT-001 Root Cause**: `worker.py` unconditionally deleted the transient PDF key immediately upon retrieving it (before parsing was finished). If parsing crashed, the file was gone. Retries were guaranteed to fail.
- **INCIDENT-002 Root Cause**: The ASGI server sent the final SSE `\n\n` chunk at the exact same moment as the TCP FIN packet. Nginx truncated the final chunk. The browser silently rejected the malformed frame and infinite-looped reconnects until a 120s timeout.
- **INCIDENT-003 Root Cause**: The single-threaded `worker.py` could only process 1 job every ~15 seconds (due to OCR + LLM latency). A queue depth of 100 meant user #100 waited 25 minutes.

## 7. Fixes
- **INCIDENT-001 Fix**: Moved the `storage_service.delete_file()` call to the very end of the worker loop, strictly AFTER `queue_manager.update_job_status(job_id, "COMPLETE")` is confirmed.
- **INCIDENT-002 Fix**: Added `await asyncio.sleep(0.5)` after the final `yield` in `jobs.py:stream_job_status` to ensure Nginx flushes the TCP buffer before closing the socket.
- **INCIDENT-003 Fix**: Implemented an atomic Lua admission script in `queue_manager.py` that hard-caps global queue depth to `MAX_PENDING_JOBS=200` and limits users to `MAX_ACTIVE=2` to prevent single-user DOS.

## 8. Verification
- `test_transient_pdf_lifecycle.py` was introduced to prove that the transient file survives a worker crash and can be successfully retrieved on retry.
- `test_full_sse.py` validates the exact bytes transmitted over the TCP socket to ensure the double-newline is preserved.

## 9. Why Previous Verification Was Insufficient
Prior synthetic tests passed because they were written in Python using `httpx`. Python HTTP libraries read streams line-by-line and did not care about the strict `EventSource` W3C specification requiring `\n\n`. The tests passed while the real browser failed. **Lesson: Always test SSE in a real browser context or explicitly validate the strict byte stream.**

## 10. Lessons Learned
- **Never delete input data before output data is secured.**
- **Never assume standard HTTP proxies will perfectly flush chunked streams upon immediate close.**
- **Redis is not an object store.**
- **At-least-once delivery semantics are useless if the input payload is destroyed on the first attempt.**

## 11. Permanent Invariants
1. A valid queued job must retain access to its required PDF until the job has either completed successfully or been permanently DLQ'd.
2. A user must not be able to read the SSE stream or job status of a job owned by another user.
3. API nodes must remain 100% stateless. All coordination must happen in Redis or Postgres.

## 12. Regressions To Avoid
- Do not remove the `asyncio.sleep(0.5)` in the SSE streams.
- Do not move the `delete_file()` call in `worker.py` up in the function execution order.
- Do not replace the Lua admission script in `queue_manager.py` with sequential Python logic.

## 13. Historical Technical Debt
- OCR (Tesseract) runs in the same container as the FastAPI worker process. This poses an ongoing OOM (Out Of Memory) risk if heavily concurrent.

## 14. Superseded Architecture
- The old architecture where base64 strings were `SETEX`'d into Redis is permanently superseded. Any old documentation referencing `transient:file:*` Redis keys is stale and incorrect.

## 15. Current Architectural Conclusions
FlashResume's backend is now a mature, robust asynchronous system. It correctly handles at-least-once delivery, strictly separates binary storage from metadata, protects itself from queue exhaustion via Lua admission control, and safely delivers real-time updates to the browser using a hardened SSE implementation. 
