import pytest
pytestmark = pytest.mark.asyncio
import asyncio
import json
import uuid

from main import app
from fastapi.testclient import TestClient
from queue_manager import queue_manager

client = TestClient(app)

def run_test():
    job_id = str(uuid.uuid4())
    print(f"Creating job: {job_id}")
    
    # 1. Enqueue job directly to Redis
    import redis_client
    async def push_job():
        await redis_client.redis_client.hset(
            f"job:data:{job_id}",
            mapping={
                "id": job_id,
                "status": "QUEUED",
                "payload": json.dumps({"user_id": "test_user"}),
                "user_id": "test_user"
            }
        )
    asyncio.run(push_job())
    
    fake_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0X3VzZXIifQ.sig"
    
    # 2. Get ticket
    ticket_res = client.post(f"/api/jobs/{job_id}/stream-ticket", headers={"Authorization": f"Bearer {fake_token}"})
    print("Ticket response:", ticket_res.status_code, ticket_res.text)
    if ticket_res.status_code != 200:
        return
    ticket = ticket_res.json()["ticket"]
    
    # 3. Connect to SSE
    try:
        with client.stream("GET", f"/api/jobs/{job_id}/stream?ticket={ticket}") as response:
            print("SSE connected, status:", response.status_code)
            for line in response.iter_lines():
                if line:
                    print("SSE:", line)
                    if "QUEUED" in line:
                        break # break early for test
    except Exception as e:
        print("Exception during stream:", e)

if __name__ == "__main__":
    run_test()
