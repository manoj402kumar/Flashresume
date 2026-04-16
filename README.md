# FlashResume

**AI-powered resume optimization for B.Tech freshers**

FlashResume helps students get shortlisted in ATS while ensuring they can confidently handle interviews. Built with Next.js 15 (frontend) and FastAPI (backend).

---

## 🚀 Quick Start

### Frontend (Next.js)
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

### Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```
API runs on [http://localhost:8000](http://localhost:8000)

---

## 📚 Documentation

- **[ALGORITHM_REFERENCE.md](./ALGORITHM_REFERENCE.md)** - Complete algorithm guide (Step 0 → Step 6)
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture & data flow
- **[CLEANUP_SUMMARY.md](./CLEANUP_SUMMARY.md)** - Recent cleanup & alignment details

---

## 🎯 Core Features

- **3-Layer PDF Parsing**: pdfplumber → PyMuPDF → Tesseract OCR
- **2-Layer LLM Fallback**: Gemini → Qwen (99.9% success rate)
- **Smart Optimization**: Preserves good content, enhances weak content
- **MAX 2 Projects**: Enforced at prompt + code + schema levels
- **Authentic Metrics**: Only countable, technical, or measured metrics
- **LaTeX PDF Generation**: Professional-quality output

---

## 🏗️ Tech Stack

**Frontend:**
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Framer Motion

**Backend:**
- FastAPI
- Python 3.10+
- Google Gemini API
- OpenRouter (Qwen)
- LaTeX (pdflatex)

---

## 📋 Environment Variables

### Backend `.env`
```bash
GEMINI_API_KEY=your_gemini_key
OPENROUTER_API_KEY=your_openrouter_key
```

### Frontend `.env.local`
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 🎨 User Flow

1. **Upload** - Resume (PDF/DOCX/JPG/PNG) + Job Description
2. **Analyze** - ATS score + matched/missing keywords
3. **Preview** - See what AI will enhance
4. **Generate** - AI optimizes resume (15-30s)
5. **Result** - Download PDF or edit inline

---

## 🔒 Core Principles

1. **Preservation First**: "If original is good, keep it. Only enhance what needs enhancement."
2. **Authenticity**: Never invent jobs, degrees, or fake metrics
3. **Interview-Ready**: All claims must be defensible in interviews
4. **Fresher-Focused**: Optimized for B.Tech students (0-1 year experience)
5. **Quality > Quantity**: MAX 2 projects, target 1-page resume

---

## 📦 Deployment

**Frontend**: Vercel (auto-deploy from Git)  
**Backend**: Render (see `backend/render.yaml`)

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🤝 Contributing

Contributions welcome! Please read the algorithm documentation before making changes to ensure alignment with core principles.

