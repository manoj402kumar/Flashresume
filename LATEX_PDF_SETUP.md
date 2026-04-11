# LaTeX PDF Generation - Installation & Setup Guide

## 🎯 Overview

FlashResume now supports **professional LaTeX-based PDF generation** for Template V1. This provides:
- ✅ Professional typesetting quality
- ✅ ATS-optimized formatting
- ✅ Consistent rendering across all platforms
- ✅ Better font handling and spacing

---

## 📦 Installation Steps

### **Windows Installation**

#### Option 1: MiKTeX (Recommended for Windows)

1. **Download MiKTeX:**
   - Visit: https://miktex.org/download
   - Download the installer (64-bit recommended)

2. **Install MiKTeX:**
   ```bash
   # Run the installer
   # Choose "Install for all users" or "Install for current user"
   # Select installation directory (default is fine)
   ```

3. **Configure MiKTeX:**
   - Open MiKTeX Console
   - Go to "Settings" → "General"
   - Set "Install missing packages" to "Always" (automatic)

4. **Verify Installation:**
   ```bash
   pdflatex --version
   ```
   Should output: `MiKTeX-pdfTeX 4.x.x`

#### Option 2: TeX Live (Alternative)

1. **Download TeX Live:**
   - Visit: https://tug.org/texlive/acquire-netinstall.html
   - Download `install-tl-windows.exe`

2. **Install:**
   ```bash
   # Run installer
   # Choose "Full installation" (3-4 GB)
   # Wait 30-60 minutes for installation
   ```

3. **Verify:**
   ```bash
   pdflatex --version
   ```

---

### **Linux Installation**

#### Ubuntu/Debian:
```bash
sudo apt-get update
sudo apt-get install texlive-latex-base texlive-fonts-recommended texlive-latex-extra
```

#### Fedora/RHEL:
```bash
sudo dnf install texlive-scheme-basic texlive-collection-fontsrecommended
```

#### Arch Linux:
```bash
sudo pacman -S texlive-core texlive-latexextra
```

---

### **macOS Installation**

#### Using Homebrew:
```bash
brew install --cask mactex
```

#### Manual Installation:
1. Download MacTeX from: https://tug.org/mactex/
2. Run the installer (3-4 GB download)
3. Verify: `pdflatex --version`

---

## 🚀 Backend Setup

### 1. No Additional Python Packages Required!

The LaTeX compiler uses only standard Python libraries:
- `subprocess` (built-in)
- `tempfile` (built-in)
- `pathlib` (built-in)

### 2. Verify LaTeX Installation

Start your backend and test:

```bash
cd backend
uvicorn main:app --reload
```

Then test the endpoint:

```bash
curl http://localhost:8000/api/check-latex
```

**Expected Response:**
```json
{
  "latex_installed": true,
  "message": "LaTeX is available"
}
```

---

## 🎨 How It Works

### Architecture Flow:

```
Template V1 JSON
      ↓
LaTeX Compiler Service
      ↓
Generate LaTeX Code (.tex)
      ↓
pdflatex Compilation
      ↓
Professional PDF Output
```

### File Structure:

```
backend/
├── services/
│   └── latex_compiler.py      # LaTeX compilation logic
├── routers/
│   └── latex_pdf.py            # API endpoints
└── templates/
    └── template_v1.tex         # LaTeX template
```

---

## 🔧 API Endpoints

### 1. Generate PDF (Main Endpoint)

**POST** `/api/generate-pdf-latex`

**Request:**
```json
{
  "resume_data": {
    "template_id": "template_v1",
    "heading": {
      "name": "John Doe",
      "phone": "+1-234-567-8900",
      "email": "john@example.com",
      "linkedin_url": "https://linkedin.com/in/johndoe"
    },
    "education": [...],
    "experience": [...],
    "projects": [...],
    "technical_skills": {...},
    "achievements": [...]
  },
  "filename": "John_Doe_Resume"
}
```

**Response:**
- Binary PDF file
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename=John_Doe_Resume.pdf`

---

### 2. Check LaTeX Installation

**GET** `/api/check-latex`

**Response:**
```json
{
  "latex_installed": true,
  "message": "LaTeX is available"
}
```

---

### 3. Preview LaTeX Code (Debug)

**POST** `/api/preview-latex`

**Request:** Same as generate-pdf-latex

**Response:**
```json
{
  "latex_code": "\\documentclass[letterpaper,11pt]{article}...",
  "message": "LaTeX code generated successfully"
}
```

---

## 🎯 Frontend Integration

The frontend automatically tries LaTeX PDF generation first, then falls back to React-PDF if LaTeX is not available.

**In `result/page.tsx`:**

```typescript
const handleDownloadPDF = async () => {
  // Try LaTeX first (better quality)
  try {
    const response = await fetch('http://localhost:8000/api/generate-pdf-latex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resume_data: resume,
        filename: resume.heading.name.replace(/\s+/g, '_')
      })
    });
    
    if (response.ok) {
      // Download LaTeX-generated PDF
      const blob = await response.blob();
      // ... download logic
      return;
    }
  } catch (error) {
    console.log('LaTeX failed, using React-PDF fallback');
  }
  
  // Fallback to React-PDF
  const blob = await pdf(<ResumePDF resume={resume} />).toBlob();
  // ... download logic
};
```

---

## 🧪 Testing

### 1. Test LaTeX Installation

```bash
# Windows
pdflatex --version

# Should show: MiKTeX-pdfTeX or TeX Live
```

### 2. Test Backend Endpoint

```bash
# Check if LaTeX is available
curl http://localhost:8000/api/check-latex

# Test PDF generation (with sample data)
curl -X POST http://localhost:8000/api/generate-pdf-latex \
  -H "Content-Type: application/json" \
  -d @sample_resume.json \
  --output test_resume.pdf
```

### 3. Test from Frontend

1. Generate a resume in FlashResume
2. Go to result page
3. Click "Download PDF"
4. Check browser console for logs:
   - ✅ "Using LaTeX PDF generation" = Success
   - ⚠️ "LaTeX failed, using React-PDF fallback" = LaTeX not available

---

## 🐛 Troubleshooting

### Issue: "pdflatex not found"

**Solution:**
1. Verify LaTeX installation: `pdflatex --version`
2. Add LaTeX to PATH:
   - **Windows:** Add `C:\Program Files\MiKTeX\miktex\bin\x64` to PATH
   - **Linux/Mac:** Usually automatic

### Issue: "LaTeX compilation failed"

**Solution:**
1. Check LaTeX logs in backend console
2. Test with preview endpoint: `/api/preview-latex`
3. Verify special characters are escaped properly

### Issue: "Missing LaTeX packages"

**Solution (MiKTeX):**
1. Open MiKTeX Console
2. Go to "Packages"
3. Install missing packages:
   - `fontawesome5`
   - `titlesec`
   - `enumitem`
   - `hyperref`

**Solution (TeX Live):**
```bash
sudo tlmgr install fontawesome5 titlesec enumitem hyperref
```

### Issue: "Compilation timeout"

**Solution:**
- Increase timeout in `latex_compiler.py`:
  ```python
  timeout=30  # Change to 60 or 120
  ```

---

## 📊 Comparison: LaTeX vs React-PDF

| Feature | LaTeX PDF | React-PDF |
|---------|-----------|-----------|
| **Quality** | ⭐⭐⭐⭐⭐ Professional | ⭐⭐⭐⭐ Good |
| **ATS Compatibility** | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐⭐ Good |
| **Font Rendering** | ⭐⭐⭐⭐⭐ Perfect | ⭐⭐⭐ Decent |
| **Speed** | ⭐⭐⭐ 2-3 seconds | ⭐⭐⭐⭐⭐ Instant |
| **Setup** | ⭐⭐⭐ Requires LaTeX | ⭐⭐⭐⭐⭐ No setup |
| **Customization** | ⭐⭐⭐⭐⭐ Full control | ⭐⭐⭐ Limited |

**Recommendation:** Use LaTeX for production, React-PDF as fallback.

---

## 🎓 LaTeX Template Customization

### Modify Template V1 Layout

Edit `backend/templates/template_v1.tex`:

```latex
% Change margins
\usepackage[margin=0.5in]{geometry}  % Adjust to 0.75in, 1in, etc.

% Change font size
\documentclass[letterpaper,11pt]{article}  % Change to 10pt, 12pt

% Change section formatting
\titleformat{\section}{
  \vspace{-4pt}\scshape\raggedright\large  % Adjust spacing
}{}{0em}{}[\color{black}\titlerule \vspace{-5pt}]
```

### Add New Sections

```latex
% Add certifications section
\section{Certifications}
  \resumeSubHeadingListStart
{{CERTIFICATIONS_ITEMS}}
  \resumeSubHeadingListEnd
```

Then update `latex_compiler.py` to handle the new section.

---

## 🚀 Deployment Considerations

### Render.com / Railway / Heroku

Add buildpack or install LaTeX in Dockerfile:

```dockerfile
# Dockerfile
FROM python:3.11-slim

# Install LaTeX
RUN apt-get update && apt-get install -y \
    texlive-latex-base \
    texlive-fonts-recommended \
    texlive-latex-extra \
    && rm -rf /var/lib/apt/lists/*

# Copy app
COPY . /app
WORKDIR /app

# Install Python dependencies
RUN pip install -r requirements.txt

# Run app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### AWS Lambda / Serverless

Use Lambda Layer with LaTeX binaries or use container deployment.

---

## ✅ Success Checklist

- [ ] LaTeX installed (`pdflatex --version` works)
- [ ] Backend running (`uvicorn main:app --reload`)
- [ ] `/api/check-latex` returns `latex_installed: true`
- [ ] Frontend can download PDF
- [ ] PDF opens correctly and looks professional
- [ ] Special characters (%, &, $) render correctly
- [ ] All sections appear in correct order

---

## 🎉 You're Ready!

Your FlashResume now generates **professional LaTeX PDFs** with:
- ✅ Perfect typesetting
- ✅ ATS-optimized formatting
- ✅ Consistent rendering
- ✅ Automatic fallback to React-PDF

**Enjoy the professional quality! 🚀**
