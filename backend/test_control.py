import pytest
pytestmark = pytest.mark.asyncio
from fastapi import APIRouter
from fastapi.sse import EventSourceResponse, ServerSentEvent
import asyncio
import json
import time

router = APIRouter()

@router.get("/control/sse-heartbeat", response_class=EventSourceResponse)
async def sse_heartbeat():
    for i in range(5):
        yield ServerSentEvent(event="status", data=json.dumps({"msg": "beat", "i": i}))
        await asyncio.sleep(1)
    yield ServerSentEvent(event="result", data=json.dumps({"msg": "done"}))

@router.get("/control/pubsub", response_class=EventSourceResponse)
async def pubsub_test():
    from redis_client import redis_client
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("control_test")
    yield ServerSentEvent(event="status", data="subscribed")
    start = time.time()
    while time.time() - start < 30:
        msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
        if msg:
            yield ServerSentEvent(event="message", data=msg["data"])
            break
        yield ServerSentEvent(comment="ping")
