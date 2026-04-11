"""
LaTeX PDF Generation Router
Endpoint to generate PDF from Template V1 JSON using LaTeX
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
from services.latex_compiler import latex_compiler, check_latex_installation

router = APIRouter()


class GeneratePDFRequest(BaseModel):
    """Request model for PDF generation"""
    resume_data: dict
    filename: Optional[str] = "resume"


@router.post("/api/generate-pdf-latex")
async def generate_pdf_latex(request: GeneratePDFRequest):
    """
    Generate PDF from Template V1 JSON using LaTeX compilation
    
    Returns PDF file as binary response
    """
    
    # Check if LaTeX is installed
    if not check_latex_installation():
        raise HTTPException(
            status_code=500,
            detail="LaTeX is not installed on the server. Please install texlive or miktex."
        )
    
    try:
        # Generate PDF from JSON
        pdf_bytes = latex_compiler.generate_pdf_from_json(
            resume_data=request.resume_data,
            output_filename=request.filename
        )
        
        if pdf_bytes is None:
            raise HTTPException(
                status_code=500,
                detail="PDF generation failed. Check LaTeX template and data format."
            )
        
        # Return PDF as binary response
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={request.filename}.pdf"
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"PDF generation error: {str(e)}"
        )


@router.get("/api/check-latex")
async def check_latex():
    """
    Check if LaTeX is installed and available
    """
    is_installed = check_latex_installation()
    
    return {
        "latex_installed": is_installed,
        "message": "LaTeX is available" if is_installed else "LaTeX is not installed"
    }


@router.post("/api/preview-latex")
async def preview_latex(request: GeneratePDFRequest):
    """
    Generate LaTeX code preview without compiling to PDF
    Useful for debugging
    """
    
    try:
        latex_code = latex_compiler.generate_latex_from_template(request.resume_data)
        
        return {
            "latex_code": latex_code,
            "message": "LaTeX code generated successfully"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"LaTeX generation error: {str(e)}"
        )
