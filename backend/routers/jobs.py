from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import EventSourceResponse
import asyncio
import json
from queue_manager import queue_manager

router = APIRouter()

import supabase_client as sc

@router.get("/{job_id}/status")
async def get_job_status(job_id: str, request: Request, token: str = None):
    # Retrieve token from Authorization header or query parameter
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
        
    job = await queue_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    # Check authorization if job has an owner
    payload = job.get("payload", {})
    owner_id = payload.get("user_id")
    if owner_id:
        if not token:
            raise HTTPException(status_code=401, detail="Authentication required to view this job")
        try:
            user_resp = await asyncio.to_thread(lambda: sc.supabase.auth.get_user(token))
            user_id = user_resp.user.id if user_resp and user_resp.user else None
            if user_id != owner_id:
                raise HTTPException(status_code=403, detail="Not authorized to view this job")
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid authentication token")
            
    # Strip payload and result unless complete
    response = {
        "id": job["id"],
        "status": job["status"],
        "error": job.get("error", "")
    }
    
    if job["status"] == "COMPLETE" and "result" in job:
        response["result"] = job["result"]
        
    return response

@router.get("/{job_id}/stream")
async def stream_job_status(job_id: str, request: Request, token: str = None):
    """
    SSE endpoint for frontend to subscribe to job status updates.
    """
    # Retrieve token from query parameter or header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
        
    async def event_generator():
        from redis_client import redis_client
        
        # Subscribe to pubsub FIRST to avoid race condition where job completes
        # between our initial check and our subscription
        pubsub = redis_client.pubsub()
        await pubsub.subscribe(f"job_updates:{job_id}")
        
        try:
            # Check initial state AFTER subscribing
            job = await queue_manager.get_job(job_id)
            if not job:
                yield "event: error\ndata: {\"error\": \"Error occurred\"}\n\n"
                return
                
            # Check authorization if job has an owner
            payload = job.get("payload", {})
            owner_id = payload.get("user_id")
            if owner_id:
                if not token:
                    yield "event: error\ndata: {\"error\": \"Error occurred\"}\n\n"
                    return
                try:
                    user_resp = await asyncio.to_thread(lambda: sc.supabase.auth.get_user(token))
                    user_id = user_resp.user.id if user_resp and user_resp.user else None
                    if user_id != owner_id:
                        yield "event: error\ndata: {\"error\": \"Error occurred\"}\n\n"
                        return
                except Exception:
                    yield "event: error\ndata: {\"error\": \"Error occurred\"}\n\n"
                    return
                
            yield f"event: status\ndata: {json.dumps({'status': job['status']})}\n\n"
            
            if job["status"] in ["COMPLETE", "FAILED"]:
                if job["status"] == "COMPLETE":
                    if "result" in job:
                        yield f"event: result\ndata: {job['result']}\n\n"
                    else:
                        yield f"event: error\ndata: {json.dumps({'error': 'Job completed but result payload is missing.'})}\n\n"
                elif job["status"] == "FAILED":
                    err_msg = job.get("error", "Job failed during processing.")
                    yield f"event: error\ndata: {json.dumps({'error': err_msg})}\n\n"
                await asyncio.sleep(0.5)  # Allow proxy to flush terminal chunk
                return
                
            while True:
                if await request.is_disconnected():
                    break
                    
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message:
                    data = json.loads(message["data"])
                    status = data.get("status")
                    error = data.get("error", "")
                    
                    yield f"event: status\ndata: {json.dumps({'status': status, 'error': error})}\n\n"
                    
                    if status == "COMPLETE":
                        # Fetch the final result
                        job = await queue_manager.get_job(job_id)
                        if job and "result" in job:
                            yield f"event: result\ndata: {job['result']}\n\n"
                        else:
                            yield f"event: error\ndata: {json.dumps({'error': 'Job completed but result payload is missing.'})}\n\n"
                        await asyncio.sleep(0.5)
                        break
                    elif status == "FAILED":
                        yield f"event: error\ndata: {json.dumps({'error': error or 'Job failed during processing.'})}\n\n"
                        await asyncio.sleep(0.5)
                        break
                else:
                    # Keepalive ping
                    yield ": ping\n\n"
        finally:

            await pubsub.unsubscribe(f"job_updates:{job_id}")
            await pubsub.close()

    return EventSourceResponse(event_generator(), headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"})
