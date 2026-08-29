import asyncio
from starlette.responses import StreamingResponse
from starlette.testclient import TestClient
from fastapi import FastAPI

app = FastAPI()

@app.get("/stream")
async def stream():
    async def generator():
        yield "event: result\ndata: {\"text\": \"hello\"}\n\n"
    return StreamingResponse(generator(), media_type="text/event-stream")

client = TestClient(app)

def test():
    resp = client.get("/stream")
    print("STATUS:", resp.status_code)
    print("BODY:", repr(resp.content))

test()
