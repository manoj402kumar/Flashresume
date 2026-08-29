import asyncio
from fastapi import FastAPI, Request
from fastapi.responses import EventSourceResponse
import uvicorn
import httpx
import threading

app = FastAPI()

@app.get("/test")
async def test_endpoint(request: Request):
    async def generator():
        with open("simple_log.txt", "a") as f: f.write("start\n")
        try:
            yield {"event": "status", "data": "QUEUED"}
            with open("simple_log.txt", "a") as f: f.write("yielded status\n")
            while True:
                if await request.is_disconnected():
                    with open("simple_log.txt", "a") as f: f.write("disconnected\n")
                    break
                await asyncio.sleep(1)
                yield {"event": "ping", "data": ""}
                with open("simple_log.txt", "a") as f: f.write("yielded ping\n")
        except asyncio.CancelledError:
            with open("simple_log.txt", "a") as f: f.write("cancelled\n")
        finally:
            with open("simple_log.txt", "a") as f: f.write("finally\n")
            
    return EventSourceResponse(generator())

def run_server():
    uvicorn.run(app, host="127.0.0.1", port=8001, log_level="error")

async def run_client():
    await asyncio.sleep(1)
    async with httpx.AsyncClient() as client:
        try:
            async with client.stream("GET", "http://127.0.0.1:8001/test") as r:
                print("Status:", r.status_code)
                async for chunk in r.aiter_bytes():
                    print("Chunk:", chunk)
                    break
        except Exception as e:
            print("Error:", e)

threading.Thread(target=run_server, daemon=True).start()
asyncio.run(run_client())
