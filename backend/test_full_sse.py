import asyncio
import uuid
import json
import subprocess
from queue_manager import queue_manager
from redis_client import redis_client

async def run_test():
    job_id = str(uuid.uuid4())
    print(f"Testing Job: {job_id}")
    
    # 1. Enqueue Job
    await queue_manager.enqueue("parse_pdf", {"filename": "test.pdf", "file_key": "fake"}, job_id)
    
    # 2. Start curl to capture exactly what the browser sees
    curl_process = subprocess.Popen(
        ['curl', '-N', '-s', f'http://localhost:8000/api/jobs/{job_id}/stream'],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    await asyncio.sleep(1)
    
    # 4. Simulate Worker setting COMPLETE
    fake_result = {"resume_text": "hello\nworld", "page_count": 1}
    await redis_client.hset(f"job:data:{job_id}", "result", json.dumps(fake_result))
    await queue_manager.update_job_status(job_id, "COMPLETE")
    
    # 5. Wait for curl to finish and print output
    stdout, stderr = curl_process.communicate()
    print("--- CURL OUTPUT ---")
    print(stdout)
    
if __name__ == "__main__":
    asyncio.run(run_test())
