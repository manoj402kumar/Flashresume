# FlashResume - Complete Workflow

## 🎯 User Journey

### 1. **Landing Page** (`/` - page.tsx)
**What happens:**
- User sees beautiful landing page designed by your friend
- Upload resume (PDF) via drag-and-drop or file picker
- Paste job description in textarea
- Click "Generate" button

**Backend calls:**
- `POST /api/parse` - Parse PDF resume
- `POST /api/analyze` - Get ATS score and skills analysis
- `POST /api/check-projects` - Check project relevance

**Data saved to localStorage:**
- `resume_text`
- `job_description`
- `analysis` (ATS score, matched/missing skills, suggestions)
- `project_check` (relevant projects, suggested projects)

**Navigation:** → `/analyze`

---

### 2. **Analyze Page** (`/analyze`)
**What happens:**
- Display animated ATS score (0-100)
- Show matched skills (green badges)
- Show missing skills (red badges)
- List improvement suggestions
- Show project analysis results

**Navigation:**
- ← Back to Home (`/`)
- → Continue to Review (`/consent`)

---

### 3. **Consent Page** (`/consent`)
**What happens:**
- User reviews all AI suggestions
- Checkboxes to approve/reject each suggestion
- Checkboxes for suggested new projects (if no relevant projects found)
- Existing relevant projects shown (auto-approved)

**Data saved to localStorage:**
- `approved_suggestions` (array of approved items)

**Navigation:**
- ← Back to Analysis (`/analyze`)
- → Generate My Resume (`/generate`)

---

### 4. **Generate Page** (`/generate`)
**What happens:**
- Loading screen with progress bar
- Real-time status updates
- Calls backend to generate optimized resume

**Backend call:**
- `POST /api/generate` - Generate Template v1 JSON

**Data saved to localStorage:**
- `generated_resume` (complete Template v1 JSON)

**Navigation:** → `/result` (automatic after success)

---

### 5. **Result Page** (`/result`)
**What happens:**
- Display full generated resume
- Editable fields (all sections can be edited)
- Highlighting system (yellow background for AI-enhanced content)
- Download PDF button (professional ATS-friendly format)

**Features:**
- Edit mode toggle
- Save changes
- Add/remove skills
- PDF generation with `@react-pdf/renderer`

---

## 🔄 Complete Flow

```
Landing Page (/) 
    ↓ [Upload PDF + Job Description]
    ↓ [Parse + Analyze + Check Projects]
    ↓
Analyze Page (/analyze)
    ↓ [Review ATS Score & Suggestions]
    ↓
Consent Page (/consent)
    ↓ [Approve/Reject Suggestions]
    ↓
Generate Page (/generate)
    ↓ [AI Generates Resume]
    ↓
Result Page (/result)
    ↓ [Edit & Download PDF]
```

---

## 🗂️ localStorage Data Flow

| Key | Set By | Used By |
|-----|--------|---------|
| `resume_text` | Landing | Analyze, Generate |
| `job_description` | Landing | Analyze, Generate |
| `analysis` | Landing | Analyze, Consent, Generate |
| `project_check` | Landing | Analyze, Consent |
| `approved_suggestions` | Consent | Generate |
| `generated_resume` | Generate | Result |

---

## 🎨 Design Credits

**Landing Page Design:** Your friend's beautiful UI
**Workflow Pages:** Backend integration + functional pages

---

## 🚀 What Changed

### ✅ Removed
- `/upload` page (redundant - landing page already has upload functionality)

### ✅ Updated
- Landing page now functional with backend integration
- All navigation updated to use `/` instead of `/upload`
- All "Get Started" buttons now trigger file upload

### ✅ Kept
- Your friend's beautiful landing page design
- All backend functionality
- Complete 5-page workflow
- PDF generation system
- Editable fields + highlighting

---

## 🔧 Technical Stack

**Frontend:**
- Next.js 16.2.3 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- Framer Motion
- @react-pdf/renderer

**Backend:**
- FastAPI (Python)
- Gemini AI (primary)
- Qwen (fallback)
- DeepSeek (fallback)
- pdfplumber + Gemini Vision (PDF parsing)

**Deployment:**
- Frontend: Vercel (recommended)
- Backend: Render / Railway / AWS

---

## 📝 Next Steps

1. Test the complete flow from landing page
2. Verify all navigation works correctly
3. Test PDF upload and generation
4. Deploy to production
5. Add analytics tracking
6. Add payment integration (for Pro/Lifetime plans)
