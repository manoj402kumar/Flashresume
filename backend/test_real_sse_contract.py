import pytest
pytestmark = pytest.mark.asyncio
import asyncio
import uuid
import json
import httpx
from queue_manager import queue_manager
from redis_client import redis_client

async def run_test():
    job_id = str(uuid.uuid4())
    print(f"Testing Job: {job_id}")
    
    # 1. Enqueue Job
    await queue_manager.enqueue("parse_pdf", {"filename": "test.pdf", "file_key": "fake"}, job_id)
    
    # 2. Start SSE Client
    async def sse_client():
        try:
            async with httpx.AsyncClient() as client:
                print("SSE: Connecting...")
                async with client.stream('GET', f"http://localhost:8000/api/jobs/{job_id}/stream", timeout=10.0) as response:
                    print(f"SSE: Status {response.status_code}")
                    async for line in response.aiter_lines():
                        if line.strip():
                            print(f"SSE-Frame: {line}")
        except Exception as e:
            print(f"SSE: Error - {e}")
            
    sse_task = asyncio.create_task(sse_client())
    
    # 3. Wait a moment
    await asyncio.sleep(1)
    
    # 4. Simulate Worker setting COMPLETE
    print("Worker: Setting result and COMPLETE")
    fake_result = {"resume_text": "hello\nworld", "page_count": 1}
    await redis_client.hset(f"job:data:{job_id}", "result", json.dumps(fake_result))
    await queue_manager.update_job_status(job_id, "COMPLETE")
    
    # 5. Wait for SSE to finish
    await sse_task
    
if __name__ == "__main__":
    asyncio.run(run_test())
