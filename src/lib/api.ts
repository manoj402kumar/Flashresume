// FlashResume API Integration Layer
// All backend calls with error handling and timeouts
import { supabase } from "./supabase";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ────────────────────────────────────────────────────────────────────────────
// STEP 1: Parse Resume (PDF Upload or Text Paste)
// ────────────────────────────────────────────────────────────────────────────

export interface ExtractedLinks {
  all_urls?:  string[];
}

export interface ParseResponse {
  resume_text: string;
  page_count: number;
  parser_used: "pdfplumber" | "gemini_vision" | "pypdfium2" | "python-docx";
  extracted_links?: ExtractedLinks;
}

export async function parseResume(file: File): Promise<ParseResponse> {
  // Validate file size (5MB limit)
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("File too large. Maximum size is 5MB.");
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
// STEP 2: Analyze Resume (Combined: ATS Scoring + Project Check)
// ────────────────────────────────────────────────────────────────────────────

export interface SuggestedProject {
  title: string;
  tech_stack: string;
  description: string;
}

export interface CombinedAnalysisResponse {
  // ATS Analysis
  ats_score: number;
  matched_skills: string[];
  missing_skills: string[];       // legacy field (Pydantic model key) — mapped from updated_missing_skills
  updated_missing_skills?: string[];
  all_missing_skills: string[];
  // Project Check
  has_relevant_projects: boolean;
  relevant_projects: string[];
  total_projects_count: number;
  least_relevant_project?: string;
  suggested_project?: SuggestedProject;
  requires_consent: boolean;
  selected_projects: string[];
  case: number;
  model_used?: string;
}

export async function analyzeResume(
  resume_text: string,
  job_description: string,
  preferred_model?: string
): Promise<CombinedAnalysisResponse> {
  if (!resume_text.trim()) {
    throw new Error("Resume text cannot be empty.");
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }

    const res = await fetch(`${BASE}/api/analyze`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        resume_text,
        job_description,
        preferred_model
      }),
      signal: AbortSignal.timeout(60000), // 60s timeout for LLM
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
// STEP 3: Generate Optimized Resume
// ────────────────────────────────────────────────────────────────────────────

export interface GenerateRequest {
  resume_text: string;
  job_description: string;
  ats_score_before: number;
  approved_project?: string;
  missing_keywords?: string[];
  selected_projects?: string[];
  preferred_model?: string;
  no_ai_changes?: boolean;
  extracted_links?: ExtractedLinks | null;
}

export interface TemplateV1 {
  template_id: string;
  heading: {
    name: string;
    phone: string;
    email: string;
    linkedin_url: string;
    linkedin_url_href?: string;
    linkedin_hidden?: boolean;
    github_url?: string;
    github_url_href?: string;
    github_hidden?: boolean;
    custom_links?: Array<{ label: string; url: string }>;
  };
  summary?: string;
  education: Array<{
    institution: string;
    location: string;
    degree: string;
    duration: string;
    cgpa?: string | null;
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
    duration?: string;
    bullets: string[];
    link?: string;
    link_href?: string;
  }>;
  achievements?: string[] | null;
  certifications?: string[] | null;
  certifications_and_achievements?: string[] | null;
  technical_skills: {
    languages: string[];
    frameworks_and_libraries: string[];
    databases: string[];
    cloud_and_dev_tools: string[];
    cloud_services?: string[];    // legacy — kept for backward compat with old cached resumes
    developer_tools?: string[];   // legacy — kept for backward compat with old cached resumes
    miscellaneous: string[];
    custom_categories?: Array<{
      label: string;
      skills: string[];
    }>;
  };
  changes: string[];
  ai_suggestions?: string[] | null;
  job_strategy?: JobStrategyItem[] | null;
  section_order?: string[];
  custom_sections?: Array<{
    id: string;
    heading: string;
    items?: any[];
    bullets?: Array<string | { text: string; url?: string }>;
  }>;
  ats_score_before: number;
  ats_score_after: number;
  session_id?: string;
  _model_used?: string;
}

export interface JobStrategyItem {
  role: string;
  match: "Strong" | "Good" | "Moderate";
  search_queries: string[];
}

export async function generateResume(
  payload: GenerateRequest
): Promise<TemplateV1> {
  if (!payload.resume_text.trim()) {
    throw new Error("Resume text cannot be empty.");
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }

    const res = await fetch(`${BASE}/api/generate`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(180000), // 180s timeout (generation is slower)
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
