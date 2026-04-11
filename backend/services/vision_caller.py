import google.generativeai as genai
import os
from dotenv import load_dotenv
from prompts.extract_prompt import EXTRACT_PROMPT

# Load environment variables
load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

def extract_text_from_images(base64_images: list[str]) -> str:
    """
    Send resume page images to Gemini Vision, return extracted text.
    
    Args:
        base64_images: List of base64-encoded PNG images (one per page)
        
    Returns:
        Extracted plain text from all pages combined
    """
    model = genai.GenerativeModel("gemini-2.5-flash")
    
    # Build content parts: images first, then prompt
    parts = []
    for b64 in base64_images:
        parts.append({
            "inline_data": {
                "mime_type": "image/png",
                "data": b64
            }
        })
    parts.append(EXTRACT_PROMPT)
    
    # Generate content with all images + prompt
    response = model.generate_content(parts)
    
    return response.text.strip()
