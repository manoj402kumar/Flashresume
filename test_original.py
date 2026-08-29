import asyncio
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
import uvicorn
import httpx
import threading

app = FastAPI()
# simulate EventSourceResponse if it's just StreamingResponse
EventSourceResponse = StreamingResponse

@app.get("/test")
async def test_endpoint(request: Request):
    async def generator():
        try:
            yield "event: status\ndata: QUEUED\n\n"
            while True:
                if await request.is_disconnected():
                    break
                await asyncio.sleep(1)
                yield ": ping\n\n"
        except asyncio.CancelledError:
            print("Cancelled")
        finally:
            print("Finally")
            
    return EventSourceResponse(generator(), media_type="text/event-stream")

def run_server():
    uvicorn.run(app, host="127.0.0.1", port=8002, log_level="error")

async def run_client():
    await asyncio.sleep(1)
    async with httpx.AsyncClient() as client:
        try:
            async with client.stream("GET", "http://127.0.0.1:8002/test") as r:
                print("Status:", r.status_code)
                async for chunk in r.aiter_bytes():
                    print("Chunk:", chunk)
                    # wait 3 seconds then disconnect
                    await asyncio.sleep(3)
                    break
        except Exception as e:
            print("Error:", e)

threading.Thread(target=run_server, daemon=True).start()
asyncio.run(run_client())
