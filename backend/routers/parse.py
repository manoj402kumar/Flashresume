from fastapi import APIRouter, UploadFile, File, HTTPException
from services.parse_orchestrator import extract_resume_text, extract_from_image, extract_from_docx
from models.response_models import ParseResponse

router = APIRouter()

@router.post("/parse", response_model=ParseResponse)
def parse_resume(file: UploadFile = File(...)):
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
    
    # Read file bytes
    file_bytes = file.file.read()
    
    # Guard against empty files
    if len(file_bytes) < 100:
        raise HTTPException(status_code=400, detail="File appears empty or corrupted.")
    
    try:
        # Route to appropriate parser based on file type
        if filename.endswith(".pdf"):
            # PDF: Use 4-layer pipeline
            result = extract_resume_text(file_bytes)
        
        elif filename.endswith(".docx"):
            # DOCX: Direct extraction
            result = extract_from_docx(file_bytes)
        
        elif filename.endswith((".jpg", ".jpeg", ".png")):
            # Image: Tesseract OCR
            result = extract_from_image(file_bytes)
        
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
