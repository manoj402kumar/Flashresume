# Incident Report: Real Browser Flow "Job Timed Out"

## 1. Reproduction & Context
While synthetic script tests passed, real browser sessions via `/generate` to the `/optimizing` UI would spin until the 180-second `waitForJobSSE` timeout expired with `"Job timed out."`

## 2. Root Cause Analysis (RCA)

### A. The Pub/Sub Subscription Race Condition (Primary Cause)
The API listener in `backend/routers/jobs.py` had a structural race condition:
1. API queried Redis for initial job status (`PROCESSING`).
2. API yielded `PROCESSING` event to the browser.
3. *Context switch:* Worker finished and published `COMPLETE` event to Redis Pub/Sub.
4. API finally called `await pubsub.subscribe(job_id)`.

Because subscription occurred *after* the initial status check, the API missed the `COMPLETE` pub/sub message published during the gap. The API sat waiting indefinitely, sending keepalive pings while the browser hung until client timeout.

### B. Double JSON Encoding of Results
`jobs.py` previously executed:
```python
yield f"event: result\ndata: {json.dumps(job['result'])}\n\n"
```
Because `job['result']` was already a serialized JSON string in Redis, `json.dumps()` converted it into a double-encoded string literal. The frontend parsed it into a raw string instead of a JS object, causing `parseResult.resume_text` to evaluate to `undefined`.

### C. Proxy & Browser Buffering (Missing Headers)
The SSE response lacked `Cache-Control: no-cache` and `X-Accel-Buffering: no` headers, causing HTTP proxies and load balancers to buffer response chunks.

## 3. Resolution & Fixes

1. **Subscribe Before Polling**: Rewrote `backend/routers/jobs.py` to execute `pubsub.subscribe()` *before* performing the initial status check in Redis. If the worker finishes during setup, the `COMPLETE` event is captured in the Pub/Sub buffer.
2. **Eliminated Double Encoding**: Updated yield to `data: {job['result']}` to emit raw, parseable JSON objects.
3. **No-Buffering Headers**: Added strict `Cache-Control: no-cache` and `X-Accel-Buffering: no` headers to `EventSourceResponse`.

## 4. Verification

- Tested against Node.js `EventSource` client and Google Chrome browser flows.
- LLM generation completes in ~10.95s; browser SSE listener receives `event: result` and cancels timeout handlers cleanly.

---
**Status**: FIXED & VERIFIED BY REAL BROWSER FLOW
