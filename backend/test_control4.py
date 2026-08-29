import pytest
pytestmark = pytest.mark.asyncio
from fastapi import APIRouter, Response
from fastapi.sse import EventSourceResponse, ServerSentEvent
import json

router = APIRouter()

@router.get("/control/sse-test4", response_class=EventSourceResponse)
async def sse_test4(response: Response):
    response.headers["X-Accel-Buffering"] = "no"
    yield ServerSentEvent(event="result", data={"msg": "test"})
