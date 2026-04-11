from services.pdf_parser import extract_with_pdfplumber

def extract_resume_text(pdf_bytes: bytes) -> dict:
    """
    Extract resume text using pdfplumber only.

    Returns:
        {
            "text": str,
            "page_count": int,
            "parser_used": "pdfplumber"
        }
    """
    plumber_text, page_count = extract_with_pdfplumber(pdf_bytes)
    
    return {
        "text": plumber_text if plumber_text else "Unable to extract text from PDF.",
        "page_count": page_count,
        "parser_used": "pdfplumber"
    }
