import asyncio
import json
import uuid
import base64
import sys
sys.path.append('.')

def make_jwt(sub):
    header = base64.urlsafe_b64encode(b'{"alg":"HS256","typ":"JWT"}').decode().rstrip("=")
    payload = base64.urlsafe_b64encode(json.dumps({"sub": sub}).encode()).decode().rstrip("=")
    return f"{header}.{payload}.sig"

async def main():
    import redis_client
    job_id = str(uuid.uuid4())
    print(f"JOB_ID={job_id}")
    await redis_client.redis_client.hset(
        f"job:data:{job_id}",
        mapping={
            "id": job_id,
            "status": "QUEUED",
            "payload": json.dumps({"user_id": "test_user"}),
            "user_id": "test_user"
        }
    )
    print(f"TOKEN={make_jwt('test_user')}")

if __name__ == "__main__":
    asyncio.run(main())
