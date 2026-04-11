import google.generativeai as genai
import os
import base64
import io
from pdf2image import convert_from_bytes
from dotenv import load_dotenv
from prompts.extract_prompt import EXTRACT_PROMPT

# Load environment variables
load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Set poppler path for Windows
POPPLER_PATH = r"C:\Users\mummi\Downloads\Release-25.12.0-0\poppler-25.12.0\Library\bin"

def pdf_to_base64_images(pdf_bytes: bytes) -> list[str]:
    """Convert all PDF pages to base64 PNG strings at 200 DPI."""
    images = convert_from_bytes(pdf_bytes, dpi=200, poppler_path=POPPLER_PATH)
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
