import pytest
pytestmark = pytest.mark.asyncio
from fastapi import FastAPI
from fastapi.responses import EventSourceResponse
import uvicorn
import asyncio
import json

app = FastAPI()

@app.get("/debug/sse-heartbeat")
async def sse_heartbeat():
    async def event_generator():
        yield f'event: status\ndata: {{"status": "PING"}}\n\n'
        await asyncio.sleep(1)
        yield f'event: status\ndata: {{"status": "PING2"}}\n\n'
        await asyncio.sleep(1)
        
    return EventSourceResponse(event_generator())

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8001)
