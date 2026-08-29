import asyncio
from sse_starlette.sse import EventSourceResponse
from starlette.testclient import TestClient
from fastapi import FastAPI

app = FastAPI()

@app.get("/stream")
async def stream():
    async def generator():
        yield "event: status\ndata: {\"status\": \"QUEUED\"}\n\n"
    return EventSourceResponse(generator())

client = TestClient(app)

def test():
    resp = client.get("/stream")
    print("STATUS:", resp.status_code)
    print("BODY:", repr(resp.content))

test()
