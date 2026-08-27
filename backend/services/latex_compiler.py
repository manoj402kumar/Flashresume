import os
import subprocess
import tempfile
import asyncio

async def compile_latex_to_pdf(latex_code: str) -> bytes:
    """
    Compiles LaTeX code to PDF securely using pdflatex.
    Must be run in an environment with poppler/texlive installed.
    Uses -no-shell-escape for security.
    """
    # Create an isolated temporary directory
    with tempfile.TemporaryDirectory() as temp_dir:
        tex_path = os.path.join(temp_dir, "resume.tex")
        with open(tex_path, "w", encoding="utf-8") as f:
            f.write(latex_code)
            
        # Run pdflatex securely
        # Use -no-shell-escape and -interaction=nonstopmode
        # In a real Dockerized worker, we would use a read-only container with a tempfs mount for /tmp
        # and drop privileges to a non-root user (e.g. 'nobody')
        command = [
            "pdflatex",
            "-no-shell-escape",
            "-interaction=nonstopmode",
            "-halt-on-error",
            "-output-directory", temp_dir,
            tex_path
        ]
        
        try:
            # We use asyncio.create_subprocess_exec to bound execution time
            process = await asyncio.create_subprocess_exec(
                *command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                # In production with root permissions we would use preexec_fn to drop privileges:
                # preexec_fn=lambda: os.setuid(65534)
            )
            
            # 15 second timeout to prevent infinite compilation loops
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=15.0)
            
            if process.returncode != 0:
                raise RuntimeError(f"LaTeX compilation failed: {stdout.decode()} {stderr.decode()}")
                
            pdf_path = os.path.join(temp_dir, "resume.pdf")
            if not os.path.exists(pdf_path):
                raise FileNotFoundError("pdflatex succeeded but no PDF was generated.")
                
            with open(pdf_path, "rb") as f:
                return f.read()
                
        except asyncio.TimeoutError:
            process.kill()
            raise TimeoutError("LaTeX compilation timed out after 15 seconds.")
        # tempfile automatically cleans up the directory on exit
