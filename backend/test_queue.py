import asyncio
from queue_manager import queue_manager
import uuid

async def run():
    job_id = str(uuid.uuid4())
    print(f"Enqueueing test job {job_id}")
    await queue_manager.enqueue("parse_pdf", {"filename": "test.pdf", "file_key": "fake"}, job_id)
    print("Done")

if __name__ == "__main__":
    asyncio.run(run())
