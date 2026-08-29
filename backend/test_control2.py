import pytest
pytestmark = pytest.mark.asyncio
from fastapi import APIRouter
from fastapi.sse import EventSourceResponse, ServerSentEvent
import asyncio
import json

router = APIRouter()

@router.get("/control/sse-test2", response_class=EventSourceResponse)
async def sse_test2():
    yield ServerSentEvent(event="status", data={"msg": "beat"})
    yield ServerSentEvent(event="status", data="raw string")
