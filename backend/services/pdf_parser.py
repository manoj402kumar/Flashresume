import pdfplumber
import io
import gc
from typing import Tuple

def extract_with_pdfplumber(pdf_bytes: bytes) -> Tuple[str, int]:
    """
    Extract text from PDF using pdfplumber.
    Returns (extracted_text, page_count).
    """
    text_parts = []
    page_count = 0

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        page_count = len(pdf.pages)
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text.strip())

    gc.collect()

    full_text = "\n\n".join(text_parts)
    return full_text, page_count


def is_extraction_good(text: str) -> bool:
    """
    Quality check: decide if pdfplumber output is usable.
    Returns False if the text is too short or looks like garbled content.
    """
    if not text or len(text.strip()) < 200:
        return False

    # Check for garbled/encoding issues — real resumes won't have these
    garbage_indicators = ["????", "####", "\x00", "□□□", "▯▯▯"]
    for indicator in garbage_indicators:
        if indicator in text:
            return False

    return True
