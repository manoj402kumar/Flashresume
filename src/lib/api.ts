// FlashResume API Integration Layer
// All backend calls with error handling and timeouts
import { supabase } from "./supabase";

let BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Remove trailing slash if present
if (BASE.endsWith("/")) {
  BASE = BASE.slice(0, -1);
}

// Client-side environment checks
if (typeof window !== "undefined") {
  const isLocalHost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  
  // 1. Prevent Mixed Content
  if (window.location.protocol === "https:" && BASE.startsWith("http://") && !BASE.includes("localhost") && !BASE.includes("127.0.0.1")) {
    console.warn(`Upgrading API URL from HTTP to HTTPS to prevent mixed-content blocking: ${BASE}`);
    BASE = BASE.replace("http://", "https://");
  }

  // 2. Detect missing Vercel environment variable (Baked-in localhost on public domain)
  if (!isLocalHost && (BASE.includes("localhost") || BASE.includes("127.0.0.1"))) {
    console.error(`FATAL: Frontend deployed to ${window.location.hostname} but API URL is ${BASE}. NEXT_PUBLIC_API_URL was missing during the Vercel build.`);
    // We cannot proceed, the browser will refuse to connect to localhost from a remote domain.
  }
}


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

async function waitForJobSSE(jobId: string, timeoutMs: number): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || "";
  const overallStartTime = Date.now();
  let attempt = 0;
  const maxAttempts = 10;
  
  while (Date.now() - overallStartTime < timeoutMs) {
    attempt++;
    const remainingMs = timeoutMs - (Date.now() - overallStartTime);
    if (remainingMs <= 0) {
      throw new Error("Job timed out.");
    }
    
    // Check durable state first on reconnects
    if (attempt > 1) {
      try {
        const res = await fetch(`${BASE}/api/jobs/${jobId}/status${token ? `?token=${encodeURIComponent(token)}` : ''}`, {
          headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const job = await res.json();
          if (job.status === "COMPLETE" && job.result) {
            return job.result;
          } else if (job.status === "FAILED") {
            throw new Error(job.error || "Job failed during processing.");
          }
        }
      } catch (e) {
        console.warn("Durable status check failed", e);
      }
      
      // Bounded backoff: 500ms, 1s, 2s, max 5s
      const backoff = Math.min(500 * Math.pow(2, attempt - 2), 5000);
      await new Promise(r => setTimeout(r, backoff));
    }

    // Get fresh ticket
    let ticket = "";
    if (token) {
      try {
        const ticketRes = await fetch(`${BASE}/api/jobs/${jobId}/stream-ticket`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (ticketRes.ok) {
          const ticketData = await ticketRes.json();
          ticket = ticketData.ticket;
        }
      } catch (e) {
        console.warn("Failed to get SSE ticket", e);
      }
    }

    const sseUrl = `${BASE}/api/jobs/${jobId}/stream${ticket ? `?ticket=${encodeURIComponent(ticket)}` : ''}`;
    
    try {
      const result = await new Promise((resolve, reject) => {
        let isResolved = false;
        
        const timeout = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            eventSource.close();
            reject(new Error("Job timed out."));
          }
        }, remainingMs);

        const eventSource = new EventSource(sseUrl);

        eventSource.addEventListener("status", (event) => {
           // handled for debug purposes
        });

        eventSource.addEventListener("result", (event) => {
          if (isResolved) return;
          isResolved = true;
          clearTimeout(timeout);
          eventSource.close();
          try {
            resolve(JSON.parse(event.data));
          } catch (e) {
            reject(new Error("Failed to parse job result."));
          }
        });

        eventSource.addEventListener("error", (event: any) => {
          if (isResolved) return;
          if (event.data) {
            try {
              const errData = JSON.parse(event.data);
              if (errData.error) {
                 isResolved = true;
                 clearTimeout(timeout);
                 eventSource.close();
                 // Terminal failure from server
                 reject(new Error(errData.error));
              }
            } catch(e) {}
          }
        });

        eventSource.onerror = (err) => {
          if (isResolved) return;
          // Transient network error or ticket spent, let the promise resolve as transient so loop can retry
          if (eventSource.readyState === 2) {
             isResolved = true;
             clearTimeout(timeout);
             eventSource.close();
             // We reject with a specific string to signal retryable
             reject(new Error("TRANSIENT_RECONNECT"));
          }
        };
      });
      
      // If we made it here, the promise resolved successfully
      return result;
      
    } catch (err: any) {
      if (err.message === "TRANSIENT_RECONNECT") {
        if (attempt >= maxAttempts) {
          throw new Error("Connection failed after maximum retries.");
        }
        // loop will retry
        continue;
      }
      // Bubble up terminal errors (like job failed, timeout, or parsing error)
      throw err;
    }
  }
  
  throw new Error("Job timed out.");
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

  if (typeof window !== "undefined" && !["localhost", "127.0.0.1"].includes(window.location.hostname) && (BASE.includes("localhost") || BASE.includes("127.0.0.1"))) {
    throw new Error("Configuration Error: NEXT_PUBLIC_API_URL is pointing to localhost in production. Please update Vercel environment variables and redeploy.");
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(`${BASE}/api/parse`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(30000), // 30s timeout for enqueueing
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Parse enqueue failed (${res.status}): ${errorText}`);
    }

    const { job_id } = await res.json();
    if (!job_id) throw new Error("No job ID returned from server.");
    
    // Wait for the job via SSE
    return await waitForJobSSE(job_id, 120000); // 120s max wait for processing

  } catch (err: any) {
    console.error("[Parse Resume Error]", err);
    if (err.name === "TimeoutError") {
      throw new Error("Request timed out. Please try again.");
    }
    // If it's a TypeError from fetch(), it's likely a network issue (CORS, DNS, connection refused)
    if (err.name === "TypeError" && err.message === "Failed to fetch") {
      throw new Error("Network Error: Failed to fetch. Please check your internet connection or verify the backend is reachable.");
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

  if (typeof window !== "undefined" && !["localhost", "127.0.0.1"].includes(window.location.hostname) && (BASE.includes("localhost") || BASE.includes("127.0.0.1"))) {
    throw new Error("Configuration Error: NEXT_PUBLIC_API_URL is pointing to localhost in production. Please update Vercel environment variables and redeploy.");
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

    const data = await res.json();
    if (res.status === 202 && data.job_id) {
      return await waitForJobSSE(data.job_id, 120000);
    }
    return data;
  } catch (err: any) {
    console.error("[Analyze Resume Error]", err);
    if (err.name === "TimeoutError") {
      throw new Error("Analysis timed out. Please try again.");
    }
    if (err.name === "TypeError" && err.message === "Failed to fetch") {
      throw new Error("Network Error: Failed to fetch. Please check your internet connection or verify the backend is reachable.");
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

  if (typeof window !== "undefined" && !["localhost", "127.0.0.1"].includes(window.location.hostname) && (BASE.includes("localhost") || BASE.includes("127.0.0.1"))) {
    throw new Error("Configuration Error: NEXT_PUBLIC_API_URL is pointing to localhost in production. Please update Vercel environment variables and redeploy.");
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
      signal: AbortSignal.timeout(30000), // 30s timeout for enqueueing
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Generation enqueue failed (${res.status}): ${errorText}`);
    }

    const { job_id } = await res.json();
    if (!job_id) throw new Error("No job ID returned from server.");
    
    // Wait for the job via SSE
    return await waitForJobSSE(job_id, 180000); // 180s max wait for generation

  } catch (err: any) {
    console.error("[Generate Resume Error]", err);
    if (err.name === "TimeoutError") {
      throw new Error("Generation timed out. The AI is taking longer than expected. Please try again.");
    }
    if (err.name === "TypeError" && err.message === "Failed to fetch") {
      throw new Error("Network Error: Failed to fetch. Please check your internet connection or verify the backend is reachable.");
    }
    throw new Error(err.message || "Failed to generate resume. Please try again.");
  }
}
