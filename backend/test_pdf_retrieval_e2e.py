import pytest
pytestmark = pytest.mark.asyncio
import asyncio
import json
import uuid
import base64
import hashlib
from redis_client import redis_client
from queue_manager import queue_manager

async def run_test():
    # 1. Create a dummy PDF bytes payload
    original_bytes = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n"
    original_size = len(original_bytes)
    original_sha256 = hashlib.sha256(original_bytes).hexdigest()
    
    # 2. Simulate Core API Ingestion
    job_id = str(uuid.uuid4())
    file_key = f"transient:file:{uuid.uuid4().hex}"
    
    b64_data = base64.b64encode(original_bytes).decode('utf-8')
    await redis_client.setex(file_key, 300, b64_data)
    
    # Validate Redis storage
    stored_data = await redis_client.get(file_key)
    redis_bytes = base64.b64decode(stored_data)
    redis_size = len(redis_bytes)
    redis_sha256 = hashlib.sha256(redis_bytes).hexdigest()
    
    print(f"API -> Redis:")
    print(f"Original size: {original_size}, SHA256: {original_sha256}")
    print(f"Redis size: {redis_size}, SHA256: {redis_sha256}")
    
    # 3. Simulate Worker Retrieval
    retrieved_data = await redis_client.get(file_key)
    await redis_client.delete(file_key)
    
    if isinstance(retrieved_data, str):
        worker_bytes = base64.b64decode(retrieved_data)
    else:
        worker_bytes = retrieved_data
        
    worker_size = len(worker_bytes)
    worker_sha256 = hashlib.sha256(worker_bytes).hexdigest()
    
    print(f"\nRedis -> Worker:")
    print(f"Worker size: {worker_size}, SHA256: {worker_sha256}")
    
    if original_sha256 == redis_sha256 == worker_sha256:
        print("\nSUCCESS: Bytes matched perfectly end-to-end!")
    else:
        print("\nFAILURE: Bytes mismatch!")

if __name__ == "__main__":
    asyncio.run(run_test())
