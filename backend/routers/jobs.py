from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import EventSourceResponse
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

@router.post("/{job_id}/stream-ticket")
async def create_stream_ticket(job_id: str, request: Request, token: str = None):
    """
    Exchanges a valid JWT for a short-lived, single-use SSE ticket.
    Prevents JWTs from appearing in EventSource URLs and server logs.
    """
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
        
    user_id = get_authenticated_user_id(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
        
    job = await queue_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    payload = job.get("payload", {})
    owner_id = job.get("user_id") or (payload.get("user_id") if isinstance(payload, dict) else None)
    if owner_id and user_id != owner_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this job")
        
    import uuid
    ticket = str(uuid.uuid4())
    from redis_client import redis_client
    
    # Store ticket with 60s TTL
    ticket_key = f"sse_ticket:{ticket}"
    ticket_data = json.dumps({"user_id": user_id, "job_id": job_id})
    await redis_client.set(ticket_key, ticket_data, ex=60)
    
    from fastapi.responses import JSONResponse
    return JSONResponse(
        content={"ticket": ticket},
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"}
    )

@router.get("/{job_id}/stream")
async def stream_job_status(job_id: str, request: Request, ticket: str = None):
    if not ticket:
        raise HTTPException(status_code=401, detail="Missing SSE ticket")
        
    from redis_client import redis_client
    
    # Atomically consume the ticket (Redis 6.2+ GETDEL)
    # GETDEL guarantees the ticket is single-use and consumed instantly
    ticket_key = f"sse_ticket:{ticket}"
    ticket_data_raw = await redis_client.execute_command("GETDEL", ticket_key)
    
    if not ticket_data_raw:
        raise HTTPException(status_code=401, detail="Invalid or expired SSE ticket")
        
    ticket_data = json.loads(ticket_data_raw)
    if ticket_data.get("job_id") != job_id:
        raise HTTPException(status_code=403, detail="Ticket is not bound to this job")
        
    # User ID from ticket is authoritative
    ticket_user_id = ticket_data.get("user_id")

    async def event_generator(ticket_user_id_val=ticket_user_id):
        from redis_client import redis_client
        pubsub = redis_client.pubsub()
        
        try:
            # 1. Subscribe to Pub/Sub BEFORE checking job state to avoid race condition
            await pubsub.subscribe(f"job_updates:{job_id}")

            # 2. Reconcile current state (durable)
            job = await queue_manager.get_job(job_id)
            if not job:
                yield 'event: error\ndata: {"error": "Job not found"}\n\n'
                return
                
            payload = job.get("payload", {})
            owner_id = job.get("user_id") or (payload.get("user_id") if isinstance(payload, dict) else None)
            if owner_id and ticket_user_id_val != owner_id:
                yield 'event: error\ndata: {"error": "Not authorized to view this job"}\n\n'
                return
                
            yield f'event: status\ndata: {json.dumps({"status": job["status"]})}\n\n'
            
            if job["status"] in ["COMPLETE", "FAILED"]:
                if job["status"] == "COMPLETE":
                    if "result" in job:
                        res_str = json.dumps(job["result"]) if isinstance(job["result"], dict) else str(job["result"])
                        yield f'event: result\ndata: {res_str}\n\n'
                    else:
                        yield 'event: error\ndata: {"error": "Job completed but result payload is missing."}\n\n'
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
                    
                    yield f'event: status\ndata: {json.dumps({"status": status, "error": error})}\n\n'
                    
                    if status == "COMPLETE":
                        job = await queue_manager.get_job(job_id)
                        if job and "result" in job:
                            res_str = json.dumps(job["result"]) if isinstance(job["result"], dict) else str(job["result"])
                            yield f'event: result\ndata: {res_str}\n\n'
                        else:
                            yield 'event: error\ndata: {"error": "Job completed but result payload is missing."}\n\n'
                        await asyncio.sleep(0.5)
                        break
                    elif status == "FAILED":
                        yield f'event: error\ndata: {json.dumps({"error": error or "Job failed during processing."})}\n\n'
                        await asyncio.sleep(0.5)
                        break
                else:
                    yield ': ping\n\n'
        finally:
            await pubsub.unsubscribe(f"job_updates:{job_id}")
            await pubsub.close()

    return EventSourceResponse(event_generator(), headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"})
