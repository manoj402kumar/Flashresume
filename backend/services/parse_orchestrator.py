from services.pdf_parser import extract_with_pdfplumber, is_extraction_good
from services.vision_fallback import extract_with_gemini_vision

def extract_resume_text(pdf_bytes: bytes) -> dict:
    """
    Orchestrator: try pdfplumber first, fall back to Gemini Vision if needed.

    Returns:
        {
            "text": str,
            "page_count": int,
            "parser_used": "pdfplumber" | "gemini_vision"
        }
    """
    # Attempt 1: pdfplumber (fast, free, no API call)
    plumber_text, page_count = extract_with_pdfplumber(pdf_bytes)

    if is_extraction_good(plumber_text):
        return {
            "text": plumber_text,
            "page_count": page_count,
            "parser_used": "pdfplumber"
        }

    # Attempt 2: Gemini Vision fallback
    print(f"pdfplumber returned poor output ({len(plumber_text)} chars). Triggering Vision fallback.")
    vision_text = extract_with_gemini_vision(pdf_bytes)

    return {
        "text": vision_text,
        "page_count": page_count,
        "parser_used": "gemini_vision"
    }
