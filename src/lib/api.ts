// FlashResume API Integration Layer
// All backend calls with error handling and timeouts

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ────────────────────────────────────────────────────────────────────────────
// STEP 1: Parse Resume (PDF Upload or Text Paste)
// ────────────────────────────────────────────────────────────────────────────

export interface ParseResponse {
  resume_text: string;
  page_count: number;
  parser_used: "pdfplumber" | "gemini_vision";
}

export async function parseResume(file: File): Promise<ParseResponse> {
  // Validate file size (10MB limit)
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("File too large. Maximum size is 10MB.");
  }

  // Validate file type - support PDF, DOCX, JPG, PNG
  const allowedExtensions = [".pdf", ".docx", ".jpg", ".jpeg", ".png"];
  const fileName = file.name.toLowerCase();
  const isValidType = allowedExtensions.some(ext => fileName.endsWith(ext));
  
  if (!isValidType) {
    throw new Error("Unsupported file type. Please upload PDF, DOCX, JPG, or PNG.");
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(`${BASE}/api/parse`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Parse failed (${res.status}): ${errorText}`);
    }

    return await res.json();
  } catch (err: any) {
    if (err.name === "TimeoutError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw new Error(err.message || "Failed to parse resume. Please try again.");
  }
}

// ────────────────────────────────────────────────────────────────────────────
// STEP 2a: Analyze Resume (ATS Scoring)
// ────────────────────────────────────────────────────────────────────────────

export interface AnalyzeResponse {
  ats_score: number;
  matched_skills: string[];
  missing_skills: string[];
  suggestions: string[];
}

export async function analyzeResume(
  resume_text: string,
  job_description: string
): Promise<AnalyzeResponse> {
  if (!resume_text.trim()) {
    throw new Error("Resume text cannot be empty.");
  }
  if (!job_description.trim()) {
    throw new Error("Job description cannot be empty.");
  }

  try {
    const res = await fetch(`${BASE}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume_text, job_description }),
      signal: AbortSignal.timeout(120000), // 120s timeout
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Analysis failed (${res.status}): ${errorText}`);
    }

    return await res.json();
  } catch (err: any) {
    if (err.name === "TimeoutError") {
      throw new Error("Analysis timed out. Please try again.");
    }
    throw new Error(err.message || "Failed to analyze resume. Please try again.");
  }
}

// ────────────────────────────────────────────────────────────────────────────
// STEP 2b: Check Project Relevance
// ────────────────────────────────────────────────────────────────────────────

export interface ProjectCheckResponse {
  has_relevant_projects: boolean;
  relevant_projects: string[];
  suggested_projects: string[];
  requires_consent: boolean;
}

export async function checkProjects(
  resume_text: string,
  job_description: string
): Promise<ProjectCheckResponse> {
  if (!resume_text.trim()) {
    throw new Error("Resume text cannot be empty.");
  }
  if (!job_description.trim()) {
    throw new Error("Job description cannot be empty.");
  }

  try {
    const res = await fetch(`${BASE}/api/check-projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume_text, job_description }),
      signal: AbortSignal.timeout(120000), // 120s timeout
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Project check failed (${res.status}): ${errorText}`);
    }

    return await res.json();
  } catch (err: any) {
    if (err.name === "TimeoutError") {
      throw new Error("Project check timed out. Please try again.");
    }
    throw new Error(err.message || "Failed to check projects. Please try again.");
  }
}

// ────────────────────────────────────────────────────────────────────────────
// STEP 3: Generate Optimized Resume
// ────────────────────────────────────────────────────────────────────────────

export interface GenerateRequest {
  resume_text: string;
  job_description: string;
  approved_suggestions: string[];
  ats_score_before: number;
}

export interface TemplateV1 {
  template_id: string;
  heading: {
    name: string;
    phone: string;
    email: string;
    linkedin_url: string;
  };
  education: Array<{
    institution: string;
    location: string;
    degree: string;
    duration: string;
  }>;
  experience: Array<{
    job_title: string;
    duration: string;
    company: string;
    location: string;
    bullets: string[];
  }>;
  projects: Array<{
    title: string;
    tech_stack: string;
    duration: string;
    bullets: string[];
  }>;
  achievements: string[];
  technical_skills: {
    languages: string[];
    frameworks: string[];
    databases: string[];
    cloud_services: string[];
    developer_tools: string[];
  };
  changes: string[];
  ats_score_before: number;
  ats_score_after: number;
}

export async function generateResume(
  payload: GenerateRequest
): Promise<TemplateV1> {
  if (!payload.resume_text.trim()) {
    throw new Error("Resume text cannot be empty.");
  }
  if (!payload.job_description.trim()) {
    throw new Error("Job description cannot be empty.");
  }

  try {
    const res = await fetch(`${BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120000), // 120s timeout (LLM can be slow)
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Generation failed (${res.status}): ${errorText}`);
    }

    return await res.json();
  } catch (err: any) {
    if (err.name === "TimeoutError") {
      throw new Error("Generation timed out. The AI is taking longer than expected. Please try again.");
    }
    throw new Error(err.message || "Failed to generate resume. Please try again.");
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Helper: Run Analyze + Project Check in Parallel
// ────────────────────────────────────────────────────────────────────────────

export interface AnalysisResult {
  analysis: AnalyzeResponse;
  projectCheck: ProjectCheckResponse;
}

export async function runFullAnalysis(
  resume_text: string,
  job_description: string
): Promise<AnalysisResult> {
  try {
    const [analysis, projectCheck] = await Promise.all([
      analyzeResume(resume_text, job_description),
      checkProjects(resume_text, job_description),
    ]);

    return { analysis, projectCheck };
  } catch (err: any) {
    throw new Error(err.message || "Analysis failed. Please try again.");
  }
}
