from fastapi import APIRouter, UploadFile, File, HTTPException, Request
import asyncio
from services.parse_orchestrator import extract_resume_text, extract_from_docx
from models.response_models import ParseResponse, ExtractedLinks
from rate_limiter import limiter

MAX_FILE_BYTES = 5 * 1024 * 1024  # 5 MB hard cap

router = APIRouter()

# Limit concurrent heavy parsing tasks to prevent Out of Memory (OOM) on small servers
parse_semaphore = asyncio.Semaphore(2)

@router.post("/parse", response_model=ParseResponse)
@limiter.limit("10/minute")
async def parse_resume(request: Request, file: UploadFile = File(...)):
    """
    Parse resume from multiple formats: PDF, DOCX.

    Supported formats:
    - PDF: 2-layer pipeline (pypdfium2 → pdfplumber) + hyperlink annotation extraction
    - DOCX: Direct text extraction (no hyperlink extraction)

    Args:
        file: Resume file upload

    Returns:
        ParseResponse with extracted text, page count, parser used,
        and extracted_links (LinkedIn/GitHub/portfolio/all URLs from PDF annotations).
    """
    filename = file.filename.lower()

    # Validate file type
    allowed_extensions = [".pdf", ".docx"]
    if not any(filename.endswith(ext) for ext in allowed_extensions):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}"
        )

    # Read at most MAX_FILE_BYTES + 1 bytes
    file_bytes = await file.read(MAX_FILE_BYTES + 1)

    if len(file_bytes) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum is 5 MB.")

    # Guard against empty files
    if len(file_bytes) < 100:
        raise HTTPException(status_code=400, detail="File appears empty or corrupted.")

    try:
        # Route to appropriate parser based on file type
        async with parse_semaphore:
            if filename.endswith(".pdf"):
                # PDF: Use 2-layer pipeline offloaded to a thread
                result = await asyncio.to_thread(extract_resume_text, file_bytes)

            elif filename.endswith(".docx"):
                # DOCX: Direct extraction
                result = await asyncio.to_thread(extract_from_docx, file_bytes)

        # Final validation
        if not result["text"] or len(result["text"].strip()) < 50:
            raise HTTPException(
                status_code=422,
                detail="Could not extract readable text. Please ensure the file contains text content."
            )

        # Build ExtractedLinks from the raw dict returned by the orchestrator
        links_raw = result.get("extracted_links", {}) or {}
        extracted_links = ExtractedLinks(
            all_urls  = links_raw.get("all_urls", []),
        )

        return ParseResponse(
            resume_text     = result["text"],
            page_count      = result["page_count"],
            parser_used     = result["parser_used"],
            extracted_links = extracted_links,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")
