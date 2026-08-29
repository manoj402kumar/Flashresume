from fastapi import APIRouter, HTTPException, Request, Header, Depends, Response
from auth_utils import verify_user
from fastapi.sse import EventSourceResponse, ServerSentEvent
import asyncio
import json
from queue_manager import queue_manager
from rate_limiter import extract_user_id_from_jwt
import supabase_client as sc

router = APIRouter()

def get_authenticated_user_id(token: str) -> str | None:
    if not token:
        return None
    uid = extract_user_id_from_jwt(f"Bearer {token}" if not token.startswith("Bearer ") else token)
    return uid

@router.get("/{job_id}/status")
async def get_job_status(job_id: str, request: Request, token: str = None):
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
        
    job = await queue_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    payload = job.get("payload", {})
    owner_id = job.get("user_id") or (payload.get("user_id") if isinstance(payload, dict) else None)
    if owner_id:
        user_id = get_authenticated_user_id(token)
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required to view this job")
        if user_id != owner_id:
            raise HTTPException(status_code=403, detail="Not authorized to view this job")
            
    response = {
        "id": job["id"],
        "status": job["status"],
        "error": job.get("error", "")
    }
    
    if job["status"] == "COMPLETE" and "result" in job:
        response["result"] = job["result"]
        
    return response

@router.get("/{job_id}/stream", response_class=EventSourceResponse)
async def stream_job_status(job_id: str, request: Request, response: Response, user_id: str = Depends(verify_user)):
    response.headers["X-Accel-Buffering"] = "no"
    response.headers["Cache-Control"] = "no-cache"
    response.headers["Connection"] = "keep-alive"
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
    user_id = get_authenticated_user_id(authorization.split(" ", 1)[1])
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    ticket_user_id = user_id

    from redis_client import redis_client
    pubsub = redis_client.pubsub()
    
    try:
        # 1. Subscribe to Pub/Sub BEFORE checking job state to avoid race condition
        await pubsub.subscribe(f"job_updates:{job_id}")

        # 2. Reconcile current state (durable)
        job = await queue_manager.get_job(job_id)
        if not job:
            yield ServerSentEvent(event="error", data={"error": "Job not found"})
            return
            
        payload = job.get("payload", {})
        owner_id = job.get("user_id") or (payload.get("user_id") if isinstance(payload, dict) else None)
        if owner_id and ticket_user_id != owner_id:
            yield ServerSentEvent(event="error", data={"error": "Not authorized to view this job"})
            return
            
        yield ServerSentEvent(event="status", data={"status": job["status"]})
        
        if job["status"] in ["COMPLETE", "FAILED"]:
            if job["status"] == "COMPLETE":
                if "result" in job:
                    res_str = json.dumps(job["result"]) if isinstance(job["result"], dict) else str(job["result"])
                    yield ServerSentEvent(event="result", raw_data=res_str)
                else:
                    yield ServerSentEvent(event="error", data={"error": "Job completed but result payload is missing."})
            elif job["status"] == "FAILED":
                err_msg = job.get("error", "Job failed during processing.")
                yield f'event: error\ndata: {json.dumps({"error": err_msg})}\n\n'
            await asyncio.sleep(0.5)
            return
            
        while True:
            if await request.is_disconnected():
                break
                
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message:
                data = json.loads(message["data"])
                status = data.get("status")
                error = data.get("error", "")
                
                yield ServerSentEvent(event="status", data={"status": status, "error": error})
                
                if status == "COMPLETE":
                    job = await queue_manager.get_job(job_id)
                    if job and "result" in job:
                        res_str = json.dumps(job["result"]) if isinstance(job["result"], dict) else str(job["result"])
                        yield ServerSentEvent(event="result", raw_data=res_str)
                    else:
                        yield ServerSentEvent(event="error", data={"error": "Job completed but result payload is missing."})
                    await asyncio.sleep(0.5)
                    break
                elif status == "FAILED":
                    yield ServerSentEvent(event="error", data={"error": error or "Job failed during processing."})
                    await asyncio.sleep(0.5)
                    break
            else:
                yield ': ping\n\n'
    finally:
        await pubsub.unsubscribe(f"job_updates:{job_id}")
        await pubsub.close()


