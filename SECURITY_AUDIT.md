# Security Audit

> **Last verified**: 2026-08-28  
> **Verified against**: `backend/routers/jobs.py`, `backend/services/latex_compiler.py`, `backend/worker.py`, `backend/llm/quota_manager.py`, `backend/queue_manager.py`, `backend/Dockerfile`

## 1. LaTeX Arbitrary Code Execution (RCE)
- **Component**: `backend/services/latex_compiler.py` & Docker Sandbox
- **Exploit Mechanism**: Malicious LaTeX payloads executing shell commands via `\write18` if enabled.
- **Risk**: Critical
- **Remediation**: Implemented `pdflatex -no-shell-escape` natively. Process is wrapped in a Python `asyncio` execution sandbox with a 15-second hard timeout. Docker container executes under non-root Linux user (`USER appuser`).
- **Verification**: Verified via code inspection and runtime test. The flag is strictly enforced and subprocess execution is bounded.

## 2. Ephemeral Disk & Resource Exhaustion
- **Component**: PDF Processing & LaTeX Compilation (`worker.py`)
- **Exploit Mechanism**: Attackers uploading large or numerous PDFs to fill disk space.
- **Risk**: High
- **Remediation**: `worker.py` wraps file handling in `try...finally` blocks executing explicit `os.remove(file_path)` upon completion or failure.
- **Verification**: `finally: os.remove(file_path)` verified across all worker task handlers.

## 3. LLM API Quota Exhaustion / Cost Denial of Wallet
- **Component**: `master_llm_caller.py` & `quota_manager.py`
- **Exploit Mechanism**: Burst requests exhausting upstream LLM provider rate limits and inflating API costs.
- **Risk**: High
- **Remediation**: Distributed `RedisQuotaManager` using atomic Redis Lua scripts to enforce Requests Per Minute (RPM) token bucket limits across worker nodes.
- **Verification**: `quota_manager.acquire()` integrated in `call_llm_balanced()` and verified in multi-worker unit tests.

## 4. Unbounded Queue Growth & Zombie Tasks
- **Component**: Redis Queue Manager (`queue_manager.py`)
- **Exploit Mechanism**: Worker crashes leaving jobs stuck in processing state, leaking system resources.
- **Risk**: Medium
- **Remediation**: Sidekiq-style reliable queueing via `BRPOPLPUSH`. Background recovery loop reclaims tasks exceeding `VISIBILITY_TIMEOUT` using atomic Lua script.
- **Verification**: `recover_zombies()` implementation verified via `test_zombie_recovery`.

## 5. PII Leakage in Message Brokers
- **Component**: Redis Queue Payload
- **Exploit Mechanism**: Raw PDF binary data sitting unencrypted in Redis queues and persistence snapshots.
- **Risk**: Medium
- **Remediation**: Claim-Check pattern applied. Redis messages store opaque storage keys (`file_key`) instead of binary data. Transient files are purged immediately after processing.
- **Verification**: Verified in `test_claim_check`.

## 6. Authorization & SSE Data Isolation
- **Component**: `routers/jobs.py` (SSE Endpoint and Status Endpoint)
- **Exploit Mechanism**: Unauthorized clients eavesdropping on job status streams of other users.
- **Risk**: High
- **Remediation**: Both `GET /api/jobs/{job_id}/stream` and `GET /api/jobs/{job_id}/status` verify the caller's identity before returning data. Authentication token accepted via either:
  1. `Authorization: Bearer <token>` HTTP header, or
  2. `?token=<jwt>` query parameter (for browser `EventSource` compatibility)
  The authenticated user's `sub` (user ID) is compared against the job's `owner_id` stored in Redis. Non-matching callers receive `401` (unauthenticated) or `403` (authenticated but unauthorized).
- **Verification**: Inspected authorization flow in `routers/jobs.py:get_authenticated_user_id()` and `stream_job_status()`.

## 7. API Rate Limiting (Process-Independent)
- **Component**: `rate_limiter.py` (SlowAPI + Redis)
- **Exploit Mechanism**: Burst requests exhausting API capacity or triggering excessive LLM calls.
- **Risk**: Medium
- **Remediation**: SlowAPI rate limiter (`100 req/min per IP`) is applied to API endpoints. Distributed via Redis storage backend, ensuring limits hold across multiple API node replicas. LLM quota additionally protected by distributed token-bucket (`quota_manager.py`).
- **Verification**: Inspected `rate_limiter.py` and `main.py` `limiter` integration.

---
**Audit Status**: ✅ PASSED & VERIFIED  
**Last verified**: 2026-08-28
