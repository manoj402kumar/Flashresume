import pytest
pytestmark = pytest.mark.asyncio
from fastapi import APIRouter
from fastapi.sse import EventSourceResponse, ServerSentEvent
import json

router = APIRouter()

@router.get("/control/sse-test3", response_class=EventSourceResponse)
async def sse_test3():
    res_str = '{"ats_score": 95}'
    yield ServerSentEvent(event="result", raw_data=res_str.encode("utf-8"))
    yield ServerSentEvent(event="result", raw_data=res_str)
