from fastapi import APIRouter, UploadFile, File, HTTPException
from services.parse_orchestrator import extract_resume_text
from models.response_models import ParseResponse

router = APIRouter()

@router.post("/parse", response_model=ParseResponse)
async def parse_resume(file: UploadFile = File(...)):
    """
    Parse a PDF resume and extract all text.
    Uses pdfplumber first, falls back to Gemini Vision if needed.
    
    Args:
        file: PDF file upload
        
    Returns:
        ParseResponse with extracted text, page count, and parser used
    """
    # Validate file type
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")
    
    # Read PDF bytes
    pdf_bytes = await file.read()
    
    # Guard against empty or corrupted files
    if len(pdf_bytes) < 1000:
        raise HTTPException(status_code=400, detail="File appears empty or corrupted.")
    
    try:
        # Run parse orchestrator (pdfplumber → Vision fallback)
        result = extract_resume_text(pdf_bytes)
        
        # Final validation
        if not result["text"] or len(result["text"].strip()) < 50:
            raise HTTPException(
                status_code=422,
                detail="Could not extract readable text from this PDF. Please try a different file."
            )
        
        return ParseResponse(
            resume_text=result["text"],
            page_count=result["page_count"],
            parser_used=result["parser_used"]
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")
