# SSE Job Timeout Research

## Browser EventSource Spec vs Python HTTP Clients
A critical difference exists between how `EventSource` in standard browsers handles streaming data versus how raw HTTP clients (like Python's `httpx` or `curl`) handle it.
* **Python (`httpx.aiter_lines()`)**: Reads the stream line-by-line. If the connection closes abruptly after `data: {...}`, Python still yields the final line.
* **Browser (`EventSource`)**: Strictly follows the Server-Sent Events specification. An event is **only** dispatched to JavaScript if it is fully terminated by an empty line (i.e., `\n\n`). If the TCP connection closes before the final `\n\n` is received, the browser considers the event incomplete, silently discards it, and automatically initiates a reconnection.

## Reverse Proxy Buffering
When FastAPI/Starlette yields a string like `event: result\ndata: {...}\n\n` and immediately exits the generator, the ASGI server immediately closes the response stream.
In production architectures (e.g., Vercel, Render, Nginx), the reverse proxy buffers HTTP chunks. If the upstream connection closes instantaneously after sending the last chunk, the proxy may flush the buffer, but in some edge cases involving chunked transfer encoding and instantaneous teardown, the trailing `\n\n` bytes can be truncated or not fully flushed to the client's socket before the FIN packet is sent.

## Reconnection Race Conditions
When the browser discards the truncated `result` event and reconnects:
1. The backend performs an initial state check (`get_job`).
2. It sees `status == COMPLETE` and yields `event: result\ndata: {...}\n\n`.
3. It immediately `return`s, closing the connection again.
4. The proxy again truncates the trailing `\n\n`.
5. The browser discards it again and reconnects.
This causes an infinite, silent reconnect loop that prevents the Promise from ever resolving, eventually triggering the `setTimeout` (120s or 180s) fallback.

## Missing Result Edge Case
Prior to the fix, if the Redis job hash contained `status: COMPLETE` but somehow lacked the `result` payload, the `jobs.py` logic would just `break` the loop without emitting any event, close the connection, and trigger the exact same infinite reconnect loop.
