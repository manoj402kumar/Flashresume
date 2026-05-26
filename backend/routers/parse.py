from fastapi import APIRouter, UploadFile, File, HTTPException, Request
import asyncio
from services.parse_orchestrator import extract_resume_text, extract_from_image, extract_from_docx
from models.response_models import ParseResponse
from rate_limiter import limiter

MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB hard cap

router = APIRouter()

@router.post("/parse", response_model=ParseResponse)
@limiter.limit("10/minute")
async def parse_resume(request: Request, file: UploadFile = File(...)):
    """
    Parse resume from multiple formats: PDF, DOCX, JPG, PNG.
    
    Supported formats:
    - PDF: 4-layer pipeline (pdfplumber → PyMuPDF → Tesseract → Gemini Vision)
    - DOCX: Direct text extraction
    - JPG/PNG: Tesseract OCR
    
    Args:
        file: Resume file upload
        
    Returns:
        ParseResponse with extracted text, page count, and parser used
    """
    filename = file.filename.lower()
    
    # Validate file type
    allowed_extensions = [".pdf", ".docx", ".jpg", ".jpeg", ".png"]
    if not any(filename.endswith(ext) for ext in allowed_extensions):
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}"
        )
    
    # Read at most MAX_FILE_BYTES + 1 bytes
    file_bytes = await file.read(MAX_FILE_BYTES + 1)
    
    if len(file_bytes) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum is 10 MB.")
    
    # Guard against empty files
    if len(file_bytes) < 100:
        raise HTTPException(status_code=400, detail="File appears empty or corrupted.")
    
    try:
        # Route to appropriate parser based on file type
        if filename.endswith(".pdf"):
            # PDF: Use 4-layer pipeline offloaded to a thread
            result = await asyncio.to_thread(extract_resume_text, file_bytes)
        
        elif filename.endswith(".docx"):
            # DOCX: Direct extraction
            result = await asyncio.to_thread(extract_from_docx, file_bytes)
        
        elif filename.endswith((".jpg", ".jpeg", ".png")):
            # Image: Tesseract OCR offloaded to a thread
            result = await asyncio.to_thread(extract_from_image, file_bytes)
        
        # Final validation
        if not result["text"] or len(result["text"].strip()) < 50:
            raise HTTPException(
                status_code=422,
                detail="Could not extract readable text. Please ensure the file contains text content."
            )
        
        return ParseResponse(
            resume_text=result["text"],
            page_count=result["page_count"],
            parser_used=result["parser_used"]
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")
