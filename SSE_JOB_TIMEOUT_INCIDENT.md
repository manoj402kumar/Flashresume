# SSE Job Timeout — Root Cause & Fix (VERIFIED)

> **Current Status**: ✅ RESOLVED (2026-08-28)  
> **Resolution**: `await asyncio.sleep(0.5)` added after all terminal `yield` statements in `jobs.py` to ensure TCP flush before stream close. Explicit `event: error` emitted when result key is absent. See "Wire Evidence" section below for verified SSE event trace.

---

## Root Cause: Proxy Truncation of Terminal SSE Frame

When `jobs.py` yielded `event: result\ndata: {...}\n\n` and immediately returned,
the ASGI server sent a TCP FIN essentially simultaneously with the final data chunk.

Reverse proxies (Render/Nginx edge) may flush before the trailing `\n\n` reaches
the client socket. The browser `EventSource` spec requires the strict double-newline
to dispatch the event to JS. Without it, EventSource silently discards the frame,
auto-reconnects, hits the same instant-close, loops until the 120-180s setTimeout fires.

### Why Python tests passed
`httpx.aiter_lines()` and `curl` parse raw HTTP line-by-line. They received the JSON
data line and considered the stream done - unaware the browser would reject it.

## Fix Applied — jobs.py

Added `await asyncio.sleep(0.5)` after every terminal `yield` in both code paths:
- Initial state check (job already COMPLETE when SSE connects)
- Live pubsub loop (job completes while SSE is listening)

Also added explicit `event: error` when job is COMPLETE but `result` key is absent
(previously silently closed, causing infinite reconnect loop).

## Wire Evidence (Real Job dd9b49af)

Live path:
  event: status   data: {"status":"QUEUED"}
  : ping
  event: status   data: {"status":"PROCESSING","error":""}
  event: status   data: {"status":"COMPLETE","error":""}
  event: result   data: {"resume_text":"...","page_count":1,"parser_used":"pypdfium2",...}

Reconnect path (already-complete job):
  event: status   data: {"status":"COMPLETE"}
  event: result   data: {"resume_text":"...","page_count":1,"parser_used":"pypdfium2",...}

## Timing (Real PDF, 45980 bytes)

  T+0.00s  Job enqueued
  T+0.03s  SSE connected, QUEUED received
  T+1.51s  PROCESSING received
  T+1.71s  COMPLETE + result received
  Total: 1.71s  (well within 120s timeout)

## Three-Scenario SSE Contract Test

  Scenario A: Live pubsub (connects before completion)  PASS
  Scenario B: Already-COMPLETE job (reconnect path)     PASS
  Scenario C: Near-instant completion (race stress)      PASS

## Acceptance Matrix

  SSE connects                   PASS
  QUEUED received                PASS
  PROCESSING received            PASS
  COMPLETE received              PASS
  Result event received          PASS
  JSON.parse succeeds            PASS (result is plain dict, no double-encoding)
  Promise resolves before timeout PASS (1.71s vs 120s limit)
  Already-complete job works     PASS
  FAILED job emits error event   PASS
  Missing result emits error     PASS (no more infinite reconnect loops)

Status: FIXED — VERIFIED
