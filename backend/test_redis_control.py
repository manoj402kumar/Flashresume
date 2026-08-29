import pytest
pytestmark = pytest.mark.asyncio
from fastapi import FastAPI
from fastapi.responses import EventSourceResponse
import uvicorn
import asyncio
from redis_client import redis_client

app = FastAPI()

@app.get("/debug/redis-sse")
async def redis_sse():
    async def event_generator():
        pubsub = redis_client.pubsub()
        await pubsub.subscribe("test_channel")
        yield "data: connected\n\n"
        
        try:
            for i in range(30):
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message:
                    yield f"data: message {message['data']}\n\n"
                else:
                    yield f": ping {i}\n\n"
        finally:
            await pubsub.unsubscribe("test_channel")
            await pubsub.close()
            
    return EventSourceResponse(event_generator())

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8002)
