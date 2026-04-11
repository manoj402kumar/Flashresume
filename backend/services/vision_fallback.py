import google.generativeai as genai
import os
import base64
import io
import platform
from pdf2image import convert_from_bytes
from dotenv import load_dotenv
from prompts.extract_prompt import EXTRACT_PROMPT

# Load environment variables
load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Set poppler path - environment-aware for cross-platform compatibility
if platform.system() == "Windows":
    POPPLER_PATH = os.getenv("POPPLER_PATH", r"C:\Program Files\poppler\bin")
else:
    POPPLER_PATH = None  # Linux/Mac use system PATH after apt-get install poppler-utils

def pdf_to_base64_images(pdf_bytes: bytes) -> list[str]:
    """Convert all PDF pages to base64 PNG strings at 200 DPI."""
    # Only pass poppler_path on Windows
    kwargs = {"dpi": 200}
    if POPPLER_PATH:
        kwargs["poppler_path"] = POPPLER_PATH
    
    images = convert_from_bytes(pdf_bytes, **kwargs)
    result = []
    for img in images:
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        result.append(base64.b64encode(buffer.getvalue()).decode("utf-8"))
    return result

def extract_with_gemini_vision(pdf_bytes: bytes) -> str:
    """
    Fallback: send resume PDF pages as images to Gemini Vision.
    Used only when pdfplumber fails quality check.
    """
    base64_images = pdf_to_base64_images(pdf_bytes)
    model = genai.GenerativeModel("gemini-2.5-flash")

    parts = []
    for b64 in base64_images:
        parts.append({
            "inline_data": {
                "mime_type": "image/png",
                "data": b64
            }
        })
    parts.append(EXTRACT_PROMPT)

    response = model.generate_content(parts)
    return response.text.strip()
