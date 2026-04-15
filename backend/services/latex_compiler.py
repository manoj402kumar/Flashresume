"""
LaTeX PDF Compiler Service
Converts Template V1 JSON to LaTeX and compiles to PDF
"""

import os
import subprocess
import tempfile
import shutil
from pathlib import Path
from typing import Optional
import re


class LaTeXCompiler:
    """Compiles LaTeX templates to PDF"""
    
    def __init__(self):
        self.template_dir = Path(__file__).parent.parent / "templates"
        self.template_path = self.template_dir / "template_v1.tex"
        
    JUNK_URL_PATTERN = re.compile(
        r'^(linkedin profile|github link|linkedin|github|link|url|n/a|none|your.*(url|link|profile|username))$',
        re.IGNORECASE
    )

    def clean_display_url(self, val, fallback: str) -> str:
        """Strip junk LLM values and https:// prefix for clean display text."""
        if not val or self.JUNK_URL_PATTERN.match(str(val).strip()):
            return fallback
        return re.sub(r'^https?://', '', str(val)).rstrip('/')

    def escape_latex(self, text: str) -> str:
        """Escape special LaTeX characters"""
        if not text:
            return ""
        
        # LaTeX special characters that need escaping
        replacements = {
            '\\': r'\textbackslash{}',  # Backslash first!
            '&': r'\&',
            '%': r'\%',
            '$': r'\$',
            '#': r'\#',
            '_': r'\_',
            '{': r'\{',
            '}': r'\}',
            '~': r'\textasciitilde{}',
            '^': r'\^{}',
        }
        
        # Replace backslash first, then others
        text = text.replace('\\', '\\textbackslash{}')
        for char, replacement in replacements.items():
            if char != '\\':  # Skip backslash (already done)
                text = text.replace(char, replacement)
        
        return text
    
    def format_education_item(self, edu: dict) -> str:
        """Format a single education entry"""
        location = edu.get('location') or ''  # Handle None
        duration = edu.get('duration') or ''  # Handle None
        
        return f"""    \\resumeSubheading
      {{{self.escape_latex(edu.get('degree', ''))}}}
      {{{self.escape_latex(duration)}}}
      {{{self.escape_latex(edu.get('institution', ''))}}}
      {{{self.escape_latex(location)}}}"""
    
    def format_experience_item(self, exp: dict) -> str:
        """Format a single experience entry with bullets"""
        bullets = exp.get('bullets', [])
        bullets_latex = '\n'.join([
            f"      \\resumeItem{{{self.escape_latex(bullet)}}}"
            for bullet in bullets
        ])
        
        location = exp.get('location') or ''  # Handle None
        duration = exp.get('duration') or ''  # Handle None
        
        return f"""    \\resumeSubheading
      {{{self.escape_latex(exp.get('job_title', ''))}}}
      {{{self.escape_latex(duration)}}}
      {{{self.escape_latex(exp.get('company', ''))}}}
      {{{self.escape_latex(location)}}}
      \\resumeItemListStart
{bullets_latex}
      \\resumeItemListEnd"""
    
    def format_project_item(self, proj: dict) -> str:
        """Format a single project entry with bullets"""
        bullets = proj.get('bullets', [])
        bullets_latex = '\n'.join([
            f"      \\resumeItem{{{self.escape_latex(bullet)}}}"
            for bullet in bullets
        ])
        
        # Format: \resumeProjectHeading{\textbf{Title} $|$ \emph{Tech Stack}}{Link}
        title_and_tech = f"\\textbf{{{self.escape_latex(proj.get('title', ''))}}} $|$ \\emph{{{self.escape_latex(proj.get('tech_stack', ''))}}}"
        link = proj.get('link') or ''  # Handle None - can be live link or GitHub link
        
        return f"""    \\resumeProjectHeading
          {{{title_and_tech}}}{{{self.escape_latex(link)}}}
          \\resumeItemListStart
{bullets_latex}
          \\resumeItemListEnd"""
    
    def format_technical_skills(self, skills: dict) -> str:
        """Format technical skills section"""
        lines = []
        
        if skills.get('languages'):
            langs = ', '.join([self.escape_latex(s) for s in skills['languages']])
            lines.append(f"     \\textbf{{Languages}}{{: {langs}}} \\\\")
        
        if skills.get('frameworks'):
            frameworks = ', '.join([self.escape_latex(s) for s in skills['frameworks']])
            lines.append(f"     \\textbf{{Frameworks}}{{: {frameworks}}} \\\\")
        
        if skills.get('databases'):
            databases = ', '.join([self.escape_latex(s) for s in skills['databases']])
            lines.append(f"     \\textbf{{Databases}}{{: {databases}}} \\\\")
        
        if skills.get('cloud_services'):
            cloud = ', '.join([self.escape_latex(s) for s in skills['cloud_services']])
            lines.append(f"     \\textbf{{Cloud Services}}{{: {cloud}}} \\\\")
        
        if skills.get('developer_tools'):
            tools = ', '.join([self.escape_latex(s) for s in skills['developer_tools']])
            lines.append(f"     \\textbf{{Developer Tools}}{{: {tools}}}")
        
        return '\n'.join(lines)
    
    def format_summary(self, summary: Optional[str]) -> str:
        """Format summary section if exists"""
        if not summary:
            return ""
        
        return f"""\\section{{Summary}}
  \\begin{{itemize}}[leftmargin=0.15in, label={{}}]
    \\small{{\\item{{
      {self.escape_latex(summary)}
    }}}}
  \\end{{itemize}}"""
    
    def format_certifications_and_achievements(self, resume_data: dict) -> str:
        """
        Format certifications and achievements based on count.
        
        Logic:
        - If 2+ certifications: Separate "Certifications" and "Achievements" sections
        - If 1 certification: Single "Certifications & Achievements" section
        - If 0 certifications: Only "Achievements" section
        """
        certifications = resume_data.get('certifications', [])
        achievements = resume_data.get('achievements', [])
        certifications_and_achievements = resume_data.get('certifications_and_achievements', [])
        
        sections = []
        
        # Scenario 1: Merged section (1 certification)
        if certifications_and_achievements:
            bullets = '\n'.join([
                f"      \\resumeItem{{{self.escape_latex(item)}}}"
                for item in certifications_and_achievements
            ])
            sections.append(f"""\\section{{Certifications \\& Achievements}}
  \\resumeSubHeadingListStart
    \\item[]
    \\resumeItemListStart
{bullets}
    \\resumeItemListEnd
  \\resumeSubHeadingListEnd""")
        
        # Scenario 2: Separate sections (2+ certifications)
        elif certifications and len(certifications) >= 2:
            # Certifications section
            cert_bullets = '\n'.join([
                f"      \\resumeItem{{{self.escape_latex(cert)}}}"
                for cert in certifications
            ])
            sections.append(f"""\\section{{Certifications}}
  \\resumeSubHeadingListStart
    \\item[]
    \\resumeItemListStart
{cert_bullets}
    \\resumeItemListEnd
  \\resumeSubHeadingListEnd""")
            
            # Achievements section (if exists)
            if achievements:
                ach_bullets = '\n'.join([
                    f"      \\resumeItem{{{self.escape_latex(ach)}}}"
                    for ach in achievements
                ])
                sections.append(f"""\\section{{Achievements}}
  \\resumeSubHeadingListStart
    \\item[]
    \\resumeItemListStart
{ach_bullets}
    \\resumeItemListEnd
  \\resumeSubHeadingListEnd""")
        
        # Scenario 3: Only achievements (0 certifications)
        elif achievements:
            ach_bullets = '\n'.join([
                f"      \\resumeItem{{{self.escape_latex(ach)}}}"
                for ach in achievements
            ])
            sections.append(f"""\\section{{Achievements}}
  \\resumeSubHeadingListStart
    \\item[]
    \\resumeItemListStart
{ach_bullets}
    \\resumeItemListEnd
  \\resumeSubHeadingListEnd""")
        
        return '\n\n'.join(sections)
    
    def generate_latex_from_template(self, resume_data: dict) -> str:
        """Generate LaTeX code from Template V1 JSON"""
        
        # Debug: Print what we received
        print("\n=== DEBUG: Resume Data ===")
        print(f"Has summary: {bool(resume_data.get('summary'))}")
        print(f"Summary value: {resume_data.get('summary')}")
        print(f"Has certifications: {bool(resume_data.get('certifications'))}")
        print(f"Certifications: {resume_data.get('certifications')}")
        print(f"Has achievements: {bool(resume_data.get('achievements'))}")
        print(f"Achievements: {resume_data.get('achievements')}")
        print(f"Has certifications_and_achievements: {bool(resume_data.get('certifications_and_achievements'))}")
        print(f"Certifications & Achievements: {resume_data.get('certifications_and_achievements')}")
        print("=== END DEBUG ===")
        
        # Read template
        with open(self.template_path, 'r', encoding='utf-8') as f:
            template = f.read()
        
        # Extract data
        heading = resume_data.get('heading', {})
        summary = resume_data.get('summary')
        education = resume_data.get('education', [])
        experience = resume_data.get('experience', [])
        projects = resume_data.get('projects', [])
        technical_skills = resume_data.get('technical_skills', {})
        
        # Format sections
        summary_section = self.format_summary(summary)
        education_items = '\n'.join([self.format_education_item(edu) for edu in education])
        experience_items = '\n'.join([self.format_experience_item(exp) for exp in experience])
        project_items = '\n'.join([self.format_project_item(proj) for proj in projects])
        technical_skills_text = self.format_technical_skills(technical_skills)
        certifications_section = self.format_certifications_and_achievements(resume_data)
        
        # Replace placeholders
        latex_code = template.replace('{{NAME}}', self.escape_latex(heading.get('name', '')))
        latex_code = latex_code.replace('{{PHONE}}', self.escape_latex(heading.get('phone', '')))
        latex_code = latex_code.replace('{{EMAIL}}', heading.get('email', ''))  # Don't escape email
        
        # LinkedIn: use href field if present, else build from display text
        linkedin_display = self.clean_display_url(heading.get('linkedin_url'), 'linkedin.com/in/username')
        linkedin_href = heading.get('linkedin_url_href') or f'https://{linkedin_display}'
        print(f"LinkedIn display: {linkedin_display}, href: {linkedin_href}")
        latex_code = latex_code.replace('{{LINKEDIN_TEXT}}', self.escape_latex(linkedin_display))
        latex_code = latex_code.replace('{{LINKEDIN_HREF}}', linkedin_href)
        
        # GitHub: use href field if present, else build from display text
        github_display = self.clean_display_url(heading.get('github_url'), 'github.com/username')
        github_href = heading.get('github_url_href') or f'https://{github_display}'
        print(f"GitHub display: {github_display}, href: {github_href}")
        latex_code = latex_code.replace('{{GITHUB_TEXT}}', self.escape_latex(github_display))
        latex_code = latex_code.replace('{{GITHUB_HREF}}', github_href)
        
        latex_code = latex_code.replace('{{SUMMARY_SECTION}}', summary_section)
        latex_code = latex_code.replace('{{EDUCATION_ITEMS}}', education_items)
        latex_code = latex_code.replace('{{EXPERIENCE_ITEMS}}', experience_items)
        latex_code = latex_code.replace('{{PROJECT_ITEMS}}', project_items)
        latex_code = latex_code.replace('{{TECHNICAL_SKILLS}}', technical_skills_text)
        latex_code = latex_code.replace('{{CERTIFICATIONS_SECTION}}', certifications_section)
        
        return latex_code
    
    def compile_latex_to_pdf(self, latex_code: str, output_filename: str = "resume") -> Optional[bytes]:
        """
        Compile LaTeX code to PDF
        Returns PDF bytes or None if compilation fails
        """
        
        # Create temporary directory
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            # Write LaTeX file
            tex_file = temp_path / f"{output_filename}.tex"
            with open(tex_file, 'w', encoding='utf-8') as f:
                f.write(latex_code)
            
            try:
                # Compile LaTeX to PDF using pdflatex
                # Run twice to resolve references
                for run_num in range(2):
                    print(f"Running pdflatex (pass {run_num + 1}/2)...")
                    result = subprocess.run(
                        ['pdflatex', '-interaction=nonstopmode', '-output-directory', str(temp_path), str(tex_file)],
                        capture_output=True,
                        text=True,
                        timeout=120  # Increased to 120 seconds for first-time package downloads
                    )
                    
                    if result.returncode != 0:
                        print(f"LaTeX compilation error (pass {run_num + 1}):")
                        print(result.stdout[-1000:] if len(result.stdout) > 1000 else result.stdout)
                        if result.stderr:
                            print("STDERR:", result.stderr)
                        if run_num == 1:  # Only fail on second pass
                            return None
                
                # Read generated PDF
                pdf_file = temp_path / f"{output_filename}.pdf"
                if pdf_file.exists():
                    with open(pdf_file, 'rb') as f:
                        pdf_bytes = f.read()
                    print(f"PDF generated successfully: {len(pdf_bytes)} bytes")
                    return pdf_bytes
                else:
                    print("PDF file not generated")
                    return None
                    
            except subprocess.TimeoutExpired:
                print("LaTeX compilation timed out (120s). MiKTeX may be downloading packages.")
                print("Please open MiKTeX Console and install missing packages manually.")
                return None
            except FileNotFoundError:
                print("pdflatex not found. Please install LaTeX (texlive or miktex)")
                return None
            except Exception as e:
                print(f"LaTeX compilation failed: {str(e)}")
                return None
    
    def generate_pdf_from_json(self, resume_data: dict, output_filename: str = "resume") -> Optional[bytes]:
        """
        Complete pipeline: JSON -> LaTeX -> PDF
        Returns PDF bytes or None if fails
        """
        
        # Generate LaTeX code
        latex_code = self.generate_latex_from_template(resume_data)
        
        # Compile to PDF
        pdf_bytes = self.compile_latex_to_pdf(latex_code, output_filename)
        
        return pdf_bytes


# Singleton instance
latex_compiler = LaTeXCompiler()


def check_latex_installation() -> bool:
    """Check if LaTeX is installed on the system"""
    try:
        result = subprocess.run(['pdflatex', '--version'], capture_output=True, timeout=5)
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False
