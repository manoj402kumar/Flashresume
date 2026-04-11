# MiKTeX Package Installation Guide

## Issue: LaTeX Compilation Timeout

If you're getting timeout errors, it's because MiKTeX is downloading packages in the background for the first time.

---

## Solution: Install Packages Manually

### Method 1: Enable Auto-Install (Easiest)

1. **Open MiKTeX Console**
   - Search Windows for "MiKTeX Console"
   - Or find it in Start Menu → MiKTeX

2. **Go to Settings**
   - Click "Settings" in the left sidebar
   - Click "General" tab

3. **Enable Auto-Install**
   - Find "Install missing packages on-the-fly"
   - Change from "Ask me first" to **"Always"**
   - Click "OK"

4. **Try Again**
   ```bash
   cd backend
   python test_latex.py
   ```

---

### Method 2: Install Packages Manually

If auto-install doesn't work, install packages manually:

1. **Open MiKTeX Console**

2. **Go to Packages**
   - Click "Packages" in the left sidebar

3. **Install These Packages** (search and install each):
   - `fontawesome5`
   - `titlesec`
   - `enumitem`
   - `hyperref`
   - `babel`
   - `tabularx`
   - `geometry`
   - `fancyhdr`
   - `marvosym`
   - `latexsym`

4. **How to Install**:
   - Type package name in search box
   - Click on the package
   - Click "+" button or "Install" button
   - Wait for installation to complete

5. **Try Again**
   ```bash
   cd backend
   python test_latex.py
   ```

---

### Method 3: Update MiKTeX

Sometimes updating MiKTeX fixes package issues:

1. **Open MiKTeX Console**

2. **Click "Updates"** in left sidebar

3. **Click "Check for updates"**

4. **Click "Update now"** if updates are available

5. **Wait for updates to complete**

6. **Try again**

---

## Quick Test

After installing packages, test with:

```bash
cd backend
python test_latex.py
```

**Expected Output:**
```
[OK] LaTeX is installed and available!
[OK] LaTeX code generated successfully!
Running pdflatex (pass 1/2)...
Running pdflatex (pass 2/2)...
PDF generated successfully: XXXXX bytes
[OK] PDF compiled successfully!
```

This creates `test_resume.pdf` - open it to verify!

---

## Still Having Issues?

### Check MiKTeX Console Logs

1. Open MiKTeX Console
2. Click "Diagnose" in left sidebar
3. Look for errors or warnings
4. Follow suggested fixes

### Try Simple Test

Create a simple test file to verify LaTeX works:

1. Create `simple.tex`:
```latex
\documentclass{article}
\begin{document}
Hello World!
\end{document}
```

2. Compile:
```bash
pdflatex simple.tex
```

3. If this works, the issue is with specific packages

---

## Alternative: Use Docker

If MiKTeX continues to have issues, you can use Docker with TeX Live:

```dockerfile
FROM python:3.11-slim

# Install TeX Live
RUN apt-get update && apt-get install -y \
    texlive-latex-base \
    texlive-fonts-recommended \
    texlive-latex-extra \
    && rm -rf /var/lib/apt/lists/*

# Rest of your Dockerfile...
```

This gives you a clean LaTeX environment without Windows-specific issues.

---

## Success!

Once `python test_latex.py` creates `test_resume.pdf`, you're ready to use LaTeX PDF generation in FlashResume!

Your Jake Gutierrez template will generate beautiful professional PDFs! 🎉
