# Forensic SSE Incident Report

## Primary Root Cause (Defect A)
The first SSE connection dropped at ~15ms because of a regression in the SSE format processing. The `event_generator` loop in `backend/routers/jobs.py` was yielding Python dictionaries (`yield {"event": "status", "data": ...}`) rather than properly formatted Server-Sent Event strings.
The FastAPI backend imports `EventSourceResponse` which actually maps to `fastapi.sse.EventSourceResponse` (an extension of `StreamingResponse`). This class expects either `ServerSentEvent` objects or raw strings/bytes. When it received a dictionary, the ASGI `StreamingResponse` invoked `.encode("utf-8")` on the `dict`, raising an unhandled `AttributeError: 'dict' object has no attribute 'encode'` internally.
This ASGI task crash abruptly closed the TCP socket before the first chunk boundary could be fully sent, resulting in the client encountering a transient network drop (or `incomplete chunked read`) immediately after receiving HTTP 200 headers.

## Secondary Root Cause (Defect B)
When the primary connection crashed and the TCP socket dropped, the native browser `EventSource` fired its `onerror` handler and attempted an automatic reconnection. Because native `EventSource` transparently reuses the original URL provided during instantiation, it re-requested `/api/jobs/.../stream?ticket=xxxx`.
Because `ticket=xxxx` had already been consumed atomically by Redis `GETDEL` on the first request, the server returned HTTP 401 Unauthorized. This caused the native `EventSource` to permanently fail (`readyState=2`) and enter the reported tight loop as the client repeatedly spawned new EventSources reusing the spent ticket pattern recursively.

## Fix
1. **Backend (Defect A)**: Rewrote the `event_generator` in `jobs.py` to yield properly formatted SSE string literals (e.g. `yield f"event: status\ndata: {json.dumps(...)}\n\n"`) instead of dictionaries. Also fixed a scoping issue where the `ticket_user_id` authorization check would fail if the generator didn't explicitly capture the variable, which could cause a similar immediate stream drop if auth failed.
2. **Frontend (Defect B)**: Replaced the unbounded recursive `waitForJobSSE` reconnection strategy in `src/lib/api.ts` with a strict `while` loop that implements bounded backoff (max 10 attempts). On every reconnection attempt, the client now checks the durable job status first (via `/status`), then fetches a fresh, unconsumed SSE ticket before instantiating a new `EventSource`.

## Evidence
- Direct `httpx.AsyncClient` test scripts replicating the client consumption pattern failed with `peer closed connection without sending complete message body (incomplete chunked read)` when the backend yielded dicts.
- Internal ASGI exception logs printed `AttributeError: 'dict' object has no attribute 'encode'` confirming the failure point inside `starlette.responses.stream_response`.
- Modifying the generator to yield `\n\n` delimited strings immediately restored the 200 OK SSE streaming behavior and successfully kept the connection open, returning `ping` frames and the final `result`.

## Remaining Risk
The client reconnect loop currently relies on `eventSource.onerror` providing `readyState === 2` to trigger the `TRANSIENT_RECONNECT` path. If specific browsers implement the `EventSource` standard differently and fail to transition to `readyState 2` on 401 responses, the client might hang until the overall 120s timeout expires.
