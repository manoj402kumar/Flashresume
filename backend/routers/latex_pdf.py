from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from queue_manager import queue_manager
from rate_limiter import limiter

router = APIRouter()

class LatexRequest(BaseModel):
    latex_code: str

@router.post("/generate-pdf-latex")
@limiter.limit("5/minute")
async def generate_pdf_latex(request: Request, payload: LatexRequest):
    if not payload.latex_code or len(payload.latex_code.strip()) == 0:
        raise HTTPException(status_code=400, detail="Empty LaTeX code")
        
    import hashlib
    import uuid
    from redis_client import redis_client
    
    code_hash = hashlib.sha256(payload.latex_code.encode("utf-8")).hexdigest()
    idempotency_key = f"idempotency:latex:{code_hash}"
    
    existing_job = await redis_client.get(idempotency_key)
    if existing_job:
        return JSONResponse(status_code=202, content={"job_id": existing_job})
        
    job_id = str(uuid.uuid4())
    is_first = await redis_client.setnx(idempotency_key, job_id)
    if not is_first:
        existing_job = await redis_client.get(idempotency_key)
        return JSONResponse(status_code=202, content={"job_id": existing_job})
        
    await redis_client.setex(idempotency_key, 3600, job_id)
    
    try:
        await queue_manager.enqueue(
            job_type="compile_latex",
            payload={"latex_code": payload.latex_code},
            job_id=job_id
        )
        return JSONResponse(status_code=202, content={"job_id": job_id})
    except Exception as e:
        import logging; logging.error(f"Failed to enqueue LaTeX compilation: {str(e)}", exc_info=True); raise HTTPException(status_code=503, detail="Service temporarily unavailable. Could not connect to the job queue.")
