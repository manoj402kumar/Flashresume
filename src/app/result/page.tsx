"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { pdf } from "@react-pdf/renderer";
import {
  Download,
  Copy,
  RefreshCw,
  Edit3,
  Eye,
  Sparkles,
  Save,
  TrendingUp,
  CheckCircle2,
  Home,
  FileText,
  Zap,
  Briefcase,
  GraduationCap,
  Code,
  Award,
  FolderGit2,
  GripVertical,
  PlusCircle,
  ChevronDown,
  ChevronUp,
  User
} from "lucide-react";

// Utility: move element in array from index `from` to index `to`
function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const result = [...arr];
  const [moved] = result.splice(from, 1);
  result.splice(to > from ? to - 1 : to, 0, moved);
  return result;
}
import type { TemplateV1 } from "@/lib/api";
import {
  isBulletEnhanced,
  getHighlightClass,
} from "@/lib/highlighting";
import ResumePDFTemplateLetter from "@/components/ResumePDFTemplateLetter";
import FeedbackModal from "@/components/FeedbackModal";
import ResumePDFTemplateA4 from "@/components/ResumePDFTemplateA4";
import dynamic from "next/dynamic";
import PricingPopup from "@/components/PricingPopup";
import { supabase } from "@/lib/supabase";
import { MODELS } from "@/components/ModelSelector";
const MobilePDFPreview = dynamic(
  () => import("@/components/MobilePDFPreview"),
  { ssr: false }
);

const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFViewer),
  { ssr: false }
);

// Helper component for editable skill tags
function EditableSkillTags({
  skills,
  onChange,
  editMode,
  colorClass,
  highlightedSkills = [],
  showHighlights = false,
}: {
  skills: string[];
  onChange: (newSkills: string[]) => void;
  editMode: boolean;
  colorClass: string;
  highlightedSkills?: string[];
  showHighlights?: boolean;
}) {
  const [newSkill, setNewSkill] = useState("");

  const addSkill = () => {
    if (newSkill.trim()) {
      onChange([...skills, newSkill.trim()]);
      setNewSkill("");
    }
  };

  const removeSkill = (index: number) => {
    onChange(skills.filter((_, idx) => idx !== index));
  };

  return (
    <div className="flex flex-wrap gap-2">
      {skills.map((skill, idx) => {
        const isHighlighted = highlightedSkills.includes(skill.toLowerCase());

        return (
          <motion.span
            key={idx}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.02 }}
            className={`px-3 py-1.5 ${colorClass} rounded-full text-sm font-medium flex items-center gap-2 ${showHighlights && isHighlighted ? "ring-2 ring-yellow-400 shadow-lg shadow-yellow-200/50 scale-105" : ""
              } transition-all`}
          >
            {skill}
            {showHighlights && isHighlighted && (
              <Sparkles className="w-3 h-3 text-yellow-500 animate-pulse" />
            )}
            {editMode && (
              <button
                onClick={() => removeSkill(idx)}
                className="hover:text-error font-bold"
                type="button"
              >
                ×
              </button>
            )}
          </motion.span>
        );
      })}
      {editMode && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
            placeholder="+ Add"
            className="px-3 py-1.5 border border-dashed border-on-surface-variant/30 bg-surface-container-lowest/50 backdrop-blur-sm rounded-full text-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 transition-all duration-300"
            style={{ minWidth: "80px" }}
          />
          {newSkill.trim() && (
            <button
              onClick={addSkill}
              className="w-7 h-7 bg-primary text-white rounded-full text-sm hover:opacity-90 flex items-center justify-center"
              type="button"
            >
              ✓
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Sanitize LLM garbage values like "LinkedIn Profile", "GitHub Link", placeholder URLs
const JUNK_PATTERNS = /^(linkedin profile|github link|linkedin\.com\/in\/username|github\.com\/username|linkedin|github|link|url|n\/a|none|your.*(url|link|profile|username))$/i;
function cleanDisplayUrl(val: string | undefined | null, fallback: string): string {
  if (!val || JUNK_PATTERNS.test(val.trim())) return fallback;
  return val.replace(/^https?:\/\//i, "");
}

const SECTION_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  summary: { label: "Summary", icon: <Zap className="w-4 h-4 text-primary" /> },
  education: { label: "Education", icon: <GraduationCap className="w-4 h-4 text-secondary-container" /> },
  experience: { label: "Experience", icon: <Briefcase className="w-4 h-4 text-tertiary-container" /> },
  projects: { label: "Projects", icon: <FolderGit2 className="w-4 h-4 text-primary" /> },
  skills: { label: "Technical Skills", icon: <Code className="w-4 h-4 text-secondary" /> },
  certifications: { label: "Certifications", icon: <Award className="w-4 h-4 text-secondary-container" /> }
};

export default function ResultPage() {
  const router = useRouter();
  const [resume, setResume] = useState<TemplateV1 | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChanges, setShowChanges] = useState(false);
  const [showMissedKeywords, setShowMissedKeywords] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [openEditSection, setOpenEditSection] = useState<string>("contact");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showHighlights, setShowHighlights] = useState(true);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [missingKeywords, setMissingKeywords] = useState<string[]>([]);
  const [matchedKeywords, setMatchedKeywords] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<"templateLetter" | "templateA4">("templateLetter");
  const [noJdMode, setNoJdMode] = useState(false);
  // Section drag-and-drop: track insertion gap index for reliable ordering
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [insertionIndex, setInsertionIndex] = useState<number | null>(null);
  const [showPricingPopup, setShowPricingPopup] = useState(false);
  const [pricingTrigger, setPricingTrigger] = useState<"download" | "buy_more">("download");
  const [hasPaidAccess, setHasPaidAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [userEmail, setUserEmail] = useState<string>("");
  const [credits, setCredits] = useState<number>(0);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [showMobilePreview, setShowMobilePreview] = useState(true);
  const [showFeedback, setShowFeedback] = useState(false);
  const [sessionGuid, setSessionGuid] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [activeModelName, setActiveModelName] = useState<string>("Auto");

  const handleSectionDragStart = (e: React.DragEvent, sectionId: string) => {
    setDraggingId(sectionId);
    e.dataTransfer.effectAllowed = "move";
  };

  // Use both dragEnter and dragOver to get smooth real-time feedback
  const calcInsertionIndex = (e: React.DragEvent, itemIndex: number) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return e.clientY < rect.top + rect.height / 2 ? itemIndex : itemIndex + 1;
  };

  const handleSectionDragEnter = (e: React.DragEvent, itemIndex: number, sectionId: string) => {
    e.preventDefault();
    if (sectionId === draggingId) return;
    setInsertionIndex(calcInsertionIndex(e, itemIndex));
  };

  const handleSectionDragOver = (e: React.DragEvent, itemIndex: number, sectionId: string) => {
    e.preventDefault();
    if (sectionId === draggingId) return;
    setInsertionIndex(calcInsertionIndex(e, itemIndex));
  };

  const handleSectionDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggingId || insertionIndex === null || !resume) {
      setDraggingId(null); setInsertionIndex(null); return;
    }
    const currentOrder = resume.section_order || ["summary", "education", "experience", "projects", "skills", "certifications"];
    const fromIdx = currentOrder.indexOf(draggingId);
    if (fromIdx === -1) { setDraggingId(null); setInsertionIndex(null); return; }
    const rawTo = Math.max(0, Math.min(insertionIndex, currentOrder.length));
    if (rawTo !== fromIdx && rawTo !== fromIdx + 1) {
      const newOrder = arrayMove(currentOrder, fromIdx, rawTo);
      updateResume({ section_order: newOrder });
    }
    setDraggingId(null);
    setInsertionIndex(null);
  };

  const handleSectionDragEnd = () => {
    setDraggingId(null);
    setInsertionIndex(null);
  };

  // Track Result Page Visit
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    fetch(`${apiUrl}/api/analytics/track-visit`, {
      method: "POST",
      body: JSON.stringify({ page_type: "result" }),
      headers: { "Content-Type": "application/json" }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const fetchSession = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get("session_id");
      if (sessionId) setSessionGuid(sessionId);

      let parsed = null;

      if (sessionId) {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
          const res = await fetch(`${apiUrl}/api/sessions/${sessionId}`);
          if (res.ok) {
            const data = await res.json();
            parsed = data.generated_output;
          }
        } catch (e) {
          console.error("Failed to fetch session", e);
        }
      }

      if (!parsed) {
        const resumeData = localStorage.getItem("generated_resume");
        if (!resumeData) {
          router.push("/");
          return;
        }
        parsed = JSON.parse(resumeData);
      }
      // Sanitize junk LLM values on load so edit fields show clean defaults
      parsed.heading.linkedin_url = cleanDisplayUrl(parsed.heading.linkedin_url, "linkedin");
      parsed.heading.github_url = cleanDisplayUrl(parsed.heading.github_url, "github.com/username");
      // Build hrefs from display text if not already set
      if (!parsed.heading.linkedin_url_href) {
        parsed.heading.linkedin_url_href = `https://${parsed.heading.linkedin_url}`;
      }
      if (!parsed.heading.github_url_href) {
        parsed.heading.github_url_href = `https://${parsed.heading.github_url}`;
      }

      // Load analysis keywords for PDF highlighting
      const analysisData = localStorage.getItem("analysis");
      if (analysisData) {
        try {
          const parsedAnalysis = JSON.parse(analysisData);
          setMissingKeywords(parsedAnalysis.all_missing_skills || parsedAnalysis.missing_skills || []);
          setMatchedKeywords(parsedAnalysis.matched_skills || []);
        } catch (e) { }
      }

      setNoJdMode(localStorage.getItem("no_jd_mode") === "true");

      if (!parsed.section_order || parsed.section_order.length === 0) {
        parsed.section_order = ["summary", "education", "experience", "projects", "skills", "certifications"];
      }

      // Use the actual model returned by the backend API if available
      let finalModelName = "Auto (Best Quality Available)";
      if (parsed._model_used) {
        finalModelName = parsed._model_used;
      } else {
        const savedModelId = localStorage.getItem("preferred_model") || "";
        const matchedModel = MODELS.preferred_model.find(m => m.id === savedModelId);
        if (matchedModel && matchedModel.id !== "") {
          finalModelName = matchedModel.name;
        }
      }
      setActiveModelName(finalModelName);

      setResume(parsed);
      setLoading(false);
    };

    fetchSession();
  }, [router]);

  const checkAccess = async () => {
    setCheckingAccess(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setHasPaidAccess(false);
      setCheckingAccess(false);
      return;
    }
    setUserEmail(session.user.email || "");
    setCurrentUserId(session.user.id);

    // Check credits balance
    const { data: userData } = await supabase
      .from("users")
      .select("credits_balance")
      .eq("id", session.user.id)
      .single();

    const currentCredits = userData?.credits_balance || 0;
    setCredits(currentCredits);

    // Check subscription data for Account dropdown
    const { data: subData } = await supabase
      .from("subscriptions")
      .select("plan_type, expires_at")
      .eq("user_id", session.user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subData) {
      setSubscriptionData(subData);
    }

    if (currentCredits >= 10) {
      setHasPaidAccess(true);
    } else {
      setHasPaidAccess(false);
    }
    setCheckingAccess(false);
  };

  // Check if user has already paid — skip gate if yes
  useEffect(() => {
    checkAccess();
  }, []);

  // JSON copy removed
  const handleCopyJSON_UNUSED = () => {
    if (resume) {
      navigator.clipboard.writeText(JSON.stringify(resume, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStartOver = () => {
    // Only clear resume workflow keys — do NOT clear auth session
    ["resume_text", "job_description", "analysis", "generated_resume",
      "no_jd_mode", "no_ai_changes", "approved_project", "preferred_model"].forEach(
        (key) => localStorage.removeItem(key)
      );
    router.push("/");
  };

  const handleSaveChanges = () => {
    if (resume) {
      localStorage.setItem("generated_resume", JSON.stringify(resume));
      setHasUnsavedChanges(false);
    }
  };

  const updateResume = (updates: Partial<TemplateV1>) => {
    setResume((prev) => prev ? { ...prev, ...updates } : null);
    setHasUnsavedChanges(true);
  };

  const handleDownloadPDF = async () => {
    if (!resume) return;
    setDownloadingPDF(true);
    try {
      // Use React-PDF for high-quality, ATS-friendly frontend PDF generation
      // Ensure highlights are strictly DISABLED for the downloaded PDF
      const PDFComponent = selectedTemplate === "templateLetter"
        ? ResumePDFTemplateLetter
        : ResumePDFTemplateA4;
      const blob = await pdf(
        <PDFComponent
          resume={resume}
          showHighlights={false}
          matchedKeywords={[]}
          missingKeywords={[]}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${resume.heading.name.replace(/\s+/g, "_")}_Resume.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Deduct credit if applicable
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        try {
          await fetch(`${apiUrl}/api/payments/deduct-credit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: session.user.id, session_id: sessionGuid })
          });
          // Re-evaluate access silently
          await checkAccess();
        } catch (e) {
          console.error("Failed to deduct credit", e);
        }
      }

      // Trigger feedback on first download
      if (sessionGuid && currentUserId) {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        try {
          const res = await fetch(`${apiUrl}/api/resume/increment-download`, {
            method: "POST",
            body: JSON.stringify({ session_id: sessionGuid, user_id: currentUserId }),
            headers: { "Content-Type": "application/json" }
          });
          if (res.ok) {
            const data = await res.json();
            const total = data.total_platform_downloads;
            if (total && total > 0 && total % 20 === 0) {
              setTimeout(() => setShowFeedback(true), 10000);
            }
          }
        } catch (e) {
          console.error("Feedback trigger failed", e);
        }
      }
    } catch (error) {
      console.error("PDF generation failed:", error);
    } finally {
      setDownloadingPDF(false);
    }
  };

  if (loading || !resume) {
    return (
      <div suppressHydrationWarning className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto mb-6"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 animate-pulse">
                <path d="M18 2L32 10V26L18 34L4 26V10L18 2Z" fill="url(#hex-grad-loading)" stroke="rgba(0,104,89,0.3)" strokeWidth="0.8" />
                <defs>
                  <linearGradient id="hex-grad-loading" x1="4" y1="2" x2="32" y2="34" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#006859" />
                    <stop offset="1" stopColor="#12f8d7" />
                  </linearGradient>
                </defs>
                <path d="M20 8L13 20h6l-1 8 8-12h-6l1-8z" fill="white" fillOpacity="0.95" transform="translate(-1.5, 0)" />
              </svg>
            </div>
          </div>
          <p className="text-on-surface-variant font-medium">Loading your resume...</p>
        </div>
      </div>
    );
  }

  const scoreImprovement = resume.ats_score_after - resume.ats_score_before;

  return (
    <div className="min-h-[100dvh] lg:h-[100dvh] flex flex-col bg-surface font-sans lg:overflow-hidden overflow-y-auto">
      {/* Top App Bar - Fixed non-scrolling */}
      <header className="flex-shrink-0 z-50 bg-surface border-b border-surface-container-low shadow-sm">
        <div className="w-full px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" title="Back to Home" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="relative flex items-center justify-center w-9 h-9">
                <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                  <path d="M18 2L32 10V26L18 34L4 26V10L18 2Z" fill="url(#hex-grad-result)" stroke="rgba(0,104,89,0.3)" strokeWidth="0.8" />
                  <defs>
                    <linearGradient id="hex-grad-result" x1="4" y1="2" x2="32" y2="34" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#006859" />
                      <stop offset="1" stopColor="#12f8d7" />
                    </linearGradient>
                  </defs>
                  <path d="M20 8L13 20h6l-1 8 8-12h-6l1-8z" fill="white" fillOpacity="0.95" transform="translate(-1.5, 0)" />
                </svg>
              </div>
            </a>
            <div>
              <h1 className="font-headline text-lg font-bold text-on-background leading-tight">Your Resume</h1>
              <p className="text-xs text-on-surface-variant leading-tight flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-primary" /> AI-Optimized with {activeModelName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <AnimatePresence>
              {hasUnsavedChanges && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={handleSaveChanges}
                  className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-green-500 text-white font-semibold hover:bg-green-600 transition-all shadow-md text-sm"
                  title="Save changes"
                >
                  <Save className="w-4 h-4" />
                  <span className="hidden sm:inline">Save</span>
                </motion.button>
              )}
            </AnimatePresence>



            <button
              onClick={handleStartOver}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold text-on-surface-variant bg-surface-container-low hover:bg-surface-container-high transition-colors"
            >
              <Home className="w-4 h-4" />
              Start Over
            </button>

            <button
              onClick={() => {
                if (hasPaidAccess) {
                  handleDownloadPDF();
                } else {
                  setPricingTrigger("download");
                  setShowPricingPopup(true);
                }
              }}
              disabled={downloadingPDF || checkingAccess}
              className={`flex items-center gap-2 px-4 py-1.5 sm:px-5 sm:py-2 rounded-xl text-sm font-bold text-white transition-all shadow-sm ${downloadingPDF || checkingAccess
                ? "bg-surface-container-high cursor-not-allowed"
                : hasPaidAccess
                  ? "bg-primary hover:bg-primary/90"
                  : "bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                }`}
            >
              {checkingAccess ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                </>
              ) : downloadingPDF ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span className="hidden sm:inline">Wait...</span>
                </>
              ) : hasPaidAccess ? (
                <>
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Download</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Download PDF</span>
                </>
              )}
            </button>

            {/* Account Details Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                className="w-10 h-10 rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-colors flex items-center justify-center relative shadow-sm"
              >
                <User className="w-5 h-5 text-on-surface-variant" />
                {credits < 10 && <span className="absolute top-0 right-0 w-3 h-3 bg-error rounded-full border-2 border-surface"></span>}
              </button>

              <AnimatePresence>
                {showAccountDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-72 bg-surface border border-surface-container-high rounded-2xl shadow-2xl overflow-hidden z-50"
                  >
                    <div className="p-4 border-b border-surface-container-low bg-surface-container-lowest">
                      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Account</p>
                      <p className="text-sm text-on-background truncate font-medium">{userEmail || "Not logged in"}</p>
                    </div>

                    {userEmail ? (
                      <div className="p-4 space-y-4">
                        <div className="flex justify-between items-center bg-primary/10 px-3 py-2 rounded-xl border border-primary/20">
                          <span className="text-sm font-semibold text-primary">Credits</span>
                          <span className="text-lg font-black text-primary">{credits}</span>
                        </div>

                        {subscriptionData && (
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-on-surface-variant">Active Plan</p>
                            <p className="text-sm text-on-background capitalize">{subscriptionData.plan_type.replace('_', ' ')}</p>
                            {subscriptionData.expires_at && (
                              <p className="text-xs text-on-surface-variant">
                                Expires: {new Date(subscriptionData.expires_at).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        )}

                        <button
                          onClick={() => {
                            setShowAccountDropdown(false);
                            setPricingTrigger("buy_more");
                            setShowPricingPopup(true);
                          }}
                          className="w-full py-2.5 bg-surface-container-low hover:bg-surface-container-high text-on-background text-sm font-bold rounded-xl transition-colors"
                        >
                          Buy More Credits
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 text-center">
                        <p className="text-sm text-on-surface-variant mb-3">Log in to view credits</p>
                        <button
                          onClick={() => {
                            setShowAccountDropdown(false);
                            setShowPricingPopup(true);
                          }}
                          className="w-full py-2 bg-primary text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity"
                        >
                          Log In
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile PDF Preview — shown only on small screens */}
      <div className="lg:hidden w-full flex flex-col bg-surface-container-lowest border-b border-surface-container-low">
        <button
          onClick={() => setShowMobilePreview(!showMobilePreview)}
          className="flex items-center justify-between px-4 py-3 bg-surface-container-low/80 backdrop-blur-sm"
        >
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-on-background">Live Preview</span>
          </div>
          <motion.div animate={{ rotate: showMobilePreview ? 180 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}>
            <ChevronDown className="w-4 h-4 text-on-surface-variant" />
          </motion.div>
        </button>

        <AnimatePresence initial={false}>
          {showMobilePreview && (
            <motion.div
              key="mobile-preview"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30, opacity: { duration: 0.2 } }}
              className="overflow-hidden"
            >
              <div className="relative bg-[#0c0f12] border-y border-surface-container-low flex flex-col items-center pb-6">
                {/* Template + Highlight controls */}
                <div className="w-full flex justify-end px-4 pt-4 pb-4">
                  <div className="flex bg-surface/90 backdrop-blur-md rounded-xl shadow-lg border border-primary/20 overflow-hidden">
                    <button onClick={() => setSelectedTemplate("templateLetter")} className={`px-3 py-2 text-[11px] font-bold transition-colors ${selectedTemplate === "templateLetter" ? "bg-primary text-white" : "text-on-surface-variant hover:bg-surface-container"}`}>T1</button>
                    <div className="w-[1px] bg-primary/20"></div>
                    <button onClick={() => setSelectedTemplate("templateA4")} className={`px-3 py-2 text-[11px] font-bold transition-colors ${selectedTemplate === "templateA4" ? "bg-primary text-white" : "text-on-surface-variant hover:bg-surface-container"}`}>T2</button>
                  </div>
                </div>

                <div className="w-full px-4 flex justify-center">
                  <div
                    className="relative bg-white shadow-2xl rounded-sm ring-1 ring-white/20 transition-all duration-300"
                    style={{
                      width: "100%",
                      maxWidth: selectedTemplate === "templateLetter" ? "calc((85vh - 6rem) * 0.707)" : "calc((85vh - 6rem) * 0.774)",
                    }}
                  >
                    <MobilePDFPreview
                      key={`mobile-${selectedTemplate}`}
                      refreshKey={JSON.stringify({ resume, showHighlights, matchedKeywords, missingKeywords })}
                    >
                      {selectedTemplate === "templateLetter" ? (
                        <ResumePDFTemplateLetter resume={resume} showHighlights={showHighlights} matchedKeywords={matchedKeywords} missingKeywords={missingKeywords} />
                      ) : (
                        <ResumePDFTemplateA4 resume={resume} showHighlights={showHighlights} matchedKeywords={matchedKeywords} missingKeywords={missingKeywords} />
                      )}
                    </MobilePDFPreview>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 lg:overflow-hidden flex flex-col lg:flex-row relative">

        {/* Left Column (Editor & Metrics) */}
        <div className="dark-theme-override text-on-background w-full lg:w-[45%] flex-1 lg:h-full flex flex-col bg-surface border-r border-surface-container-low z-10 shadow-xl lg:shadow-none transition-all relative">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0c0f12] to-[#151a1e] pointer-events-none -z-10" />

          {/* Segmented Toggles inside Sticky Top */}
          <div className="flex-shrink-0 bg-surface/95 backdrop-blur-md p-4 border-b border-surface-container-low flex flex-col gap-3 py-4 sticky top-0 z-20">
            <div className="flex gap-2">
              <button
                onClick={() => { setEditMode(true); setShowChanges(false); setShowMissedKeywords(false); }}
                className={`relative flex-1 py-3 px-3 text-sm font-bold transition-all duration-200 rounded-2xl flex items-center justify-center gap-2 active:scale-95 ${editMode
                  ? "bg-primary text-white shadow-lg shadow-primary/30 border border-primary"
                  : "bg-surface-container-low text-on-surface-variant border border-surface-container-high hover:bg-surface-container-high hover:text-on-background"
                  }`}
              >
                <Edit3 className={`w-4 h-4 ${editMode ? 'text-white' : 'text-on-surface-variant'}`} />
                Edit Form
                {hasUnsavedChanges && !editMode && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                )}
              </button>
              <button
                onClick={() => { setShowChanges(true); setEditMode(false); setShowMissedKeywords(false); }}
                className={`flex-1 py-3 px-3 text-sm font-bold transition-all duration-200 rounded-2xl flex items-center justify-center gap-2 active:scale-95 ${showChanges
                  ? "bg-secondary text-white shadow-lg shadow-secondary/30 border border-secondary"
                  : "bg-surface-container-low text-on-surface-variant border border-surface-container-high hover:bg-surface-container-high hover:text-on-background"
                  }`}
              >
                <Sparkles className={`w-4 h-4 ${showChanges ? 'text-white' : 'text-on-surface-variant'}`} />
                AI Changes
              </button>
              {!noJdMode && (
                <button
                  onClick={() => { setShowMissedKeywords(true); setEditMode(false); setShowChanges(false); }}
                  className={`relative flex-1 py-3 px-3 text-sm font-bold transition-all duration-200 rounded-2xl flex items-center justify-center gap-2 active:scale-95 ${showMissedKeywords
                    ? "bg-error text-white shadow-lg shadow-error/30 border border-error"
                    : "bg-surface-container-low text-on-surface-variant border border-surface-container-high hover:bg-surface-container-high hover:text-on-background"
                    }`}
                >
                  <Zap className={`w-4 h-4 ${showMissedKeywords ? 'text-white' : 'text-on-surface-variant'}`} />
                  Keywords
                  {missingKeywords.length > 0 && !showMissedKeywords && (
                    <span className="absolute -top-1.5 -right-1.5 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-white shadow-md ring-2 ring-surface">{missingKeywords.length}</span>
                  )}
                </button>
              )}
            </div>

            {/* ATS Score Context Mini-Banner (When changes are shown) */}
            <AnimatePresence>
              {showChanges && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: '0.5rem' }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center justify-between bg-primary-container/20 border border-primary/20 px-5 py-3 rounded-xl shadow-sm">
                    {noJdMode ? (
                      <div className="flex items-center justify-center w-full gap-3 py-1">
                        <TrendingUp className="w-5 h-5 text-primary animate-pulse" />
                        <span className="font-bold text-primary text-sm uppercase tracking-wider">ATS formatting score after optimization:</span>
                        <span className="text-2xl font-black text-primary">100%</span>
                      </div>
                    ) : (
                      <>
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Before</p>
                          <p className="text-xl font-black text-on-surface-variant">{resume.ats_score_before}</p>
                        </div>
                        <div className="flex flex-col items-center flex-1 px-4">
                          <TrendingUp className="w-5 h-5 text-primary mb-1 animate-pulse" />
                        </div>
                        <div className="text-center relative">
                          <p className="text-[10px] font-bold text-primary uppercase tracking-wider">After</p>
                          <p className="text-xl font-black text-primary">{resume.ats_score_after}</p>
                        </div>
                        <div className="ml-4 bg-primary text-white px-3 py-1 rounded-lg text-sm font-bold shadow-sm whitespace-nowrap">
                          +{scoreImprovement} Points
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Scrollable Panel Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:px-8 lg:py-6 pb-24 hide-scrollbar">
            <AnimatePresence mode="wait">
              {editMode && (
                <motion.div
                  key="edit-form"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="w-full max-w-4xl mx-auto space-y-6"
                >

                  {/* Drag Drop Section Reordering — insertion-line style */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="soothing-light-theme text-on-background bg-surface-container-lowest rounded-xl p-4 shadow-md border border-primary/10"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleSectionDrop}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-headline font-bold text-on-background text-sm">Reorder Sections</h3>
                      <span className="text-xs text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">Drag to reorder</span>
                    </div>
                    <div className="flex flex-col">
                      {(resume.section_order || []).map((sectionId, index) => {
                        const getSectionMeta = (sId: string) => {
                          if (SECTION_LABELS[sId]) return SECTION_LABELS[sId];
                          if (sId.startsWith("custom_")) {
                            const customSection = resume.custom_sections?.find(s => s.id === sId);
                            return {
                              label: customSection?.heading || "Custom Section",
                              icon: <FileText className="w-4 h-4 text-primary" />
                            };
                          }
                          return null;
                        };
                        const sectionMeta = getSectionMeta(sectionId);
                        if (!sectionMeta) return null;
                        const isDragging = draggingId === sectionId;
                        const order = resume.section_order || [];
                        const showLineAbove = insertionIndex === index && draggingId !== null &&
                          draggingId !== sectionId &&
                          (index === 0 || order[index - 1] !== draggingId);
                        const showLineBelow = insertionIndex === index + 1 && draggingId !== null &&
                          draggingId !== sectionId &&
                          (index === order.length - 1 || order[index + 1] !== draggingId);
                        return (
                          <div key={sectionId} className="relative">
                            {/* Blue insertion line ABOVE */}
                            <div className={`h-[3px] rounded-full mx-1 transition-all duration-100 ${showLineAbove ? "bg-primary shadow-md mb-1" : "bg-transparent mb-0"
                              }`} />
                            <div
                              draggable
                              onDragStart={(e) => handleSectionDragStart(e, sectionId)}
                              onDragEnter={(e) => handleSectionDragEnter(e, index, sectionId)}
                              onDragOver={(e) => handleSectionDragOver(e, index, sectionId)}
                              onDragEnd={handleSectionDragEnd}
                              className={`flex items-center gap-3 px-3 py-1.5 rounded-xl cursor-grab active:cursor-grabbing transition-all duration-150 shadow-sm select-none mb-1 ${isDragging
                                ? "opacity-25 scale-[0.97] bg-surface-container-high border-2 border-dashed border-primary/30"
                                : "bg-surface-container border-2 border-transparent hover:border-primary/20 hover:shadow-md"
                                }`}
                            >
                              <GripVertical className="text-on-surface-variant/40 w-4 h-4 flex-shrink-0" />
                              <div className="flex items-center gap-2 flex-1">
                                <div className="w-6 h-6 rounded-md bg-surface-container-highest flex items-center justify-center">
                                  {sectionMeta.icon}
                                </div>
                                <span className="font-semibold text-on-background text-sm">{sectionMeta.label}</span>
                              </div>
                              <span className="text-xs text-on-surface-variant/30 font-mono tabular-nums">{index + 1}</span>
                            </div>
                            {/* Blue insertion line BELOW (only for last item) */}
                            {showLineBelow && (
                              <div className="h-[3px] rounded-full mx-1 bg-primary shadow-md mt-0 mb-1" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>

                  {/* Heading Section */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    whileHover={{ y: -4 }}
                    className="soothing-light-theme text-on-background bg-surface-container-lowest rounded-[2rem] p-8 shadow-xl hover:shadow-2xl transition-all duration-300 border border-primary/5"
                  >
                    <div
                      className={`flex items-center justify-between ${editMode ? 'cursor-pointer hover:opacity-80 transition-opacity mb-4' : 'mb-6'}`}
                      onClick={() => editMode && setOpenEditSection(openEditSection === "contact" ? "" : "contact")}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-primary-container/20 flex items-center justify-center">
                          <FileText className="w-6 h-6 text-primary" />
                        </div>
                        <h3 className="font-headline text-2xl font-bold text-on-background">Contact Information</h3>
                      </div>
                      {editMode && (
                        <motion.div className="p-2 hover:bg-surface-container rounded-full transition-colors" animate={{ rotate: openEditSection === "contact" ? 180 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}>
                          <ChevronDown className="w-5 h-5 text-on-surface-variant" />
                        </motion.div>
                      )}
                    </div>

                    <AnimatePresence initial={false}>
                      {(!editMode || openEditSection === "contact") && (
                        <motion.div
                          key="contact-content"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 300, damping: 30, opacity: { duration: 0.2 } }}
                          className="overflow-hidden"
                        >
                          {editMode ? (
                            <div className="space-y-3">
                              <input
                                type="text"
                                value={resume.heading.name}
                                onChange={(e) => updateResume({ heading: { ...resume.heading, name: e.target.value } })}
                                className="w-full text-2xl font-bold text-on-background rounded-xl px-4 py-3 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm"
                                placeholder="Full Name"
                              />
                              <input
                                type="tel"
                                value={resume.heading.phone}
                                onChange={(e) => updateResume({ heading: { ...resume.heading, phone: e.target.value } })}
                                className="w-full rounded-xl px-4 py-3 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm"
                                placeholder="Phone"
                              />
                              <input
                                type="email"
                                value={resume.heading.email}
                                onChange={(e) => updateResume({ heading: { ...resume.heading, email: e.target.value } })}
                                className="w-full rounded-xl px-4 py-3 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm"
                                placeholder="Email"
                              />
                              {/* LinkedIn: display text + actual URL */}
                              <p className="text-xs text-on-surface-variant font-semibold uppercase tracking-wide">LinkedIn</p>
                              <input
                                type="text"
                                value={cleanDisplayUrl(resume.heading.linkedin_url, "linkedin")}
                                onChange={(e) => updateResume({ heading: { ...resume.heading, linkedin_url: e.target.value } })}
                                className="w-full rounded-xl px-4 py-3 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm"
                                placeholder="linkedin"
                              />
                              <input
                                type="url"
                                value={resume.heading.linkedin_url_href || "https://linkedin.com/in/username"}
                                onChange={(e) => updateResume({ heading: { ...resume.heading, linkedin_url_href: e.target.value } })}
                                className="w-full rounded-xl px-4 py-3 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm text-on-surface-variant"
                                placeholder="https://linkedin.com/in/username"
                              />
                              {/* GitHub: display text + actual URL */}
                              <p className="text-xs text-on-surface-variant font-semibold uppercase tracking-wide">GitHub</p>
                              <input
                                type="text"
                                value={cleanDisplayUrl(resume.heading.github_url, "github.com/username")}
                                onChange={(e) => updateResume({ heading: { ...resume.heading, github_url: e.target.value } })}
                                className="w-full rounded-xl px-4 py-3 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm"
                                placeholder="github.com/username"
                              />
                              <input
                                type="url"
                                value={resume.heading.github_url_href || "https://github.com/username"}
                                onChange={(e) => updateResume({ heading: { ...resume.heading, github_url_href: e.target.value } })}
                                className="w-full rounded-xl px-4 py-3 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm text-on-surface-variant"
                                placeholder="https://github.com/username"
                              />
                            </div>
                          ) : (
                            <>
                              <h2 className="text-3xl font-bold text-on-background mb-4">
                                {resume.heading.name}
                              </h2>
                              <div className="space-y-2 text-on-surface-variant">
                                <p className="flex items-center gap-2">
                                  <span className="w-5 h-5">📞</span> {resume.heading.phone}
                                </p>
                                <p className="flex items-center gap-2">
                                  <span className="w-5 h-5">📧</span> {resume.heading.email}
                                </p>
                                <p className="flex items-center gap-2">
                                  <span className="w-5 h-5">🔗</span>
                                  <a
                                    href={resume.heading.linkedin_url_href || `https://${cleanDisplayUrl(resume.heading.linkedin_url, "linkedin.com/in/username")}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                  >
                                    {cleanDisplayUrl(resume.heading.linkedin_url, "linkedin")}
                                  </a>
                                </p>
                                <p className="flex items-center gap-2">
                                  <span className="w-5 h-5">💻</span>
                                  <a
                                    href={resume.heading.github_url_href || `https://${cleanDisplayUrl(resume.heading.github_url, "github.com/username")}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                  >
                                    {cleanDisplayUrl(resume.heading.github_url, "github.com/username")}
                                  </a>
                                </p>
                              </div>
                            </>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* Section cards rendered in section_order sequence — mirrors PDF exactly */}
                  {(resume.section_order || ["summary", "education", "experience", "projects", "skills", "certifications"]).map((sectionId) => {
                    if (sectionId.startsWith("custom_")) {
                      const customIndex = resume.custom_sections?.findIndex(s => s.id === sectionId) ?? -1;
                      const customSection = customIndex >= 0 ? resume.custom_sections![customIndex] : null;
                      if (!customSection) return null;

                      return (
                        <motion.div
                          layout
                          key={sectionId}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          whileHover={{ y: -4 }}
                          className="soothing-light-theme text-on-background bg-surface-container-lowest rounded-[2rem] p-8 shadow-xl hover:shadow-2xl transition-all duration-300 border border-primary/5"
                        >
                          <div
                            className={`flex items-center justify-between ${editMode ? 'cursor-pointer hover:opacity-80 transition-opacity mb-4' : 'mb-6'}`}
                            onClick={() => editMode && setOpenEditSection(openEditSection === sectionId ? "" : sectionId)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-2xl bg-primary-container/20 flex items-center justify-center">
                                <FileText className="w-6 h-6 text-primary" />
                              </div>
                              {editMode && openEditSection === sectionId ? (
                                <input
                                  type="text"
                                  value={customSection.heading}
                                  onChange={(e) => {
                                    const newCustoms = [...(resume.custom_sections || [])];
                                    newCustoms[customIndex].heading = e.target.value;
                                    updateResume({ custom_sections: newCustoms });
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="font-headline text-2xl font-bold rounded-xl px-4 py-2 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm w-full"
                                  placeholder="Section Heading"
                                />
                              ) : (
                                <h3 className="font-headline text-2xl font-bold text-on-background">{customSection.heading || "Custom Section"}</h3>
                              )}
                            </div>
                            {editMode && (
                              <motion.div className="p-2 hover:bg-surface-container rounded-full transition-colors flex-shrink-0" animate={{ rotate: openEditSection === sectionId ? 180 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}>
                                <ChevronDown className="w-5 h-5 text-on-surface-variant" />
                              </motion.div>
                            )}
                          </div>

                          <AnimatePresence initial={false}>
                            {(!editMode || openEditSection === sectionId) && (
                              <motion.div
                                key={`${sectionId}-content`}
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 30, opacity: { duration: 0.2 } }}
                                className="overflow-hidden"
                              >

                                <ul className="space-y-2">
                                  {(customSection.bullets ?? []).map((bulletObj, bidx) => (
                                    <li key={bidx} className="text-on-background text-sm flex items-start gap-3 rounded-lg p-3 transition-all">
                                      <span className="text-primary mt-1 font-bold">•</span>
                                      {editMode ? (
                                        <div className="flex-1 flex gap-2 items-start">
                                          <textarea
                                            value={typeof bulletObj === 'string' ? bulletObj : bulletObj.text}
                                            onChange={(e) => {
                                              const newCustoms = [...(resume.custom_sections || [])];
                                              if (typeof newCustoms[customIndex].bullets![bidx] === 'string') {
                                                newCustoms[customIndex].bullets![bidx] = { text: e.target.value };
                                              } else {
                                                (newCustoms[customIndex].bullets![bidx] as any).text = e.target.value;
                                              }
                                              updateResume({ custom_sections: newCustoms });
                                            }}
                                            className="flex-[2] rounded-lg px-3 py-2 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm resize-none"
                                            rows={2}
                                            placeholder="Bullet text..."
                                          />
                                          <input
                                            type="url"
                                            value={typeof bulletObj === 'string' ? '' : (bulletObj.url || '')}
                                            onChange={(e) => {
                                              const newCustoms = [...(resume.custom_sections || [])];
                                              if (typeof newCustoms[customIndex].bullets![bidx] === 'string') {
                                                newCustoms[customIndex].bullets![bidx] = { text: newCustoms[customIndex].bullets![bidx] as string, url: e.target.value };
                                              } else {
                                                (newCustoms[customIndex].bullets![bidx] as any).url = e.target.value;
                                              }
                                              updateResume({ custom_sections: newCustoms });
                                            }}
                                            className="flex-[1] text-xs rounded-lg px-3 py-2 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm"
                                            placeholder="Behind URL (e.g., LeetCode)"
                                          />
                                        </div>
                                      ) : (
                                        <span className="flex-1">
                                          {(typeof bulletObj !== 'string' && bulletObj.url) ? (
                                            <a href={bulletObj.url.startsWith('http') ? bulletObj.url : `https://${bulletObj.url}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                                              {bulletObj.text}
                                            </a>
                                          ) : (
                                            typeof bulletObj === 'string' ? bulletObj : bulletObj.text
                                          )}
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>

                                {editMode && (
                                  <div className="flex justify-between items-center mt-3">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newCustoms = [...(resume.custom_sections || [])];
                                        if (!newCustoms[customIndex].bullets) newCustoms[customIndex].bullets = [];
                                        newCustoms[customIndex].bullets!.push({ text: '', url: '' });
                                        updateResume({ custom_sections: newCustoms });
                                      }}
                                      className="px-3 py-1 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors font-semibold"
                                    >
                                      + Add Bullet Point
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newCustoms = (resume.custom_sections || []).filter((_, i) => i !== customIndex);
                                        const newOrder = (resume.section_order || []).filter(id => id !== sectionId);
                                        updateResume({ custom_sections: newCustoms, section_order: newOrder });
                                      }}
                                      className="px-3 py-1 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors font-semibold"
                                    >
                                      Remove Section
                                    </button>
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    }

                    switch (sectionId) {

                      case "summary":
                        if (!resume.summary && !editMode) return null;
                        return (
                          <motion.div
                            layout
                            key="edit-summary"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ y: -4 }}
                            className="soothing-light-theme text-on-background bg-surface-container-lowest rounded-[2rem] p-8 shadow-xl hover:shadow-2xl transition-all duration-300 border border-primary/5"
                          >
                            <div
                              className={`flex items-center justify-between ${editMode ? 'cursor-pointer hover:opacity-80 transition-opacity mb-4' : 'mb-6'}`}
                              onClick={() => editMode && setOpenEditSection(openEditSection === "summary" ? "" : "summary")}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-primary-container/20 flex items-center justify-center">
                                  <Zap className="w-6 h-6 text-primary" />
                                </div>
                                <h3 className="font-headline text-2xl font-bold text-on-background">Summary</h3>
                              </div>
                              {editMode && (
                                <motion.div className="p-2 hover:bg-surface-container rounded-full transition-colors" animate={{ rotate: openEditSection === "summary" ? 180 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}>
                                  <ChevronDown className="w-5 h-5 text-on-surface-variant" />
                                </motion.div>
                              )}
                            </div>

                            <AnimatePresence initial={false}>
                              {(!editMode || openEditSection === "summary") && (
                                <motion.div
                                  key="summary-content"
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ type: "spring", stiffness: 300, damping: 30, opacity: { duration: 0.2 } }}
                                  className="overflow-hidden"
                                >
                                  <>
                                    {editMode ? (
                                      <textarea
                                        value={resume.summary || ''}
                                        onChange={(e) => updateResume({ summary: e.target.value })}
                                        className="w-full rounded-xl px-4 py-3 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm resize-none"
                                        rows={3}
                                        placeholder="Professional summary..."
                                      />
                                    ) : (
                                      <p className="text-on-background leading-relaxed">{resume.summary}</p>
                                    )}
                                  </>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );

                      case "education":
                        if (!editMode && (!resume.education || resume.education.length === 0)) return null;
                        return (
                          <motion.div
                            layout
                            key="edit-education"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ y: -4 }}
                            className="soothing-light-theme text-on-background bg-surface-container-lowest rounded-[2rem] p-8 shadow-xl hover:shadow-2xl transition-all duration-300 border border-primary/5"
                          >
                            <div
                              className={`flex items-center justify-between ${editMode ? 'cursor-pointer hover:opacity-80 transition-opacity mb-4' : 'mb-6'}`}
                              onClick={() => editMode && setOpenEditSection(openEditSection === "education" ? "" : "education")}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-secondary-container/20 flex items-center justify-center">
                                  <GraduationCap className="w-6 h-6 text-secondary-container" />
                                </div>
                                <h3 className="font-headline text-2xl font-bold text-on-background">Education</h3>
                              </div>
                              {editMode && (
                                <motion.div className="p-2 hover:bg-surface-container rounded-full transition-colors" animate={{ rotate: openEditSection === "education" ? 180 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}>
                                  <ChevronDown className="w-5 h-5 text-on-surface-variant" />
                                </motion.div>
                              )}
                            </div>

                            <AnimatePresence initial={false}>
                              {(!editMode || openEditSection === "education") && (
                                <motion.div
                                  key="education-content"
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ type: "spring", stiffness: 300, damping: 30, opacity: { duration: 0.2 } }}
                                  className="overflow-hidden"
                                >
                                  <>
                                    {resume.education.map((edu, idx) => (
                                      <div key={idx} className="mb-6 last:mb-0">
                                        {editMode ? (
                                          <div className="space-y-2">
                                            <input
                                              type="text"
                                              value={edu.degree || ''}
                                              onChange={(e) => {
                                                const newEducation = [...resume.education];
                                                newEducation[idx].degree = e.target.value;
                                                updateResume({ education: newEducation });
                                              }}
                                              className="w-full font-bold rounded-xl px-4 py-2 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm"
                                              placeholder="Degree"
                                            />
                                            <input
                                              type="text"
                                              value={edu.institution || ''}
                                              onChange={(e) => {
                                                const newEducation = [...resume.education];
                                                newEducation[idx].institution = e.target.value;
                                                updateResume({ education: newEducation });
                                              }}
                                              className="w-full rounded-xl px-4 py-2 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm"
                                              placeholder="Institution"
                                            />
                                            <div className="grid grid-cols-2 gap-2">
                                              <input
                                                type="text"
                                                value={edu.location || ''}
                                                onChange={(e) => {
                                                  const newEducation = [...resume.education];
                                                  newEducation[idx].location = e.target.value;
                                                  updateResume({ education: newEducation });
                                                }}
                                                className="rounded-xl px-4 py-2 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm"
                                                placeholder="Location"
                                              />
                                              <input
                                                type="text"
                                                value={edu.duration || ''}
                                                onChange={(e) => {
                                                  const newEducation = [...resume.education];
                                                  newEducation[idx].duration = e.target.value;
                                                  updateResume({ education: newEducation });
                                                }}
                                                className="rounded-xl px-4 py-2 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm"
                                                placeholder="Duration"
                                              />
                                            </div>
                                            <div className="flex justify-between items-center mt-2">
                                              <input
                                                type="text"
                                                value={edu.cgpa || ''}
                                                onChange={(e) => {
                                                  const newEducation = [...resume.education];
                                                  newEducation[idx].cgpa = e.target.value;
                                                  updateResume({ education: newEducation });
                                                }}
                                                className="flex-1 rounded-xl px-4 py-2 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm mr-4"
                                                placeholder="CGPA / Score"
                                              />
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const newEducation = resume.education.filter((_, i) => i !== idx);
                                                  updateResume({ education: newEducation });
                                                }}
                                                className="px-3 py-1 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors font-semibold"
                                              >
                                                Remove
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <>
                                            <p className="font-bold text-lg text-on-background">{edu.degree}</p>
                                            <p className="text-on-surface-variant">{edu.institution}, {edu.location}</p>
                                            <p className="text-sm text-on-surface-variant">{edu.duration}{edu.cgpa ? ` • CGPA: ${edu.cgpa}` : ''}</p>
                                          </>
                                        )}
                                      </div>
                                    ))}
                                    {editMode && (
                                      <div className="mt-4 flex justify-center">
                                        <button
                                          onClick={() => {
                                            const newEducation = [...resume.education, { institution: '', location: '', degree: '', duration: '', cgpa: '' }];
                                            updateResume({ education: newEducation });
                                          }}
                                          className="px-4 py-2 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary/20 transition-colors"
                                          type="button"
                                        >
                                          + Add Education Field
                                        </button>
                                      </div>
                                    )}
                                  </>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );

                      case "experience":
                        if (!editMode && (!resume.experience || resume.experience.length === 0)) return null;
                        return (
                          <motion.div
                            layout
                            key="edit-experience"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ y: -4 }}
                            className="soothing-light-theme text-on-background bg-surface-container-lowest rounded-[2rem] p-8 shadow-xl hover:shadow-2xl transition-all duration-300 border border-primary/5"
                          >
                            <div
                              className={`flex items-center justify-between ${editMode ? 'cursor-pointer hover:opacity-80 transition-opacity mb-4' : 'mb-6'}`}
                              onClick={() => editMode && setOpenEditSection(openEditSection === "experience" ? "" : "experience")}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-tertiary-container/20 flex items-center justify-center">
                                  <Briefcase className="w-6 h-6 text-tertiary-container" />
                                </div>
                                <h3 className="font-headline text-2xl font-bold text-on-background">Experience</h3>
                              </div>
                              {editMode && (
                                <motion.div className="p-2 hover:bg-surface-container rounded-full transition-colors" animate={{ rotate: openEditSection === "experience" ? 180 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}>
                                  <ChevronDown className="w-5 h-5 text-on-surface-variant" />
                                </motion.div>
                              )}
                            </div>

                            <AnimatePresence initial={false}>
                              {(!editMode || openEditSection === "experience") && (
                                <motion.div
                                  key="experience-content"
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ type: "spring", stiffness: 300, damping: 30, opacity: { duration: 0.2 } }}
                                  className="overflow-hidden"
                                >
                                  <>

                                    {resume.experience.map((exp, idx) => (
                                      <div key={idx} className="mb-8 last:mb-0">
                                        {editMode ? (
                                          <div className="space-y-2 mb-4">
                                            <input
                                              type="text"
                                              value={exp.job_title || ''}
                                              onChange={(e) => {
                                                const newExperience = [...resume.experience];
                                                newExperience[idx].job_title = e.target.value;
                                                updateResume({ experience: newExperience });
                                              }}
                                              className="w-full font-bold rounded-xl px-4 py-2 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm"
                                              placeholder="Job Title"
                                            />
                                            <input
                                              type="text"
                                              value={exp.company || ''}
                                              onChange={(e) => {
                                                const newExperience = [...resume.experience];
                                                newExperience[idx].company = e.target.value;
                                                updateResume({ experience: newExperience });
                                              }}
                                              className="w-full rounded-xl px-4 py-2 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm"
                                              placeholder="Company"
                                            />
                                            <div className="grid grid-cols-2 gap-2">
                                              <input
                                                type="text"
                                                value={exp.duration || ''}
                                                onChange={(e) => {
                                                  const newExperience = [...resume.experience];
                                                  newExperience[idx].duration = e.target.value;
                                                  updateResume({ experience: newExperience });
                                                }}
                                                className="text-sm rounded-xl px-4 py-2 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm"
                                                placeholder="Duration"
                                              />
                                              <input
                                                type="text"
                                                value={exp.location || ''}
                                                onChange={(e) => {
                                                  const newExperience = [...resume.experience];
                                                  newExperience[idx].location = e.target.value;
                                                  updateResume({ experience: newExperience });
                                                }}
                                                className="text-sm rounded-xl px-4 py-2 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm"
                                                placeholder="Location"
                                              />
                                            </div>
                                          </div>
                                        ) : (
                                          <>
                                            <p className="font-bold text-lg text-on-background">{exp.job_title}</p>
                                            <p className="text-on-surface-variant">{exp.company}</p>
                                            <p className="text-sm text-on-surface-variant mb-3">{exp.duration}{exp.location && ` • ${exp.location}`}</p>
                                          </>
                                        )}
                                        <ul className="space-y-2">
                                          {exp.bullets.map((bullet, bidx) => {
                                            const isHighlighted = isBulletEnhanced(bullet, "Experience", resume.changes);
                                            const highlightClass = getHighlightClass(isHighlighted, showHighlights);

                                            return (
                                              <li key={bidx} className={`text-on-background text-sm flex items-start gap-3 ${highlightClass} rounded-lg p-3 transition-all`}>
                                                <span className="text-primary mt-1 font-bold">•</span>
                                                {editMode ? (
                                                  <textarea
                                                    value={bullet}
                                                    onChange={(e) => {
                                                      const newExperience = [...resume.experience];
                                                      newExperience[idx].bullets[bidx] = e.target.value;
                                                      updateResume({ experience: newExperience });
                                                    }}
                                                    className="flex-1 rounded-lg px-3 py-2 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm resize-none"
                                                    rows={2}
                                                  />
                                                ) : (
                                                  <span className="flex items-start gap-2 flex-1">
                                                    <span className="flex-1">{bullet}</span>
                                                    {showHighlights && isHighlighted && (
                                                      <Sparkles className="w-4 h-4 text-yellow-500 flex-shrink-0 animate-pulse" />
                                                    )}
                                                  </span>
                                                )}
                                              </li>
                                            );
                                          })}
                                        </ul>
                                        {editMode && (
                                          <div className="flex justify-between items-center mt-3">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const newExperience = [...resume.experience];
                                                newExperience[idx].bullets.push('');
                                                updateResume({ experience: newExperience });
                                              }}
                                              className="px-3 py-1 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors font-semibold"
                                            >
                                              + Add Bullet Point
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const newExperience = resume.experience.filter((_, i) => i !== idx);
                                                updateResume({ experience: newExperience });
                                              }}
                                              className="px-3 py-1 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors font-semibold"
                                            >
                                              Remove Experience
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                    {editMode && (
                                      <div className="mt-4 flex justify-center">
                                        <button
                                          onClick={() => {
                                            const newExperience = [...resume.experience, { job_title: '', company: '', location: '', duration: '', bullets: [''] }];
                                            updateResume({ experience: newExperience });
                                          }}
                                          className="px-4 py-2 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary/20 transition-colors"
                                          type="button"
                                        >
                                          + Add Experience
                                        </button>
                                      </div>
                                    )}
                                  </>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );

                      case "projects":
                        if (!editMode && (!resume.projects || resume.projects.length === 0)) return null;
                        return (
                          <motion.div
                            layout
                            key="edit-projects"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ y: -4 }}
                            className="soothing-light-theme text-on-background bg-surface-container-lowest rounded-[2rem] p-8 shadow-xl hover:shadow-2xl transition-all duration-300 border border-primary/5"
                          >
                            <div
                              className={`flex items-center justify-between ${editMode ? 'cursor-pointer hover:opacity-80 transition-opacity mb-4' : 'mb-6'}`}
                              onClick={() => editMode && setOpenEditSection(openEditSection === "projects" ? "" : "projects")}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-primary-container/20 flex items-center justify-center">
                                  <FolderGit2 className="w-6 h-6 text-primary" />
                                </div>
                                <h3 className="font-headline text-2xl font-bold text-on-background">Projects</h3>
                              </div>
                              {editMode && (
                                <motion.div className="p-2 hover:bg-surface-container rounded-full transition-colors" animate={{ rotate: openEditSection === "projects" ? 180 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}>
                                  <ChevronDown className="w-5 h-5 text-on-surface-variant" />
                                </motion.div>
                              )}
                            </div>

                            <AnimatePresence initial={false}>
                              {(!editMode || openEditSection === "projects") && (
                                <motion.div
                                  key="projects-content"
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ type: "spring", stiffness: 300, damping: 30, opacity: { duration: 0.2 } }}
                                  className="overflow-hidden"
                                >
                                  <>

                                    {resume.projects.map((proj, idx) => (
                                      <div key={idx} className="mb-8 last:mb-0">
                                        {editMode ? (
                                          <div className="space-y-2 mb-4">
                                            <div className="flex flex-col gap-3">
                                              <input
                                                type="text"
                                                value={proj.title}
                                                onChange={(e) => {
                                                  const newProjects = [...resume.projects];
                                                  newProjects[idx].title = e.target.value;
                                                  updateResume({ projects: newProjects });
                                                }}
                                                className="w-full font-bold rounded-xl px-4 py-2 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm"
                                                placeholder="Project Title"
                                              />
                                              <div className="flex gap-2">
                                                <input
                                                  type="text"
                                                  value={proj.link || ''}
                                                  onChange={(e) => {
                                                    const newProjects = [...resume.projects];
                                                    newProjects[idx].link = e.target.value;
                                                    updateResume({ projects: newProjects });
                                                  }}
                                                  className="flex-[1] text-sm rounded-xl px-4 py-2 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm"
                                                  placeholder="Display Text (Link/GitHub)"
                                                />
                                                <input
                                                  type="url"
                                                  value={proj.link_href || ''}
                                                  onChange={(e) => {
                                                    const newProjects = [...resume.projects];
                                                    newProjects[idx].link_href = e.target.value;
                                                    updateResume({ projects: newProjects });
                                                  }}
                                                  className="flex-[2] text-sm rounded-xl px-4 py-2 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm"
                                                  placeholder="Actual Repo URL"
                                                />
                                              </div>
                                            </div>
                                            <input
                                              type="text"
                                              value={proj.tech_stack}
                                              onChange={(e) => {
                                                const newProjects = [...resume.projects];
                                                newProjects[idx].tech_stack = e.target.value;
                                                updateResume({ projects: newProjects });
                                              }}
                                              className="w-full text-sm rounded-xl px-4 py-2 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm"
                                              placeholder="Tech Stack"
                                            />
                                          </div>
                                        ) : (
                                          <>
                                            <div className="flex justify-between items-start mb-2">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <p className="font-bold text-lg text-on-background">{proj.title}</p>
                                                {proj.tech_stack && (
                                                  <p className="text-sm text-on-surface-variant italic">
                                                    <span className="not-italic mr-2">|</span>{proj.tech_stack}
                                                  </p>
                                                )}
                                              </div>
                                              <a href={proj.link_href ? (proj.link_href.startsWith('http') ? proj.link_href : `https://${proj.link_href}`) : 'https://github.com/reponame'} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline ml-4 flex-shrink-0">
                                                {proj.link || 'Link'}
                                              </a>
                                            </div>
                                          </>
                                        )}
                                        <ul className="space-y-2">
                                          {proj.bullets.map((bullet, bidx) => {
                                            const isHighlighted = isBulletEnhanced(bullet, proj.title, resume.changes);
                                            const highlightClass = getHighlightClass(isHighlighted, showHighlights);

                                            return (
                                              <li key={bidx} className={`text-on-background text-sm flex items-start gap-3 ${highlightClass} rounded-lg p-3 transition-all`}>
                                                <span className="text-primary mt-1 font-bold">•</span>
                                                {editMode ? (
                                                  <textarea
                                                    value={bullet}
                                                    onChange={(e) => {
                                                      const newProjects = [...resume.projects];
                                                      newProjects[idx].bullets[bidx] = e.target.value;
                                                      updateResume({ projects: newProjects });
                                                    }}
                                                    className="flex-1 rounded-lg px-3 py-2 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm resize-none"
                                                    rows={2}
                                                  />
                                                ) : (
                                                  <span className="flex items-start gap-2 flex-1">
                                                    <span className="flex-1">{bullet}</span>
                                                    {showHighlights && isHighlighted && (
                                                      <Sparkles className="w-4 h-4 text-yellow-500 flex-shrink-0 animate-pulse" />
                                                    )}
                                                  </span>
                                                )}
                                              </li>
                                            );
                                          })}
                                        </ul>
                                        {editMode && (
                                          <div className="flex justify-between items-center mt-3">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const newProjects = [...resume.projects];
                                                newProjects[idx].bullets.push('');
                                                updateResume({ projects: newProjects });
                                              }}
                                              className="px-3 py-1 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors font-semibold"
                                            >
                                              + Add Bullet Point
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const newProjects = resume.projects.filter((_, i) => i !== idx);
                                                updateResume({ projects: newProjects });
                                              }}
                                              className="px-3 py-1 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors font-semibold"
                                            >
                                              Remove Project
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                    {editMode && (
                                      <div className="mt-4 flex justify-center">
                                        <button
                                          onClick={() => {
                                            const newProjects = [...resume.projects, { title: '', tech_stack: '', duration: '', link: '', link_href: '', bullets: [''] }];
                                            updateResume({ projects: newProjects });
                                          }}
                                          className="px-4 py-2 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary/20 transition-colors"
                                          type="button"
                                        >
                                          + Add Project
                                        </button>
                                      </div>
                                    )}
                                  </>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );

                      case "skills":
                        return (
                          <motion.div
                            layout
                            key="edit-skills"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ y: -4 }}
                            className="soothing-light-theme text-on-background bg-surface-container-lowest rounded-[2rem] p-8 shadow-xl hover:shadow-2xl transition-all duration-300 border border-primary/5"
                          >
                            <div
                              className={`flex items-center justify-between ${editMode ? 'cursor-pointer hover:opacity-80 transition-opacity mb-4' : 'mb-6'}`}
                              onClick={() => editMode && setOpenEditSection(openEditSection === "skills" ? "" : "skills")}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-secondary-container/20 flex items-center justify-center">
                                  <Code className="w-6 h-6 text-secondary-container" />
                                </div>
                                <h3 className="font-headline text-2xl font-bold text-on-background">Technical Skills</h3>
                              </div>
                              {editMode && (
                                <motion.div className="p-2 hover:bg-surface-container rounded-full transition-colors" animate={{ rotate: openEditSection === "skills" ? 180 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}>
                                  <ChevronDown className="w-5 h-5 text-on-surface-variant" />
                                </motion.div>
                              )}
                            </div>

                            <AnimatePresence initial={false}>
                              {(!editMode || openEditSection === "skills") && (
                                <motion.div
                                  key="skills-content"
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ type: "spring", stiffness: 300, damping: 30, opacity: { duration: 0.2 } }}
                                  className="overflow-hidden"
                                >
                                  <>

                                    <div className="space-y-4">
                                      {(editMode || resume.technical_skills.languages.length > 0) && (
                                        <div>
                                          <p className="font-semibold text-on-background mb-2">Languages:</p>
                                          <EditableSkillTags
                                            skills={resume.technical_skills.languages}
                                            onChange={(newSkills) =>
                                              updateResume({
                                                technical_skills: {
                                                  ...resume.technical_skills,
                                                  languages: newSkills,
                                                },
                                              })
                                            }
                                            editMode={editMode}
                                            colorClass="bg-primary-container/20 text-primary"
                                            highlightedSkills={resume.changes
                                              .filter((c) => c.toLowerCase().includes("languages"))
                                              .map((c) => {
                                                const match = c.match(/Added (.+?) to/i);
                                                return match ? match[1].toLowerCase() : "";
                                              })
                                              .filter(Boolean)}
                                            showHighlights={showHighlights}
                                          />
                                        </div>
                                      )}
                                      {(editMode || resume.technical_skills.frameworks_and_libraries.length > 0) && (
                                        <div>
                                          <p className="font-semibold text-on-background mb-2">Frameworks & Libraries:</p>
                                          <EditableSkillTags
                                            skills={resume.technical_skills.frameworks_and_libraries}
                                            onChange={(newSkills) =>
                                              updateResume({
                                                technical_skills: {
                                                  ...resume.technical_skills,
                                                  frameworks_and_libraries: newSkills,
                                                },
                                              })
                                            }
                                            editMode={editMode}
                                            colorClass="bg-secondary-container/20 text-secondary-container"
                                            highlightedSkills={resume.changes
                                              .filter((c) => c.toLowerCase().includes("frameworks"))
                                              .map((c) => {
                                                const match = c.match(/Added (.+?) to/i);
                                                return match ? match[1].toLowerCase() : "";
                                              })
                                              .filter(Boolean)}
                                            showHighlights={showHighlights}
                                          />
                                        </div>
                                      )}
                                      {(editMode || resume.technical_skills.databases.length > 0) && (
                                        <div>
                                          <p className="font-semibold text-on-background mb-2">Databases:</p>
                                          <EditableSkillTags
                                            skills={resume.technical_skills.databases}
                                            onChange={(newSkills) =>
                                              updateResume({
                                                technical_skills: {
                                                  ...resume.technical_skills,
                                                  databases: newSkills,
                                                },
                                              })
                                            }
                                            editMode={editMode}
                                            colorClass="bg-tertiary-container/20 text-tertiary-container"
                                            highlightedSkills={resume.changes
                                              .filter((c) => c.toLowerCase().includes("databases"))
                                              .map((c) => {
                                                const match = c.match(/Added (.+?) to/i);
                                                return match ? match[1].toLowerCase() : "";
                                              })
                                              .filter(Boolean)}
                                            showHighlights={showHighlights}
                                          />
                                        </div>
                                      )}
                                      {(editMode || resume.technical_skills.cloud_services.length > 0) && (
                                        <div>
                                          <p className="font-semibold text-on-background mb-2">Cloud Services:</p>
                                          <EditableSkillTags
                                            skills={resume.technical_skills.cloud_services}
                                            onChange={(newSkills) =>
                                              updateResume({
                                                technical_skills: {
                                                  ...resume.technical_skills,
                                                  cloud_services: newSkills,
                                                },
                                              })
                                            }
                                            editMode={editMode}
                                            colorClass="bg-primary/10 text-primary"
                                            highlightedSkills={resume.changes
                                              .filter((c) => c.toLowerCase().includes("cloud"))
                                              .map((c) => {
                                                const match = c.match(/Added (.+?) to/i);
                                                return match ? match[1].toLowerCase() : "";
                                              })
                                              .filter(Boolean)}
                                            showHighlights={showHighlights}
                                          />
                                        </div>
                                      )}
                                      {(editMode || resume.technical_skills.developer_tools.length > 0) && (
                                        <div>
                                          <p className="font-semibold text-on-background mb-2">Developer Tools:</p>
                                          <EditableSkillTags
                                            skills={resume.technical_skills.developer_tools}
                                            onChange={(newSkills) =>
                                              updateResume({
                                                technical_skills: {
                                                  ...resume.technical_skills,
                                                  developer_tools: newSkills,
                                                },
                                              })
                                            }
                                            editMode={editMode}
                                            colorClass="bg-surface-container-high text-on-surface-variant"
                                            highlightedSkills={resume.changes
                                              .filter((c) => c.toLowerCase().includes("developer_tools") || c.toLowerCase().includes("tools"))
                                              .map((c) => {
                                                const match = c.match(/Added (.+?) to/i);
                                                return match ? match[1].toLowerCase() : "";
                                              })
                                              .filter(Boolean)}
                                            showHighlights={showHighlights}
                                          />
                                        </div>
                                      )}
                                      {(editMode || (resume.technical_skills.miscellaneous && resume.technical_skills.miscellaneous.length > 0)) && (
                                        <div>
                                          <p className="font-semibold text-on-background mb-2">Miscellaneous:</p>
                                          <EditableSkillTags
                                            skills={resume.technical_skills.miscellaneous}
                                            onChange={(newSkills) =>
                                              updateResume({
                                                technical_skills: {
                                                  ...resume.technical_skills,
                                                  miscellaneous: newSkills,
                                                },
                                              })
                                            }
                                            editMode={editMode}
                                            colorClass="bg-red-500/10 text-red-600"
                                            highlightedSkills={resume.changes
                                              .filter((c) => c.toLowerCase().includes("miscellaneous"))
                                              .map((c) => {
                                                const match = c.match(/Added (.+?) to/i);
                                                return match ? match[1].toLowerCase() : "";
                                              })
                                              .filter(Boolean)}
                                            showHighlights={showHighlights}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );

                      case "certifications": {
                        const combinedItems = [
                          ...(resume.certifications_and_achievements ?? []),
                          ...(resume.certifications ?? []),
                          ...(resume.achievements ?? []),
                        ];
                        const uniqueItems = [...new Set(combinedItems)];
                        if (!editMode && uniqueItems.length === 0) return null;
                        return (
                          <motion.div
                            layout
                            key="edit-certifications"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ y: -4 }}
                            className="soothing-light-theme text-on-background bg-surface-container-lowest rounded-[2rem] p-8 shadow-xl hover:shadow-2xl transition-all duration-300 border border-primary/5"
                          >
                            <div
                              className={`flex items-center justify-between ${editMode ? 'cursor-pointer hover:opacity-80 transition-opacity mb-4' : 'mb-6'}`}
                              onClick={() => editMode && setOpenEditSection(openEditSection === "certifications" ? "" : "certifications")}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-secondary-container/20 flex items-center justify-center">
                                  <Award className="w-6 h-6 text-secondary-container" />
                                </div>
                                <h3 className="font-headline text-2xl font-bold text-on-background">Certifications & Achievements</h3>
                              </div>
                              {editMode && (
                                <motion.div className="p-2 hover:bg-surface-container rounded-full transition-colors" animate={{ rotate: openEditSection === "certifications" ? 180 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}>
                                  <ChevronDown className="w-5 h-5 text-on-surface-variant" />
                                </motion.div>
                              )}
                            </div>

                            <AnimatePresence initial={false}>
                              {(!editMode || openEditSection === "certifications") && (
                                <motion.div
                                  key="certifications-content"
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ type: "spring", stiffness: 300, damping: 30, opacity: { duration: 0.2 } }}
                                  className="overflow-hidden"
                                >
                                  <>
                                    <ul className="space-y-3">
                                      {uniqueItems.map((item, idx) => (
                                        <li key={idx} className="flex items-start gap-3 text-on-background">
                                          <span className="text-tertiary-container mt-1">•</span>
                                          {editMode ? (
                                            <div className="flex-1 flex gap-2">
                                              <textarea
                                                value={item}
                                                onChange={(e) => {
                                                  const newItems = [...uniqueItems];
                                                  newItems[idx] = e.target.value;
                                                  updateResume({
                                                    certifications_and_achievements: newItems,
                                                    certifications: [],
                                                    achievements: []
                                                  });
                                                }}
                                                className="flex-1 rounded-lg px-3 py-2 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm resize-none"
                                                rows={2}
                                              />
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const newItems = uniqueItems.filter((_, i) => i !== idx);
                                                  updateResume({
                                                    certifications_and_achievements: newItems,
                                                    certifications: [],
                                                    achievements: []
                                                  });
                                                }}
                                                className="px-3 py-1 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors font-semibold self-start mt-1"
                                              >
                                                Remove
                                              </button>
                                            </div>
                                          ) : (
                                            <span className="flex-1">{item}</span>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                    {editMode && (
                                      <div className="mt-4 flex justify-center">
                                        <button
                                          onClick={() => {
                                            const newItems = [...uniqueItems, ''];
                                            updateResume({
                                              certifications_and_achievements: newItems,
                                              certifications: [],
                                              achievements: []
                                            });
                                          }}
                                          className="px-4 py-2 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary/20 transition-colors"
                                          type="button"
                                        >
                                          + Add More
                                        </button>
                                      </div>
                                    )}
                                  </>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      }

                      default:
                        return null;
                    }
                  })}

                  {editMode && (
                    <div className="flex justify-center mt-6">
                      <button
                        onClick={() => {
                          const newCustomId = `custom_${Date.now()}`;
                          const newCustoms = [...(resume.custom_sections || []), {
                            id: newCustomId,
                            heading: '',
                            bullets: [{ text: '', url: '' }]
                          }];
                          const newOrder = [...(resume.section_order || ["summary", "education", "experience", "projects", "skills", "certifications"]), newCustomId];
                          updateResume({ custom_sections: newCustoms, section_order: newOrder });
                        }}
                        className="flex items-center gap-2 px-6 py-3 bg-white text-primary font-bold rounded-2xl hover:bg-primary/5 transition-all shadow-sm border border-primary/10 hover:shadow-md"
                        type="button"
                      >
                        <PlusCircle className="w-5 h-5" />
                        Add Custom Section
                      </button>
                    </div>
                  )}
                </motion.div>
              )}


              {showChanges && (
                <motion.div
                  key="changes-made"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="w-full max-w-2xl mx-auto"
                >
                  <div className="soothing-light-theme text-on-background bg-surface-container-lowest rounded-[2rem] p-8 shadow-2xl border border-secondary-container/10">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <Sparkles className="w-6 h-6 text-secondary-container" />
                        <h3 className="font-headline text-2xl font-bold text-on-background">AI Changes</h3>
                      </div>
                      <span className="bg-secondary-container/20 px-3 py-1 rounded-full text-sm font-bold text-secondary-container">
                        {resume.changes.length}
                      </span>
                    </div>

                    {/* Statistics */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-primary-container/10 p-4 rounded-xl text-center">
                        <p className="text-3xl font-bold text-primary">+{scoreImprovement}</p>
                        <p className="text-xs text-on-surface-variant mt-1">Points Gained</p>
                      </div>
                      <div className="bg-secondary-container/10 p-4 rounded-xl text-center">
                        <p className="text-3xl font-bold text-secondary-container">{resume.changes.length}</p>
                        <p className="text-xs text-on-surface-variant mt-1">Improvements</p>
                      </div>
                    </div>

                    {/* Change List */}
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                      {resume.changes.map((change, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 + idx * 0.05 }}
                          className="p-4 bg-primary-container/5 border border-primary-container/20 rounded-xl hover:bg-primary-container/10 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                              {idx + 1}
                            </div>
                            <p className="text-sm text-on-background leading-relaxed flex-1">{change}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {showMissedKeywords && (
                <motion.div
                  key="missed-keywords"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="w-full max-w-2xl mx-auto"
                >
                  <div className="soothing-light-theme text-on-background bg-surface-container-lowest rounded-[2rem] p-8 shadow-2xl border border-error/10">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <Zap className="w-6 h-6 text-error" />
                        <h3 className="font-headline text-2xl font-bold text-on-background">Missed Keywords</h3>
                      </div>
                      <span className="bg-error/20 px-3 py-1 rounded-full text-sm font-bold text-error">
                        {missingKeywords.length}
                      </span>
                    </div>

                    {missingKeywords.length === 0 ? (
                      <div className="text-center p-8 bg-green-500/10 rounded-xl border border-green-500/20">
                        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                        <p className="text-on-background font-bold text-lg">All Keywords Covered!</p>
                        <p className="text-on-surface-variant text-sm mt-1">Your resume includes all necessary keywords from the job description.</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-on-surface-variant mb-6 text-sm">
                          These keywords from the job description which are not found in your resume and injected with miniimum achievable edits.

                        </p>
                        <div className="flex flex-wrap gap-2">
                          {missingKeywords.map((keyword, idx) => (
                            <motion.span
                              key={idx}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: idx * 0.05 }}
                              className="px-4 py-2 bg-error/10 text-error rounded-full text-sm font-medium border border-error/20"
                            >
                              {keyword}
                            </motion.span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Column (Live PDF Preview) — Desktop only */}
        <div className="hidden lg:flex w-full lg:w-[55%] h-[60vh] lg:h-full bg-surface-container-lowest relative flex-col">
          {/* Floating Controls Row */}
          <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
            {/* Template Selector */}
            <div className="flex bg-surface/90 backdrop-blur-md rounded-2xl shadow-lg border border-primary/10 overflow-hidden">
              <button
                onClick={() => setSelectedTemplate("templateLetter")}
                className={`px-3 py-2 text-xs font-semibold transition-colors ${selectedTemplate === "templateLetter" ? "bg-primary text-white" : "text-on-surface-variant hover:bg-surface-container"}`}
              >
                Template 1
              </button>
              <div className="w-[1px] bg-primary/10"></div>
              <button
                onClick={() => setSelectedTemplate("templateA4")}
                className={`px-3 py-2 text-xs font-semibold transition-colors ${selectedTemplate === "templateA4" ? "bg-primary text-white" : "text-on-surface-variant hover:bg-surface-container"}`}
              >
                Template 2
              </button>
            </div>

            {/* Highlight Toggle */}
            {(matchedKeywords.length > 0 || missingKeywords.length > 0) && (
              <div className="flex items-center gap-3 bg-surface/90 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-lg border border-primary/10">
                <div className="flex items-center gap-3 font-medium text-xs text-on-surface-variant border-r border-primary/10 pr-3">
                  <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-[#fef08a] rounded-sm border border-[#eab308]/30"></div> Matched</span>
                  <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-[#bbf7d0] rounded-sm border border-[#22c55e]/30"></div> Added</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer group select-none">
                  <span className="text-xs font-semibold text-on-background group-hover:text-primary transition-colors">Highlights</span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={showHighlights}
                      onChange={(e) => setShowHighlights(e.target.checked)}
                    />
                    <div className={`block w-8 h-4 rounded-full transition-colors duration-300 shadow-inner ${showHighlights ? 'bg-primary' : 'bg-surface-container-high'}`}></div>
                    <div className={`absolute left-0.5 top-0.5 bg-white w-3 h-3 rounded-full transition-transform duration-300 shadow-sm ${showHighlights ? 'transform translate-x-4' : ''}`}></div>
                  </div>
                </label>
              </div>
            )}
          </div>

          <div className="flex-1 w-full bg-surface-container-lowest">
            <PDFViewer key={`${selectedTemplate}-${showHighlights ? "on" : "off"}-${(resume.section_order || []).join('-')}-${(resume.custom_sections || []).map(s => s.heading + (s.bullets || []).map(b => typeof b === 'string' ? b : b.text || '').join('')).join('|')}`} width="100%" height="100%" className="border-none" showToolbar={false}>
              {selectedTemplate === "templateLetter" ? (
                <ResumePDFTemplateLetter
                  resume={resume}
                  showHighlights={showHighlights}
                  matchedKeywords={matchedKeywords}
                  missingKeywords={missingKeywords}
                />
              ) : (
                <ResumePDFTemplateA4
                  resume={resume}
                  showHighlights={showHighlights}
                  matchedKeywords={matchedKeywords}
                  missingKeywords={missingKeywords}
                />
              )}
            </PDFViewer>
          </div>
        </div>
      </div>
      <PricingPopup
        isOpen={showPricingPopup}
        onClose={() => setShowPricingPopup(false)}
        forcePlanSelect={pricingTrigger === "buy_more"}
        onSuccess={() => {
          checkAccess();
          setShowPricingPopup(false);
          if (pricingTrigger === "download") {
            handleDownloadPDF();
          }
        }}
      />
      {showFeedback && (
        <FeedbackModal
          userId={currentUserId}
          sessionId={sessionGuid}
          onClose={() => setShowFeedback(false)}
        />
      )}
    </div>
  );
}
