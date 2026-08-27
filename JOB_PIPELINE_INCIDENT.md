# Incident Report: Asynchronous Job Stuck in Processing

## 1. Description of the Incident
When a user uploaded a resume, the frontend application would transition to "Parsing..." and then to "Processing...", but remain stuck in "Processing..." indefinitely until a client-side timeout occurred.

While Redis connectivity was functional and jobs reached the worker process, the completion notification cycle back to the client broke.

## 2. Root Cause Analysis (RCA)

### A. The Pub/Sub Race Condition (Primary Cause)
In `backend/worker.py`, the completion sequence was originally ordered as:
```python
# Save status update (issues Pub/Sub publish event)
await queue_manager.update_job_status(job_id, "COMPLETE")
# Save result hash to Redis
await redis_client.hset(f"job:data:{job_id}", "result", json.dumps(final_result))
```
`update_job_status` issued a Redis `PUBLISH` command notifying SSE listeners that the job was `COMPLETE`.
Because this notification was sent *before* `hset` persisted the result object into Redis, the API SSE listener woke up instantly, queried Redis for the result payload, found `None`, and exited the stream.
The Next.js frontend, awaiting the `event: result` message, was left hanging on a closed connection in an infinite "Processing..." state.

### B. SSE Serialization Crash (Secondary Cause)
In `backend/routers/jobs.py`, the event generator was yielding Python dictionaries:
```python
yield {"event": "status", "data": ...}
```
Without specifying `response_class=EventSourceResponse`, FastAPI used a standard `StreamingResponse` which expects strings or bytes. The framework threw an unhandled `AttributeError: 'dict' object has no attribute 'encode'`, causing silent TCP socket termination without a 500 error.

## 3. Resolution and Fixes

1. **Reordered Worker Operations**:
   In `worker.py`, all task handlers (`handle_parse_job`, `handle_generate_job`, `handle_compile_latex_job`) were updated to enforce:
   ```python
   # Result must be durable BEFORE issuing the Pub/Sub notification
   await redis_client.hset(f"job:data:{job_id}", "result", json.dumps(final_result))
   await queue_manager.update_job_status(job_id, "COMPLETE")
   ```
2. **Patched SSE Generator Serialization**:
   In `backend/routers/jobs.py`, yields were updated to format valid raw SSE string payloads:
   ```python
   yield f"event: result\ndata: {result_json}\n\n"
   ```

## 4. Verification Proof

Execution of `test_job_pipeline_e2e.py` confirmed deterministic delivery across the full sequence:
```text
1. Submitting parsing job...
✓ Job created: ff712783-2ebf-465c-a347-f4a5d2826c2b
2. Verifying SSE Stream...
  -> Status update: QUEUED
  -> Status update: PROCESSING
  -> Status update: COMPLETE
  -> Result received!
✓ SSE stream successfully delivered the complete result!
```

---
**Status**: FIXED & VERIFIED
