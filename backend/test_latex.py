"""
Test script for LaTeX PDF generation
Run this to verify LaTeX compilation works
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from services.latex_compiler import latex_compiler, check_latex_installation

# Sample Template V1 data
sample_resume = {
    "template_id": "template_v1",
    "heading": {
        "name": "John Doe",
        "phone": "+1-234-567-8900",
        "email": "john.doe@example.com",
        "linkedin_url": "https://linkedin.com/in/johndoe"
    },
    "education": [
        {
            "institution": "University of Technology",
            "location": "San Francisco, CA",
            "degree": "Bachelor of Science in Computer Science",
            "duration": "Aug 2018 - May 2022"
        }
    ],
    "experience": [
        {
            "job_title": "Software Engineer",
            "duration": "Jun 2022 - Present",
            "company": "Tech Corp",
            "location": "San Francisco, CA",
            "bullets": [
                "Developed microservices architecture serving 1M+ users with 99.9% uptime",
                "Reduced API response time by 40% through optimization and caching strategies",
                "Led team of 3 engineers in building real-time analytics dashboard"
            ]
        }
    ],
    "projects": [
        {
            "title": "E-Commerce Platform",
            "tech_stack": "React, Node.js, MongoDB, AWS",
            "duration": "Jan 2023 - Mar 2023",
            "bullets": [
                "Built full-stack e-commerce platform with payment integration",
                "Implemented real-time inventory management system",
                "Achieved 95% test coverage with Jest and Cypress"
            ]
        }
    ],
    "technical_skills": {
        "languages": ["Python", "JavaScript", "TypeScript", "Java"],
        "frameworks": ["React", "Node.js", "FastAPI", "Django"],
        "databases": ["PostgreSQL", "MongoDB", "Redis"],
        "cloud_services": ["AWS", "Docker", "Kubernetes"],
        "developer_tools": ["Git", "VS Code", "Postman", "Jira"]
    },
    "achievements": [
        "Won Best Innovation Award at TechCon 2023",
        "Published research paper on distributed systems",
        "Mentored 5 junior developers"
    ],
    "changes": [],
    "ats_score_before": 75,
    "ats_score_after": 92
}


def test_latex_installation():
    """Test if LaTeX is installed"""
    print("=" * 60)
    print("Testing LaTeX Installation")
    print("=" * 60)
    
    is_installed = check_latex_installation()
    
    if is_installed:
        print("[OK] LaTeX is installed and available!")
        return True
    else:
        print("[ERROR] LaTeX is NOT installed")
        print("\nPlease install LaTeX:")
        print("  Windows: Download MiKTeX from https://miktex.org/download")
        print("  Linux:   sudo apt-get install texlive-latex-base")
        print("  macOS:   brew install --cask mactex")
        return False


def test_latex_generation():
    """Test LaTeX code generation"""
    print("\n" + "=" * 60)
    print("Testing LaTeX Code Generation")
    print("=" * 60)
    
    try:
        latex_code = latex_compiler.generate_latex_from_template(sample_resume)
        print("[OK] LaTeX code generated successfully!")
        print(f"   Length: {len(latex_code)} characters")
        
        # Show first few lines
        lines = latex_code.split('\n')[:10]
        print("\n   First 10 lines:")
        for line in lines:
            print(f"   {line}")
        
        return True
    except Exception as e:
        print(f"[ERROR] LaTeX generation failed: {str(e)}")
        return False


def test_pdf_compilation():
    """Test full PDF compilation"""
    print("\n" + "=" * 60)
    print("Testing PDF Compilation")
    print("=" * 60)
    
    try:
        pdf_bytes = latex_compiler.generate_pdf_from_json(sample_resume, "test_resume")
        
        if pdf_bytes:
            print("[OK] PDF compiled successfully!")
            print(f"   PDF size: {len(pdf_bytes)} bytes ({len(pdf_bytes) / 1024:.2f} KB)")
            
            # Save to file
            output_path = "test_resume.pdf"
            with open(output_path, 'wb') as f:
                f.write(pdf_bytes)
            
            print(f"   Saved to: {output_path}")
            print("\n   Open test_resume.pdf to verify the output!")
            return True
        else:
            print("[ERROR] PDF compilation failed - no output generated")
            return False
            
    except Exception as e:
        print(f"[ERROR] PDF compilation failed: {str(e)}")
        return False


def main():
    """Run all tests"""
    print("\nFlashResume LaTeX PDF Generation Test\n")
    
    # Test 1: LaTeX installation
    if not test_latex_installation():
        print("\nCannot proceed without LaTeX installation")
        return
    
    # Test 2: LaTeX code generation
    if not test_latex_generation():
        print("\nLaTeX generation failed")
        return
    
    # Test 3: PDF compilation
    if not test_pdf_compilation():
        print("\nPDF compilation failed")
        return
    
    # All tests passed
    print("\n" + "=" * 60)
    print("All Tests Passed!")
    print("=" * 60)
    print("\nLaTeX PDF generation is working correctly!")
    print("Backend is ready to generate professional PDFs")
    print("Check test_resume.pdf for the output\n")


if __name__ == "__main__":
    main()
