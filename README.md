# FlashResume

**AI-powered resume optimization for B.Tech freshers**

FlashResume helps students get shortlisted in ATS while ensuring they can confidently handle interviews. Built with Next.js (frontend) and FastAPI (backend).

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

- **[ALGORITHM_REFERENCE.md](./ALGORITHM_REFERENCE.md)** — Complete algorithm guide (Step 0 → Step 6)
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — System architecture & data flow
- **[CLEANUP_SUMMARY.md](./CLEANUP_SUMMARY.md)** — Recent cleanup & alignment details

---

## 🎯 Core Features

- **3-Layer PDF Parsing**: pdfplumber → PyMuPDF → Tesseract OCR
- **Multi-Provider LLM Fallback**: DeepSeek → Mistral → NVIDIA → Cloudflare (99.9% uptime)
- **Smart ATS Optimization**: Preserves good content, enhances weak content
- **MAX 2 Projects**: Enforced at prompt + code + schema levels
- **Authentic Metrics**: Only countable, technical, or measured metrics
- **2 Resume Templates**: Choose your preferred layout before downloading

---

## 🏗️ Tech Stack

### Frontend
- Next.js 16 + React 19 (App Router)
- TypeScript
- Tailwind CSS v4
- Framer Motion
- @react-pdf/renderer

### Backend
- FastAPI + Python 3.10+
- DeepSeek API
- Mistral AI
- NVIDIA API
- Cloudflare Workers AI

---

## 📋 Environment Variables

### Backend `.env`
```bash
DEEPSEEK_API_KEY=your_deepseek_key
MISTRAL_API_KEY=your_mistral_key
NVIDIA_API_KEY=your_nvidia_key
CLOUDFLARE_API_KEY=your_cloudflare_key

# Optional: set preferred LLM provider
PREFERRED_LLM=gemini

# Set this when deploying frontend to Vercel
FRONTEND_URL=https://your-app.vercel.app
```

### Frontend `.env.local`
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 🎨 User Flow

1. **Upload** — Resume (PDF/DOCX/JPG/PNG) + Job Description
2. **Analyze** — ATS score + matched/missing keywords
3. **Select Model** — Choose your preferred AI provider
4. **Generate** — AI optimizes resume (15–30s)
5. **Result** — Download PDF (Template 1 or Template 2)

---

## 🔁 LLM Fallback Chain

```
Request
        └─► Mistral (mistral-medium → mistral-large)
              └─► NVIDIA (mistral-nemotron → ministral-14b)
                    └─► Cloudflare (llama-3.3-70b-fast)
```

Set `PREFERRED_LLM=mistral` (or any provider) in `.env` to change primary order.

---

## 🔒 Core Principles

1. **Preservation First**: "If original is good, keep it. Only enhance what needs enhancement."
2. **Authenticity**: Never invent jobs, degrees, or fake metrics
3. **Interview-Ready**: All claims must be defensible in interviews
4. **Fresher-Focused**: Optimized for B.Tech students (0–1 year experience)
5. **Quality > Quantity**: MAX 2 projects, target 1-page resume

---

## 📦 Deployment

**Frontend**: Vercel (auto-deploy from Git)  
**Backend**: Render (see `backend/render.yaml`)

---

## 📄 License

MIT License — See LICENSE file for details
