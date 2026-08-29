# FlashResume

**AI-powered resume optimization for B.Tech freshers**

> Last verified: 2026-08-28

FlashResume helps students get shortlisted in ATS while ensuring they can confidently handle interviews. Built with Next.js (frontend) and FastAPI (backend).

---

## 🚀 Quick Start

### Frontend (Next.js)
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

### Backend (FastAPI - Python 3.11 Required)

#### Option 1: Startup Scripts (Recommended)
These scripts automatically validate Python 3.11, isolate dependencies, and auto-start local Redis.
```bash
cd ~/Desktop/Flashresume

# Terminal 1: Start Core API Server
./start.sh --reload

# Terminal 2: Start Heavy Worker
./start_worker.sh
```

#### Option 2: Manual Start (Virtual Environment)
Ensure you have Python 3.11 installed.

```bash
cd ~/Desktop/Flashresume/backend

# Create and activate virtual environment
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Terminal 1: Start Core API Server
python -m uvicorn main:app --port 8000 --reload

# Terminal 2: Start Heavy Worker
python worker.py
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
- **Multi-Provider LLM Fallback**: DeepSeek → Mistral (POOL_1) → Ministral/Cloudflare/NVIDIA (POOL_2) with circuit breaker
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
- Mistral AI (primary, 3 API keys across POOL_1)
- DeepSeek API (primary first attempt)
- NVIDIA API (POOL_2 fallback)
- Cloudflare Workers AI (POOL_2 fallback)
- Redis (queue, job state, rate limiting, presence, pub/sub)
- Supabase (PostgreSQL + Object Storage)

---

## 📋 Environment Variables

### Backend `.env`
```bash
# LLM Provider API Keys (multiple keys supported for round-robin)
MISTRAL_R1_API_KEY=your_mistral_key_1
MISTRAL_R2_API_KEY=your_mistral_key_2
MISTRAL_R3_API_KEY=your_mistral_key_3
DEEPSEEK_API_KEY=your_deepseek_key
NVIDIA_API_KEY=your_nvidia_key
NVIDIA_R2_API_KEY=your_nvidia_key_2
CLOUDFLARE_API_KEY=your_cloudflare_key
CLOUDFLARE_R2_API_KEY=your_cloudflare_key_2
CLOUDFLARE_ACCOUNT_ID=your_cf_account_id

# Redis (required for queue, job state, rate limiting)
REDIS_URL=redis://localhost:6379

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_key

# Worker configuration
WORKER_CONCURRENCY=4  # concurrent jobs per worker process

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

> Note: The fallback chain is implemented as a two-pool round-robin system with circuit breakers. See `ARCHITECTURE.md` for full details.

```
Request
  └─► DeepSeek (deepseek-v4-flash) — primary attempt
        └─► POOL_1: Mistral variants (round-robin, 18 slots, 3 API keys)
              └─► POOL_2: Ministral / Cloudflare / NVIDIA (round-robin, 16 slots)
```

Circuit breakers prevent retrying failed providers. Set `preferred_model` in the generate request to override the automatic chain.

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
