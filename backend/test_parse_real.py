import pytest
pytestmark = pytest.mark.asyncio
import asyncio
import json
import uuid
import base64
import hashlib
from redis_client import redis_client
from queue_manager import queue_manager
from services.parse_orchestrator import extract_resume_text

async def run_test():
    with open("../public/reference_Resume.pdf", "rb") as f:
        original_bytes = f.read()
    
    original_size = len(original_bytes)
    original_sha256 = hashlib.sha256(original_bytes).hexdigest()
    
    file_key = f"transient:file:{uuid.uuid4().hex}"
    
    b64_data = base64.b64encode(original_bytes).decode('utf-8')
    await redis_client.setex(file_key, 300, b64_data)
    
    retrieved_data = await redis_client.get(file_key)
    worker_bytes = base64.b64decode(retrieved_data) if isinstance(retrieved_data, str) else retrieved_data
    worker_size = len(worker_bytes)
    worker_sha256 = hashlib.sha256(worker_bytes).hexdigest()
    
    print(f"Original: size={original_size}, sha256={original_sha256}")
    print(f"Worker: size={worker_size}, sha256={worker_sha256}")
    
    if original_sha256 == worker_sha256:
        print("Hash matched! Running parser...")
        try:
            result = extract_resume_text(worker_bytes)
            print(f"Parsing successful! Extracted {result['page_count']} pages via {result['parser_used']}")
        except Exception as e:
            print(f"Parsing failed: {str(e)}")
    else:
        print("Hash mismatch!")

if __name__ == "__main__":
    asyncio.run(run_test())
