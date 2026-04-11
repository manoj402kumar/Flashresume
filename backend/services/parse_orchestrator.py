import os
import platform
import io
import fitz  # PyMuPDF
import pytesseract
from PIL import Image
from docx import Document
from services.pdf_parser import extract_with_pdfplumber, is_extraction_good
from services.vision_fallback import extract_with_gemini_vision

# Configure Tesseract path for Windows
if platform.system() == "Windows":
    pytesseract.pytesseract.tesseract_cmd = os.getenv(
        "TESSERACT_PATH", r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    )


def extract_from_image(image_bytes: bytes) -> dict:
    """Extract text from JPG/PNG using Tesseract OCR."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        text = pytesseract.image_to_string(img, lang='eng').strip()
        return {
            "text": text if text else "Unable to extract text from image.",
            "page_count": 1,
            "parser_used": "tesseract_image"
        }
    except Exception as e:
        raise Exception(f"Image OCR failed: {str(e)}")


def extract_from_docx(docx_bytes: bytes) -> dict:
    """Extract text from DOCX file."""
    try:
        doc = Document(io.BytesIO(docx_bytes))
        paragraphs = [para.text.strip() for para in doc.paragraphs if para.text.strip()]
        text = '\n\n'.join(paragraphs)
        return {
            "text": text if text else "Unable to extract text from DOCX.",
            "page_count": 1,
            "parser_used": "python-docx"
        }
    except Exception as e:
        raise Exception(f"DOCX extraction failed: {str(e)}")


def extract_with_pymupdf(pdf_bytes: bytes) -> tuple[str, int]:
    """Layer 2: PyMuPDF — handles Canva/vector/complex layout PDFs."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page_count = len(doc)
    text_parts = [page.get_text("text").strip() for page in doc]
    doc.close()
    return "\n\n".join(text_parts), page_count


def extract_with_pymupdf_ocr(pdf_bytes: bytes) -> tuple[str, int]:
    """Layer 3: PyMuPDF + Tesseract — per-page OCR for scanned PDFs."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page_count = len(doc)
    text_parts = []

    for page_num, page in enumerate(doc):
        page_text = page.get_text("text").strip()

        # Only OCR if this specific page has no readable text
        if len(page_text) < 50:
            print(f"Page {page_num + 1} appears scanned, using OCR...")
            pix = page.get_pixmap(dpi=300)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            page_text = pytesseract.image_to_string(img, lang="eng").strip()

        text_parts.append(page_text)

    doc.close()
    return "\n\n".join(text_parts), page_count


def extract_resume_text(pdf_bytes: bytes) -> dict:
    """
    4-layer orchestrator:
    Layer 1: pdfplumber (fast, standard text PDFs)
    Layer 2: PyMuPDF (Canva/vector/complex layouts)
    Layer 3: PyMuPDF + Tesseract (scanned/image PDFs)
    Layer 4: Gemini Vision (nuclear option for worst cases)
    """
    # Layer 1 — pdfplumber (fast, zero deps)
    text, page_count = extract_with_pdfplumber(pdf_bytes)
    if is_extraction_good(text):
        print("✅ Layer 1 (pdfplumber) succeeded")
        return {"text": text, "page_count": page_count, "parser_used": "pdfplumber"}

    # Layer 2 — PyMuPDF (Canva/vector/complex layout)
    print("⚠️ Layer 1 failed → trying Layer 2 (PyMuPDF)...")
    text, page_count = extract_with_pymupdf(pdf_bytes)
    if is_extraction_good(text):
        print("✅ Layer 2 (PyMuPDF) succeeded")
        return {"text": text, "page_count": page_count, "parser_used": "pymupdf"}

    # Layer 3 — PyMuPDF + Tesseract OCR (scanned/image PDFs)
    print("⚠️ Layer 2 failed → trying Layer 3 (PyMuPDF + Tesseract OCR)...")
    text, page_count = extract_with_pymupdf_ocr(pdf_bytes)
    if is_extraction_good(text):
        print("✅ Layer 3 (PyMuPDF + Tesseract) succeeded")
        return {"text": text, "page_count": page_count, "parser_used": "pymupdf_tesseract"}

    # Layer 4 — Gemini Vision (nuclear option)
    print("⚠️ Layer 3 failed → triggering Layer 4 (Gemini Vision fallback)...")
    text = extract_with_gemini_vision(pdf_bytes)
    print("✅ Layer 4 (Gemini Vision) succeeded")
    return {"text": text, "page_count": page_count, "parser_used": "gemini_vision"}
