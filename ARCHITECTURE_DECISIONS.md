# FlashResume — Architecture Decision Records (ADR)

## Overview

This document records the key architectural decisions for the **FlashResume Controlled Reset**. Every decision evaluated herein addresses real-world concurrency, failure recovery, security, cost, and maintainability constraints.

---

## ADR-1: Object Storage Layer (Option B) for PDF Assets

### Decision
Store uploaded raw PDF files in a **Private Object Storage Layer** (Supabase Storage in production; Local File Storage fallback for offline/development environments). Redis will store **only minimal job payloads containing opaque object references** (`object_key`).

### Context & Problem
Previously, raw PDF bytes were base64-encoded and stored directly in Redis (`transient:file:*`). This overloaded Redis RAM, inflated network payload sizes, introduced eviction risks, and led to file missing errors during worker retries.

### Architecture

```text
Browser / API Gateway
       │
       ▼ (Upload PDF)
┌────────────────────────────────────────┐
│  Private Object Storage Layer          │
│  Bucket: transient-resumes             │
│  Path:   resumes/YYYY/MM/DD/<uuid>.pdf │
└──────────────────┬─────────────────────┘
                   │
                   ▼ (Returns object_key)
┌────────────────────────────────────────┐
│  Redis Queue                           │
│  Payload: {"job_id": "...",            │
│            "object_key": "..."}        │
└──────────────────┬─────────────────────┘
                   │
                   ▼ (Dequeues reference)
┌────────────────────────────────────────┐
│  Heavy Worker Service                  │
│  - Downloads PDF via object_key        │
│  - Parses resume text                  │
│  - Cleans object on COMPLETE / DLQ     │
└────────────────────────────────────────┘
```

### Alternatives Considered
1. **Option A (Status Quo - Redis Blob Storage):** Rejected. Overloads Redis RAM, risks eviction, creates PII retention concerns in Redis persistence dumps.
2. **Direct Browser Upload to S3/Supabase via Signed URLs:** Deferred for future optimization. Core API upload with streaming to Object Storage provides better validation control for now.

### Security & Compliance Impact
* **Privacy / PII:** PDF files live in an access-controlled private bucket with short retention policies. Raw PDF data never touches Redis logs or memory snapshots.
* **Access Control:** Storage buckets are private; worker retrieves objects using service-role credentials or temporary scoped tokens.

### Cost & Performance Impact
* **Redis RAM:** Savings of >95% memory usage per job.
* **Throughput:** Queue messages shrink from ~5MB to ~200 bytes.

---

## ADR-2: Boundaries of Redis Coordination Layer

### Decision
Restrict Redis strictly to its core strengths:
1. Ephemeral Job Queue (`queue:jobs:pending`, `queue:jobs:processing`, `queue:jobs:dlq`)
2. Distributed Job State Hashes (`job:data:<job_id>`)
3. Distributed Token Bucket Rate Limiting / Quota Control
4. Lock Coordination (`SET key val NX EX`)
5. Light Status Notifications (`job_updates:<job_id>` pub/sub)

### Prohibited Uses of Redis
* ❌ NO storing raw file binaries or base64 blobs (>10KB).
* ❌ NO permanent record storage (all finished results persist to Supabase DB or expire via 1-hour TTL).

---

## ADR-3: Unified Job State Machine & Retry Retention Policy

### Decision
Implement a formal, monotonic Job State Machine.

### State Transitions

```text
[CREATED] ──► [UPLOADED] ──► [QUEUED] ──► [PROCESSING] ──► [COMPLETE]
                                               │
                                               ├─► [RETRYING] ──► [PROCESSING]
                                               │
                                               └─► [FAILED / DLQ]
```

### State Ownership Rules
* **API Gateway:** Creates job (`CREATED`), uploads asset (`UPLOADED`), pushes to queue (`QUEUED`).
* **Worker Service:** Claims job (`PROCESSING`), updates stage, sets `COMPLETE` or handles error (`RETRYING` / `FAILED`).
* **Queue Manager:** Handles visibility timeouts and moves unacknowledged jobs to `RETRYING` or `DLQ`.

### Asset Retention & Retry Invariant
> **Central Invariant:** The PDF object in Object Storage MUST remain accessible throughout all worker retries. It is ONLY deleted when the job reaches terminal `COMPLETE` status or is moved to `DLQ`.

---

## ADR-4: SSE Protocol Contract & Hydration Safety

### Decision
Standardize the SSE contract between Core API and Next.js Frontend:

1. **Initial Hydration:** When a client connects to `/api/jobs/{job_id}/stream`, the server **first** fetches and emits the current state hash from Redis.
2. **Pub/Sub Stream:** The server then listens to `job_updates:{job_id}` for real-time state changes.
3. **Explicit Terminal Events:**
   * `event: status` → `data: {"status": "QUEUED" | "PROCESSING" | "RETRYING"}`
   * `event: result` → `data: { ...parsed/generated result... }`
   * `event: error`  → `data: {"error": "Descriptive error message"}`
4. **Fallback Polling:** If SSE fails to connect or drops, client falls back gracefully to `GET /api/jobs/{job_id}/status`.

---

## ADR-5: Pluggable Storage Abstraction (`StorageService`)

### Decision
Implement an abstract `StorageService` interface in Python with concrete providers:
1. `SupabaseStorageProvider`: Production implementation utilizing private bucket `transient-resumes`.
2. `LocalStorageProvider`: Development/Testing fallback utilizing `/backend/storage/transient/` directory when running locally or offline.

---

**Status:** Document Created & Verified  
**Next Steps:** Proceed to implementation plan creation and user approval.
