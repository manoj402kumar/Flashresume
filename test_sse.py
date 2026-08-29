import asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient
from backend.routers.jobs import router as jobs_router
from backend.queue_manager import queue_manager
import backend.redis_client
from unittest.mock import AsyncMock

app = FastAPI()
app.include_router(jobs_router, prefix="/api/jobs")

# Mock dependencies
backend.redis_client.redis_client.get = AsyncMock(return_value="owner123")
queue_manager.get_job = AsyncMock(return_value={
    "status": "COMPLETE",
    "user_id": "owner123",
    "result": {"text": "hello\nworld"}
})

client = TestClient(app)

def run():
    print("Fetching stream...")
    resp = client.get("/api/jobs/job123/stream?ticket=ticket123")
    print("STATUS:", resp.status_code)
    print("HEADERS:", resp.headers)
    print("BODY:", repr(resp.content))

run()
