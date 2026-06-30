"use client";

import React, { useEffect, useState, useRef } from "react";
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
  User,
  Trash2,
  Undo2,
  Redo2,
  Search,
  ExternalLink,
  MapPin
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
import ReferralModal from "@/components/ReferralModal";
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
  summary: { label: "Summary", icon: <Zap className="w-4 h-4" /> },
  education: { label: "Education", icon: <GraduationCap className="w-4 h-4" /> },
  experience: { label: "Experience", icon: <Briefcase className="w-4 h-4" /> },
  projects: { label: "Projects", icon: <FolderGit2 className="w-4 h-4" /> },
  skills: { label: "Technical Skills", icon: <Code className="w-4 h-4" /> },
  certifications: { label: "Certifications", icon: <Award className="w-4 h-4" /> }
};

export default function ResultPage() {
  const router = useRouter();
  const [resume, setResume] = useState<TemplateV1 | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChanges, setShowChanges] = useState(false);
  const [showMissedKeywords, setShowMissedKeywords] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editMode, setEditMode] = useState(true);
  const [openEditSections, setOpenEditSections] = useState<Record<string, boolean>>({ contact: true, summary: true, education: true, experience: true, projects: true, skills: true, certifications: true });
  const toggleSection = (sec: string) => setOpenEditSections(p => ({ ...p, [sec]: !p[sec] }));
  const [activeEditSection, setActiveEditSection] = useState<string>('contact');
  // Always open the section when switching to it via pill
  const selectEditSection = (sid: string) => {
    setActiveEditSection(sid);
    setOpenEditSections(p => ({ ...p, [sid]: true }));
  };
  const [showHighlights, setShowHighlights] = useState(true);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [missingKeywords, setMissingKeywords] = useState<string[]>([]);
  const [matchedKeywords, setMatchedKeywords] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<"templateLetter" | "templateA4">("templateLetter");
  const [noJdMode, setNoJdMode] = useState(false);
  // Section drag-and-drop: track insertion gap index for reliable ordering
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [insertionIndex, setInsertionIndex] = useState<number | null>(null);
  // Touch drag refs — needed so touch handlers can read latest state without stale closures
  const draggingIdRef = useRef<string | null>(null);
  const insertionIndexRef = useRef<number | null>(null);
  // Ref on the section-list container — used to attach a native passive:false touchmove
  // listener, which is the ONLY way iOS Safari allows e.preventDefault() during touch
  const dragListRef = useRef<HTMLDivElement>(null);
  const [showPricingPopup, setShowPricingPopup] = useState(false);
  const [pricingTrigger, setPricingTrigger] = useState<"download" | "buy_more">("download");
  const [hasPaidAccess, setHasPaidAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [userEmail, setUserEmail] = useState<string>("");
  const [credits, setCredits] = useState<number>(0);
  const [buckets, setBuckets] = useState<any[]>([]);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const [showTeaserAuthGate, setShowTeaserAuthGate] = useState(false);

  // 5-Second Teaser Auth Wall: Allow unauthenticated users to see the result for 5s, then lock it down.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        const timer = setTimeout(() => {
          setShowTeaserAuthGate(true);
        }, 5000);
        return () => clearTimeout(timer);
      }
    });
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target as Node)) {
        setShowAccountDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);
  // ── Disable right-click & block print-to-PDF on this page ──────────────
  useEffect(() => {
    const blockContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", blockContextMenu);

    // Inject a <style> tag that blanks the page for any print attempt (Ctrl+P, File→Print, Save as PDF)
    const style = document.createElement("style");
    style.id = "no-print-result";
    style.textContent = "@media print { body { display: none !important; } }";
    document.head.appendChild(style);

    return () => {
      document.removeEventListener("contextmenu", blockContextMenu);
      document.getElementById("no-print-result")?.remove();
    };
  }, []);

  const [showMobilePreview, setShowMobilePreview] = useState(true);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showReferral, setShowReferral] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [sessionGuid, setSessionGuid] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [activeModelName, setActiveModelName] = useState<string>("Auto");
  // ── Undo / Redo history ───────────────────────────────────────────────
  const MAX_HISTORY = 50;
  const historyRef = useRef<TemplateV1[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const lastEditTimeRef = useRef<number>(0);
  const chunkStartTimeRef = useRef<number>(0);

  const updateResume = (updates: Partial<TemplateV1>, opts?: { immediate?: boolean }) => {
    setResume((prev) => {
      if (!prev) return null;
      const next = { ...prev, ...updates };
      const now = Date.now();
      const timeSinceLast = now - lastEditTimeRef.current;
      const chunkDuration = now - chunkStartTimeRef.current;

      const prevStr = JSON.stringify(prev);
      const nextStr = JSON.stringify(next);
      const lengthDelta = Math.abs(nextStr.length - prevStr.length);
      const isPaste = lengthDelta > 20;

      const shouldCoalesce =
        !opts?.immediate &&
        !isPaste &&
        timeSinceLast < 1000 &&
        chunkDuration < 3000 &&
        historyRef.current.length > 0;

      const truncated = historyRef.current.slice(0, historyIndexRef.current + 1);

      if (shouldCoalesce) {
        truncated[truncated.length - 1] = next;
      } else {
        truncated.push(next);
        chunkStartTimeRef.current = now;
      }

      lastEditTimeRef.current = now;
      if (truncated.length > MAX_HISTORY) {
        truncated.shift();
        historyIndexRef.current = Math.max(0, historyIndexRef.current - 1);
      }
      historyRef.current = truncated;
      historyIndexRef.current = truncated.length - 1;
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(false);
      // Persist history so undo/redo survives a page refresh
      try {
        localStorage.setItem("resume_history", JSON.stringify(truncated));
        localStorage.setItem("resume_history_index", String(truncated.length - 1));
        if (next.session_id) {
          localStorage.setItem("resume_history_session_id", next.session_id);
        }
      } catch (_) { }
      return next;
    });
  };

  const handleUndo = () => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const prev = historyRef.current[historyIndexRef.current];
    setResume(prev);
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(true);
    try { localStorage.setItem("resume_history_index", String(historyIndexRef.current)); } catch (_) { }
  };

  const handleRedo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const next = historyRef.current[historyIndexRef.current];
    setResume(next);
    setCanUndo(true);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    try { localStorage.setItem("resume_history_index", String(historyIndexRef.current)); } catch (_) { }
  };

  const handleSectionDragStart = (e: React.DragEvent, sectionId: string) => {
    setDraggingId(sectionId);
    draggingIdRef.current = sectionId;
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
      updateResume({ section_order: newOrder }, { immediate: true });
    }
    setDraggingId(null); draggingIdRef.current = null;
    setInsertionIndex(null); insertionIndexRef.current = null;
  };

  const handleSectionDragEnd = () => {
    setDraggingId(null); draggingIdRef.current = null;
    setInsertionIndex(null); insertionIndexRef.current = null;
  };

  const moveSectionUp = (idx: number) => {
    if (idx === 0 || !resume) return;
    const currentOrder = resume.section_order || ["summary", "education", "experience", "projects", "skills", "certifications"];
    updateResume({ section_order: arrayMove(currentOrder, idx, idx - 1) }, { immediate: true });
  };

  const moveSectionDown = (idx: number) => {
    if (!resume) return;
    const currentOrder = resume.section_order || ["summary", "education", "experience", "projects", "skills", "certifications"];
    if (idx >= currentOrder.length - 1) return;
    updateResume({ section_order: arrayMove(currentOrder, idx, idx + 2) }, { immediate: true });
  };

  // ── Touch drag support (mobile) ──────────────────────────────────────────
  const handleSectionTouchStart = (e: React.TouchEvent, sectionId: string) => {
    draggingIdRef.current = sectionId;
    setDraggingId(sectionId);
  };

  // This is called by the NATIVE touchmove listener (see useEffect below).
  // We keep the logic here so it can also be called from the effect.
  const handleNativeTouchMove = (e: TouchEvent) => {
    if (!draggingIdRef.current) return; // not dragging, let scroll pass
    e.preventDefault(); // block page scroll — works on iOS because listener is { passive: false }
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return;
    const row = (el as HTMLElement).closest('[data-section-index]') as HTMLElement | null;
    if (!row) return;
    const itemIndex = parseInt(row.dataset.sectionIndex || "0", 10);
    const hoveredId = row.dataset.sectionId || "";
    if (hoveredId === draggingIdRef.current) return;
    const rect = row.getBoundingClientRect();
    const newIdx = touch.clientY < rect.top + rect.height / 2 ? itemIndex : itemIndex + 1;
    if (newIdx !== insertionIndexRef.current) {
      insertionIndexRef.current = newIdx;
      setInsertionIndex(newIdx);
    }
  };

  // Attach native { passive: false } touchmove to the drag-list container.
  // This is required for iOS Safari — React’s synthetic onTouchMove is always
  // passive in modern React, so e.preventDefault() inside it is silently ignored.
  useEffect(() => {
    const el = dragListRef.current;
    if (!el) return;
    el.addEventListener("touchmove", handleNativeTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", handleNativeTouchMove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSectionTouchEnd = () => {
    const currentDraggingId = draggingIdRef.current;
    const currentInsertionIndex = insertionIndexRef.current;
    if (!currentDraggingId || currentInsertionIndex === null || !resume) {
      setDraggingId(null); draggingIdRef.current = null;
      setInsertionIndex(null); insertionIndexRef.current = null;
      return;
    }
    const currentOrder = resume.section_order || ["summary", "education", "experience", "projects", "skills", "certifications"];
    const fromIdx = currentOrder.indexOf(currentDraggingId);
    if (fromIdx !== -1) {
      const rawTo = Math.max(0, Math.min(currentInsertionIndex, currentOrder.length));
      if (rawTo !== fromIdx && rawTo !== fromIdx + 1) {
        const newOrder = arrayMove(currentOrder, fromIdx, rawTo);
        updateResume({ section_order: newOrder }, { immediate: true });
      }
    }
    setDraggingId(null); draggingIdRef.current = null;
    setInsertionIndex(null); insertionIndexRef.current = null;
  };



  useEffect(() => {
    const fetchSession = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get("session_id");
      if (sessionId) setSessionGuid(sessionId);

      let parsed = null;
      let isFreshFromAPI = false;

      // ── STEP 1: Always try localStorage FIRST ────────────────────────────
      // localStorage holds the user's latest edits (auto-saved on every change).
      // It must take priority over the API so refreshing never erases edits.
      const localData = localStorage.getItem("generated_resume");
      if (localData) {
        try {
          parsed = JSON.parse(localData);
        } catch (e) {
          // Corrupt data — fall through to API
        }
      }

      // ── STEP 2: Only fetch from API if localStorage is empty ──────────────
      // This only happens on the very first load right after generation,
      // before anything has been saved to localStorage yet.
      if (!parsed && sessionId) {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
          const res = await fetch(`${apiUrl}/api/sessions/${sessionId}`);
          if (res.ok) {
            const data = await res.json();
            parsed = data.generated_output;
            isFreshFromAPI = true;
          }
        } catch (e) {
          console.error("Failed to fetch session", e);
        }
      }

      if (!parsed) {
        router.push("/");
        return;
      }

      // ── STEP 3: One-time display normalization — only for fresh API data ──
      // When loading from localStorage these values are already correct;
      // running them again would overwrite any user edits to those fields.
      if (isFreshFromAPI) {
        // Build hrefs from raw LLM output FIRST (before sanitizing display text)
        if (!parsed.heading.linkedin_url_href) {
          const rawLinkedin = parsed.heading.linkedin_url || "";
          const linkedinUrl = rawLinkedin.replace(/^https?:\/\//i, "");
          parsed.heading.linkedin_url_href = linkedinUrl.includes("linkedin.com")
            ? `https://${linkedinUrl}`
            : `https://linkedin.com/in/username`;
        }
        if (!parsed.heading.github_url_href) {
          parsed.heading.github_url_href = `https://${parsed.heading.github_url}`;
        }
        // Set clean display text — visual only, href is already saved above
        parsed.heading.linkedin_url = "linkedin";
        parsed.heading.github_url = cleanDisplayUrl(parsed.heading.github_url, "github.com/username");
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

      const isNoJd = localStorage.getItem("no_jd_mode") === "true";
      setNoJdMode(isNoJd);
      // JD optimization mode → default to "Edit Form" panel
      // if (!isNoJd) {
      //   setEditMode(false);
      //   setShowChanges(true);
      // }

      if (!parsed.section_order || parsed.section_order.length === 0) {
        parsed.section_order = ["summary", "education", "experience", "projects", "skills", "certifications"];
      }

      // Use the actual model returned by the backend API if available
      let finalModelName = "Auto (Best Quality Available)";
      if (parsed._model_used) {
        finalModelName = parsed._model_used;
      } else {
        const savedModelId = localStorage.getItem("preferred_model") || "";
        const matchedModel = MODELS.options.find(m => m.id === savedModelId);
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

  // Seed history once resume first loads — restore from localStorage if it belongs to THIS session
  useEffect(() => {
    if (resume && historyRef.current.length === 0) {
      try {
        const savedHistory = localStorage.getItem("resume_history");
        const savedIndex = localStorage.getItem("resume_history_index");
        const savedSessionId = localStorage.getItem("resume_history_session_id");
        const currentSessionId = resume.session_id || "";

        if (savedHistory && savedIndex !== null && savedSessionId === currentSessionId && currentSessionId !== "") {
          const parsedHistory: TemplateV1[] = JSON.parse(savedHistory);
          const parsedIndex = parseInt(savedIndex, 10);
          if (Array.isArray(parsedHistory) && parsedHistory.length > 0 && parsedIndex >= 0 && parsedIndex < parsedHistory.length) {
            historyRef.current = parsedHistory;
            historyIndexRef.current = parsedIndex;
            setCanUndo(parsedIndex > 0);
            setCanRedo(parsedIndex < parsedHistory.length - 1);
            return; // restored — skip default seed
          }
        }
      } catch (_) { }
      // Different session or no saved history — start fresh
      localStorage.removeItem("resume_history");
      localStorage.removeItem("resume_history_index");
      localStorage.removeItem("resume_history_session_id");
      if (resume.session_id) {
        localStorage.setItem("resume_history_session_id", resume.session_id);
      }
      historyRef.current = [resume];
      historyIndexRef.current = 0;
      setCanUndo(false);
      setCanRedo(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!resume]);

  // Keyboard shortcuts: Ctrl+Z → undo, Ctrl+Y / Ctrl+Shift+Z → redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!editMode) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
        if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); handleRedo(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, canUndo, canRedo]);

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

    const { data: uData } = await supabase.from("users").select("referral_code").eq("id", session.user.id).single();
    if (uData?.referral_code) setReferralCode(uData.referral_code);

    const { data: bucketData } = await supabase
      .from("credit_buckets")
      .select("*")
      .eq("user_id", session.user.id)
      .in("status", ["active", "queued", "fallback"])
      .gt("remaining_credits", 0)
      .order("created_at", { ascending: true });

    let currentCredits = 0;
    if (bucketData) {
      setBuckets(bucketData);
      currentCredits = bucketData.reduce((acc, b) => acc + b.remaining_credits, 0);
      setCredits(currentCredits);
    } else {
      const { data: oldData } = await supabase.from("users").select("credits_balance").eq("id", session.user.id).single();
      currentCredits = oldData?.credits_balance || 0;
      setCredits(currentCredits);
    }

    if (currentCredits >= 10) {
      setHasPaidAccess(true);
    } else {
      setHasPaidAccess(false);
    }

    // Auto-open pricing popup if redirected back from auth flow and don't have enough credits
    if (typeof window !== "undefined" && localStorage.getItem("auth_redirect_pricing") === "true") {
      localStorage.removeItem("auth_redirect_pricing");
      if (currentCredits < 10) {
        setShowPricingPopup(true);
      }
    }

    setCheckingAccess(false);
  };

  // Check if user has already paid and listen for auth state changes
  useEffect(() => {
    checkAccess();

    // Track /result page visit for funnel analytics (mirrors landing page tracking)
    // Fire-and-forget — never blocks the user, production only
    if (process.env.NODE_ENV === "production") {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get("session_id") || null;
      supabase.auth.getSession().then(({ data: { session } }) => {
        fetch(`${apiUrl}/api/analytics/track-visit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            page_type: "result",
            session_id: sessionId,
            user_id: session?.user?.id ?? null,
          }),
        }).catch(() => { }); // silent fail — never block the user
      });
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        checkAccess();
      } else if (event === "SIGNED_OUT") {
        setUserEmail("");
        setCurrentUserId("");
        setCredits(0);
        setBuckets([]);
        setHasPaidAccess(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleStartOver = () => {
    // Only clear resume workflow keys — do NOT clear auth session
    ["resume_text", "job_description", "analysis", "generated_resume",
      "no_jd_mode", "no_ai_changes", "approved_project", "preferred_model",
      "resume_history", "resume_history_index", "extracted_links"].forEach(
        (key) => localStorage.removeItem(key)
      );
    router.push("/");
  };

  // Auto-save: persist resume to localStorage whenever it changes
  useEffect(() => {
    if (resume) {
      localStorage.setItem("generated_resume", JSON.stringify(resume));
    }
  }, [resume]);

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

      // 1. Deduct credit FIRST (before triggering OS download actions which suspend mobile browsers)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        try {
          await fetch(`${apiUrl}/api/payments/deduct-credit`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ user_id: session.user.id, session_id: sessionGuid }),
            keepalive: true // Essential for mobile: ensures request completes even if page unloads
          });
          // Re-evaluate access silently (do not await, to not delay download)
          checkAccess();
        } catch (e) {
          console.error("Failed to deduct credit", e);
        }
      }

      // ✅ FIX: Clear loading state BEFORE triggering iOS download prompt
      setDownloadingPDF(false);

      // 2. Determine if we should show feedback (pre-compute BEFORE iOS tab suspension)
      let shouldShowFeedback = false;
      let shouldShowReferral = false;
      const activeUserId = session?.user?.id || currentUserId;
      if (activeUserId) {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const isMobile = window.matchMedia?.("(pointer: coarse)")?.matches ?? /Mobi|Android|iPhone/i.test(navigator.userAgent);
        const deviceType = isMobile ? "mobile" : "desktop";

        try {
          // Await the fetch so it finishes before link.click() freezes the thread on mobile
          const res = await fetch(`${apiUrl}/api/resume/increment-download`, {
            method: "POST",
            body: JSON.stringify({ session_id: sessionGuid || "", user_id: activeUserId, device_type: deviceType }),
            headers: { "Content-Type": "application/json" }
          });

          if (res.ok) {
            const data = await res.json();
            const isFirstEverDownload = data.user_total_downloads === 1;
            const isSecondEverDownload = data.user_total_downloads === 2;
            const isGlobalReferralMilestone = data.total_platform_downloads > 0 && data.total_platform_downloads % 3 === 0;
            const isGlobalFeedbackMilestone = data.total_platform_downloads > 0 && data.total_platform_downloads % 5 === 0;
            
            if (isFirstEverDownload) {
              shouldShowFeedback = true;
            } else if (isSecondEverDownload || isGlobalReferralMilestone) {
              shouldShowReferral = true;
            } else if (isGlobalFeedbackMilestone) {
              shouldShowFeedback = true;
            }
          }
        } catch (e) {
          console.error("Feedback trigger failed", e);
        }
      }

      // 3. Trigger the actual download (This suspends the JS thread on mobile!)
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Delay revocation so iOS Safari has time to read the blob into its PDF viewer
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      // 4. Now register the timeout BEFORE the OS fully freezes the thread
      if (shouldShowFeedback) {
        setTimeout(() => setShowFeedback(true), 5000);
      } else if (shouldShowReferral) {
        setTimeout(() => {
          setShowReferral(true);
        }, 5000);
      }
    } catch (error) {
      console.error("PDF generation failed:", error);
      setDownloadingPDF(false); // Only needed here now, since success path clears it earlier
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
    <div className="min-h-[100dvh] lg:h-[100dvh] flex flex-col bg-[#0f1117] font-sans lg:overflow-hidden overflow-y-auto">
      {/* Top App Bar - Fixed non-scrolling */}
      <header className="flex-shrink-0 z-50 bg-[#0f1117] border-b border-white/8 shadow-md">
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
              <h1 className="font-headline text-lg font-bold text-white leading-tight">Your Resume</h1>
              <p className="text-xs text-white/50 leading-tight flex items-center gap-1">
                {(() => {
                  const isDevMode = userEmail === "flashresume.in@gmail.com";
                  return (
                    <>
                      <Sparkles className="w-3 h-3 text-[#12f8d7]" /> AI-Optimized{isDevMode && activeModelName ? ` with ${activeModelName}` : ''}
                    </>
                  );
                })()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-4 min-w-0">
            <button
              onClick={handleStartOver}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold text-white/60 bg-white/6 hover:bg-white/10 border border-white/10 transition-colors"
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
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-1.5 sm:px-5 sm:py-2 rounded-xl text-sm font-bold text-white transition-all ${downloadingPDF || checkingAccess
                ? "bg-white/10 cursor-not-allowed"
                : hasPaidAccess
                  ? "bg-primary hover:bg-primary/90 border border-[#12f8d7] shadow-[0_0_10px_rgba(18,248,215,0.4)] hover:shadow-[0_0_15px_rgba(18,248,215,0.6)]"
                  : "bg-gradient-to-r from-primary to-secondary hover:opacity-90 border border-[#12f8d7] shadow-[0_0_10px_rgba(18,248,215,0.4)] hover:shadow-[0_0_15px_rgba(18,248,215,0.6)]"
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
            <div className="relative flex-shrink-0" ref={accountDropdownRef}>
              <button
                onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                className="w-10 h-10 rounded-xl bg-white/6 hover:bg-white/12 border border-white/10 transition-colors flex items-center justify-center relative shadow-sm"
              >
                <User className="w-5 h-5 text-white/60" />
                {credits < 10 && <span className="absolute top-0 right-0 w-3 h-3 bg-error rounded-full border-2 border-[#0f1117]"></span>}
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
                        {buckets.length > 0 && (
                          <div className="space-y-4 mt-5">
                            {buckets.map(b => {
                              const activeBucket = buckets.find(b => b.status === 'active');
                              const activePlanName = activeBucket ? (activeBucket.plan_type === 'student' ? 'student plan' : activeBucket.plan_type === 'regular' ? 'pro plan' : 'previous plan') : 'previous plan';

                              const name = b.plan_type === 'student' ? '🎓 Student Plan' : b.plan_type === 'regular' ? '👑 Pro Monthly' : b.plan_type === 'pay_per_use' ? '💳 Pay Per Use' : '🎁 Referral Credits';
                              let validText = "";
                              if (b.status === 'active' && b.expires_at) {
                                validText = `Valid till ${new Date(b.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                              } else if (b.status === 'queued') {
                                validText = `Starts after ${activePlanName}`;
                              } else if (b.status === 'fallback' || !b.validity_duration_days) {
                                validText = `Lifetime (No Expiration)`;
                              }

                              return (
                                <div key={b.id} className="flex flex-col gap-0.5">
                                  <div className="flex justify-between items-center w-full gap-4">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <p className="font-bold text-sm text-on-background truncate">{name}</p>
                                    </div>
                                    <span className="font-black text-sm text-on-background whitespace-nowrap">{b.remaining_credits} Credits</span>
                                  </div>
                                  <p className="text-[11px] font-medium text-on-surface-variant/80">
                                    {validText}
                                  </p>
                                </div>
                              );
                            })}

                            {buckets.length > 1 && (
                              <div className="pt-3 border-t border-surface-container-high/60 flex justify-between items-center">
                                <span className="text-sm font-semibold text-on-background">⚡ Total</span>
                                <span className="text-sm font-black text-on-background">{credits} Credits</span>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="pt-2 space-y-2 border-t border-surface-container-low mt-2">
                          {/* View Full Profile */}
                          <button
                            onClick={() => {
                              setShowAccountDropdown(false);
                              window.open("/profile", "_blank");
                            }}
                            className="w-full py-2.5 bg-gradient-to-r from-primary/10 to-secondary/10 hover:from-primary/20 hover:to-secondary/20 text-primary border border-primary/20 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                          >
                            👤 View Full Profile →
                          </button>

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

                          <button
                            onClick={() => {
                              setShowAccountDropdown(false);
                              window.location.href = '/contact';
                            }}
                            className="w-full py-2.5 bg-surface-container-low hover:bg-surface-container-high text-on-background text-sm font-bold rounded-xl transition-colors"
                          >
                            Help / Contact
                          </button>
                        </div>
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
      <div className="lg:hidden w-full flex flex-col bg-[#0f1117] border-b border-white/8">
        <div className="relative bg-[#0c0f12] flex flex-col items-center pb-6">
          {/* Template + Highlight controls */}
          <div className="w-full flex items-center justify-between px-4 pt-4 pb-4">
            {/* Undo / Redo — visible only in edit mode */}
            {editMode ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={!canUndo}
                  title="Undo (Ctrl+Z)"
                  className={`flex items-center justify-center w-9 h-9 rounded-xl border transition-all duration-200 ${canUndo
                    ? 'bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white active:scale-95'
                    : 'bg-white/5 text-white/30 border-white/10 cursor-not-allowed'
                    }`}
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={!canRedo}
                  title="Redo (Ctrl+Y)"
                  className={`flex items-center justify-center w-9 h-9 rounded-xl border transition-all duration-200 ${canRedo
                    ? 'bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white active:scale-95'
                    : 'bg-white/5 text-white/30 border-white/10 cursor-not-allowed'
                    }`}
                >
                  <Redo2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div />
            )}
            {/* T1 / T2 template switcher */}
            <div className="flex bg-[#0f1117]/90 backdrop-blur-md rounded-xl shadow-lg border border-[#006859]/30 overflow-hidden">
              <button onClick={() => setSelectedTemplate("templateLetter")} className={`px-3 py-2 text-[11px] font-bold transition-colors ${selectedTemplate === "templateLetter" ? "bg-primary text-white" : "text-white/60 hover:bg-white/10"}`}>T1</button>
              <div className="w-[1px] bg-white/10"></div>
              <button onClick={() => setSelectedTemplate("templateA4")} className={`px-3 py-2 text-[11px] font-bold transition-colors ${selectedTemplate === "templateA4" ? "bg-primary text-white" : "text-white/60 hover:bg-white/10"}`}>T2</button>
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
      </div>

      {/* Main Workspace */}
      <div className="flex-1 lg:overflow-hidden flex flex-col lg:flex-row relative">

        {/* Left Column (Editor & Metrics) */}
        <div className="w-full lg:w-[45%] flex-1 lg:h-full flex flex-col bg-[#0f1117] border-r border-white/8 z-10 shadow-xl lg:shadow-none transition-all relative">

          {/* Segmented Toggles inside Sticky Top */}
          <div className="flex-shrink-0 bg-[#0f1117]/95 backdrop-blur-md p-4 border-b border-white/8 flex flex-col gap-3 py-4 sticky top-0 z-20">
            {/* ── Compact ATS Score Strip — above tab buttons ── */}
            {resume && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-[#006859]/30 mb-1">
                {noJdMode ? (
                  <>
                    <TrendingUp className="w-3.5 h-3.5 text-[#006859] flex-shrink-0" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/40 flex-1">ATS Formatting Score</span>
                    <span className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-[#006859] to-[#12f8d7]">100%</span>
                  </>
                ) : (
                  <>
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Before</span>
                    <span className="text-base font-black text-white/50 leading-none">{resume.ats_score_before}</span>
                    <div className="flex-1 flex items-center px-1">
                      <div className="flex-1 h-px bg-gradient-to-r from-on-surface-variant/20 to-[#006859]/40 rounded-full" />
                      <TrendingUp className="w-3 h-3 text-[#006859] flex-shrink-0 mx-1.5" />
                      <div className="flex-1 h-px bg-gradient-to-r from-[#006859]/40 to-[#12f8d7]/60 rounded-full" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#006859]">After</span>
                    <span className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-[#006859] to-[#12f8d7] leading-none">{resume.ats_score_after}</span>
                    <span className="bg-gradient-to-r from-[#006859] to-[#12f8d7] text-white px-2 py-0.5 rounded-lg text-[9px] font-black whitespace-nowrap ml-1">+{scoreImprovement} ATS</span>
                  </>
                )}
              </div>
            )}
            <div className="flex gap-2 items-center">
              <button
                onClick={() => { setEditMode(true); setShowChanges(false); setShowMissedKeywords(false); }}
                className={`relative flex-1 py-3 px-1 sm:px-3 text-xs sm:text-sm whitespace-nowrap font-bold transition-all duration-200 rounded-2xl flex items-center justify-center gap-1 sm:gap-2 active:scale-95 ${editMode
                  ? "bg-primary text-white shadow-lg shadow-primary/30 border border-transparent"
                  : "bg-white/6 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/80"
                  }`}
              >
                <Edit3 className={`w-4 h-4 ${editMode ? 'text-white' : 'text-white/40'}`} />
                Edit Form
              </button>
              <button
                onClick={() => { setShowChanges(true); setEditMode(false); setShowMissedKeywords(false); }}
                className={`flex-1 py-3 px-1 sm:px-3 text-xs sm:text-sm whitespace-nowrap font-bold transition-all duration-200 rounded-2xl flex items-center justify-center gap-1 sm:gap-2 active:scale-95 ${showChanges
                  ? "bg-primary text-white shadow-lg shadow-primary/30 border border-transparent"
                  : "bg-white/6 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/80"
                  }`}
              >
                <Sparkles className={`w-4 h-4 ${showChanges ? 'text-white' : 'text-white/40'}`} />
                AI Analysis
              </button>
              {!noJdMode && (
                <button
                  onClick={() => { setShowMissedKeywords(true); setEditMode(false); setShowChanges(false); }}
                  className={`relative flex-1 py-3 px-1 sm:px-3 text-xs sm:text-sm whitespace-nowrap font-bold transition-all duration-200 rounded-2xl flex items-center justify-center gap-1 sm:gap-2 active:scale-95 ${showMissedKeywords
                    ? "bg-primary text-white shadow-lg shadow-primary/30 border border-transparent"
                    : "bg-white/6 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/80"
                    }`}
                >
                  <Zap className={`w-4 h-4 ${showMissedKeywords ? 'text-white' : 'text-white/40'}`} />
                  Keywords
                  {missingKeywords.length > 0 && !showMissedKeywords && (
                    <span className="absolute -top-1.5 -right-1.5 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-white shadow-md ring-2 ring-[#0f1117]">{missingKeywords.length}</span>
                  )}
                </button>
              )}
              {/* Undo / Redo — always visible in edit mode on both mobile & desktop */}
              {editMode && (
                <div className="hidden lg:flex items-center gap-1 ml-auto flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={!canUndo}
                    title="Undo (Ctrl+Z)"
                    className={`flex items-center justify-center w-8 h-8 rounded-xl border transition-all duration-200 ${canUndo
                      ? 'bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white active:scale-95'
                      : 'bg-white/5 text-white/30 border-white/10 cursor-not-allowed'
                      }`}
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={!canRedo}
                    title="Redo (Ctrl+Y)"
                    className={`flex items-center justify-center w-8 h-8 rounded-xl border transition-all duration-200 ${canRedo
                      ? 'bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white active:scale-95'
                      : 'bg-white/5 text-white/30 border-white/10 cursor-not-allowed'
                      }`}
                  >
                    <Redo2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Section Pill Nav ── */}
          {editMode && resume && (
            <div className="flex-shrink-0 border-b border-white/8 bg-[#0f1117]/95 backdrop-blur-md px-4 py-2">
              <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar w-full">
                <div className="w-full grid grid-cols-3 gap-1 sm:flex sm:flex-wrap sm:gap-1.5 sm:w-auto">
                  {/* Reorder pill — always first */}
                  <button
                    type="button"
                    onClick={() => selectEditSection('__reorder__')}
                    className={`w-full sm:w-auto flex items-center justify-center sm:justify-start gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap transition-all duration-200 border ${activeEditSection === '__reorder__'
                      ? 'bg-[#12f8d7]/10 text-[#12f8d7] border-[#12f8d7] shadow-sm'
                      : 'bg-white/6 text-white/50 border-white/10 hover:bg-white/10 hover:text-white/80'
                      }`}
                  >
                    <GripVertical className="hidden sm:block w-3 h-3" />
                    Reorder
                  </button>
                  {/* Contact pill */}
                  <button
                    type="button"
                    onClick={() => selectEditSection('contact')}
                    className={`w-full sm:w-auto flex items-center justify-center sm:justify-start gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap transition-all duration-200 border ${activeEditSection === 'contact'
                      ? 'bg-[#12f8d7]/10 text-[#12f8d7] border-[#12f8d7] shadow-sm'
                      : 'bg-white/6 text-white/50 border-white/10 hover:bg-white/10 hover:text-white/80'
                      }`}
                  >
                    <FileText className="hidden sm:block w-3 h-3" />
                    Contact
                  </button>
                  {/* Dynamic section pills in current order */}
                  {(resume.section_order || []).map((sid) => {
                    const isCustom = sid.startsWith('custom_');
                    const customSection = isCustom ? resume.custom_sections?.find(s => s.id === sid) : null;
                    const meta = isCustom
                      ? { label: (customSection?.heading || 'Custom').slice(0, 16) + ((customSection?.heading || '').length > 16 ? '…' : ''), icon: <FileText className="w-3 h-3" /> }
                      : SECTION_LABELS[sid];
                    if (!meta) return null;
                    const isActive = activeEditSection === sid;
                    return (
                      <button
                        key={sid}
                        type="button"
                        onClick={() => selectEditSection(sid)}
                        className={`w-full sm:w-auto flex items-center justify-center sm:justify-start gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap transition-all duration-200 border max-w-[120px] sm:max-w-[150px] ${isActive
                          ? 'bg-[#12f8d7]/10 text-[#12f8d7] border-[#12f8d7] shadow-sm'
                          : 'bg-white/6 text-white/50 border-white/10 hover:bg-white/10 hover:text-white/80'
                          }`}
                        title={customSection?.heading || 'Custom'}
                      >
                        <span className="hidden sm:inline-flex [&>svg]:w-3 [&>svg]:h-3">{meta.icon}</span>
                        <span className="truncate">{meta.label}</span>
                      </button>
                    );
                  })}
                  {/* + Custom Section pill */}
                  <button
                    type="button"
                    onClick={() => {
                      const newCustomId = `custom_${Date.now()}`;
                      const newCustoms = [...(resume.custom_sections || []), {
                        id: newCustomId,
                        heading: '',
                        bullets: [{ text: '', url: '' }]
                      }];
                      const newOrder = [...(resume.section_order || ['summary', 'education', 'experience', 'projects', 'skills', 'certifications']), newCustomId];
                      updateResume({ custom_sections: newCustoms, section_order: newOrder }, { immediate: true });
                      selectEditSection(newCustomId);
                    }}
                    className="w-full sm:w-auto flex items-center justify-center sm:justify-start gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap transition-all duration-200 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80"
                  >
                    <PlusCircle className="hidden sm:block w-3 h-3" />
                    + Custom
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* Scrollable Panel Content */}
          <div className="flex-1 overflow-y-auto overscroll-y-contain p-4 sm:p-6 lg:px-8 lg:py-6 pb-24 hide-scrollbar bg-[#0f1117]">
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

                  {/* Reorder tab — shown only when __reorder__ pill is active */}
                  {activeEditSection === '__reorder__' && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="soothing-light-theme text-on-background bg-surface-container-lowest rounded-2xl p-4 shadow-md border border-primary/10"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleSectionDrop}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-headline font-bold text-on-background text-sm">Drag to Reorder</h3>
                        <span className="text-[10px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">Hold &amp; drag</span>
                      </div>
                      <div ref={dragListRef} className="flex flex-col">
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
                                data-section-index={index}
                                data-section-id={sectionId}
                                onDragStart={(e) => handleSectionDragStart(e, sectionId)}
                                onDragEnter={(e) => handleSectionDragEnter(e, index, sectionId)}
                                onDragOver={(e) => handleSectionDragOver(e, index, sectionId)}
                                onDragEnd={handleSectionDragEnd}
                                onTouchStart={(e) => handleSectionTouchStart(e, sectionId)}
                                onTouchEnd={handleSectionTouchEnd}
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
                                <div className="flex items-center gap-1 bg-surface-container rounded-lg p-0.5">
                                  <button
                                    type="button"
                                    onClick={() => moveSectionUp(index)}
                                    disabled={index === 0}
                                    className="p-1 text-on-surface-variant hover:text-primary hover:bg-white rounded-md disabled:opacity-30 disabled:hover:bg-transparent"
                                  >
                                    <ChevronUp className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveSectionDown(index)}
                                    disabled={index === (resume.section_order?.length || 0) - 1}
                                    className="p-1 text-on-surface-variant hover:text-primary hover:bg-white rounded-md disabled:opacity-30 disabled:hover:bg-transparent"
                                  >
                                    <ChevronDown className="w-4 h-4" />
                                  </button>
                                </div>
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
                  )}

                  {/* Heading Section — shown only when contact pill active */}
                  {activeEditSection === 'contact' && <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    whileHover={{ y: -4 }}
                    className="soothing-light-theme text-on-background bg-surface-container-lowest rounded-[2rem] p-8 shadow-xl hover:shadow-2xl transition-all duration-300 border border-primary/5"
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-primary-container/20 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-primary" />
                      </div>
                      <h3 className="font-headline text-2xl font-bold text-on-background">Contact Information</h3>
                    </div>

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

                      {/* ── LinkedIn (removable) ── */}
                      {!resume.heading.linkedin_hidden ? (
                        <div className="rounded-xl border border-on-surface-variant/20 bg-surface-container-lowest/50 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-on-surface-variant font-semibold uppercase tracking-wide">LinkedIn</p>
                            <button
                              type="button"
                              onClick={() => updateResume({ heading: { ...resume.heading, linkedin_hidden: true, linkedin_url: '', linkedin_url_href: '' } }, { immediate: true })}
                              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors font-semibold"
                            >
                              <Trash2 className="w-3 h-3" /> Remove
                            </button>
                          </div>
                          <input
                            type="text"
                            value={cleanDisplayUrl(resume.heading.linkedin_url, "linkedin")}
                            onChange={(e) => updateResume({ heading: { ...resume.heading, linkedin_url: e.target.value } })}
                            className="w-full rounded-lg px-3 py-2 border border-on-surface-variant/15 bg-transparent focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                            placeholder="Display text (e.g. linkedin)"
                          />
                          <input
                            type="url"
                            value={resume.heading.linkedin_url_href || "https://linkedin.com/in/username"}
                            onChange={(e) => updateResume({ heading: { ...resume.heading, linkedin_url_href: e.target.value } })}
                            className="w-full rounded-lg px-3 py-2 border border-on-surface-variant/15 bg-transparent focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm text-on-surface-variant"
                            placeholder="https://linkedin.com/in/username"
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => updateResume({ heading: { ...resume.heading, linkedin_hidden: false, linkedin_url: 'linkedin', linkedin_url_href: 'https://linkedin.com/in/username' } }, { immediate: true })}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-on-surface-variant/30 text-sm text-on-surface-variant hover:border-primary hover:text-primary hover:bg-primary/5 transition-all font-semibold"
                        >
                          <PlusCircle className="w-4 h-4" /> Add LinkedIn
                        </button>
                      )}

                      {/* ── GitHub (removable) ── */}
                      {!resume.heading.github_hidden ? (
                        <div className="rounded-xl border border-on-surface-variant/20 bg-surface-container-lowest/50 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-on-surface-variant font-semibold uppercase tracking-wide">GitHub</p>
                            <button
                              type="button"
                              onClick={() => updateResume({ heading: { ...resume.heading, github_hidden: true, github_url: '', github_url_href: '' } }, { immediate: true })}
                              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors font-semibold"
                            >
                              <Trash2 className="w-3 h-3" /> Remove
                            </button>
                          </div>
                          <input
                            type="text"
                            value={cleanDisplayUrl(resume.heading.github_url, "github.com/username")}
                            onChange={(e) => updateResume({ heading: { ...resume.heading, github_url: e.target.value } })}
                            className="w-full rounded-lg px-3 py-2 border border-on-surface-variant/15 bg-transparent focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                            placeholder="Display text (e.g. github.com/you)"
                          />
                          <input
                            type="url"
                            value={resume.heading.github_url_href || "https://github.com/username"}
                            onChange={(e) => updateResume({ heading: { ...resume.heading, github_url_href: e.target.value } })}
                            className="w-full rounded-lg px-3 py-2 border border-on-surface-variant/15 bg-transparent focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm text-on-surface-variant"
                            placeholder="https://github.com/username"
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => updateResume({ heading: { ...resume.heading, github_hidden: false, github_url: 'github.com/username', github_url_href: 'https://github.com/username' } }, { immediate: true })}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-on-surface-variant/30 text-sm text-on-surface-variant hover:border-primary hover:text-primary hover:bg-primary/5 transition-all font-semibold"
                        >
                          <PlusCircle className="w-4 h-4" /> Add GitHub
                        </button>
                      )}

                      {/* ── Custom Links ── */}
                      {(resume.heading.custom_links || []).map((link, cidx) => (
                        <div key={cidx} className="rounded-xl border border-on-surface-variant/20 bg-surface-container-lowest/50 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-on-surface-variant font-semibold uppercase tracking-wide">Custom Link</p>
                            <button
                              type="button"
                              onClick={() => {
                                const newLinks = (resume.heading.custom_links || []).filter((_, i) => i !== cidx);
                                updateResume({ heading: { ...resume.heading, custom_links: newLinks } }, { immediate: true });
                              }}
                              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors font-semibold"
                            >
                              <Trash2 className="w-3 h-3" /> Remove
                            </button>
                          </div>
                          <input
                            type="text"
                            value={link.label}
                            onChange={(e) => {
                              const newLinks = [...(resume.heading.custom_links || [])];
                              newLinks[cidx] = { ...newLinks[cidx], label: e.target.value };
                              updateResume({ heading: { ...resume.heading, custom_links: newLinks } });
                            }}
                            className="w-full rounded-lg px-3 py-2 border border-on-surface-variant/15 bg-transparent focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                            placeholder="Display text (e.g. Portfolio, LeetCode)"
                          />
                          <input
                            type="url"
                            value={link.url}
                            onChange={(e) => {
                              const newLinks = [...(resume.heading.custom_links || [])];
                              newLinks[cidx] = { ...newLinks[cidx], url: e.target.value };
                              updateResume({ heading: { ...resume.heading, custom_links: newLinks } });
                            }}
                            className="w-full rounded-lg px-3 py-2 border border-on-surface-variant/15 bg-transparent focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm text-on-surface-variant"
                            placeholder="https://yoursite.com"
                          />
                        </div>
                      ))}

                      {/* ── Add Custom Link button ── */}
                      <button
                        type="button"
                        onClick={() => {
                          const newLinks = [...(resume.heading.custom_links || []), { label: '', url: '' }];
                          updateResume({ heading: { ...resume.heading, custom_links: newLinks } }, { immediate: true });
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-on-surface-variant/30 text-sm text-on-surface-variant hover:border-primary hover:text-primary hover:bg-primary/5 transition-all font-semibold"
                      >
                        <PlusCircle className="w-4 h-4" /> Add Custom Link
                      </button>
                    </div>
                  </motion.div>}

                  {/* Section cards rendered in section_order sequence — mirrors PDF exactly */}
                  {(resume.section_order || ["summary", "education", "experience", "projects", "skills", "certifications"]).map((sectionId) => {
                    // In editMode, only render the active pill's section
                    if (editMode && activeEditSection !== sectionId) return null;
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
                            className="flex items-center justify-between mb-6"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-2xl bg-primary-container/20 flex items-center justify-center">
                                <FileText className="w-6 h-6 text-primary" />
                              </div>
                              {editMode ? (
                                <input
                                  type="text"
                                  value={customSection.heading}
                                  onChange={(e) => {
                                    const newCustoms = [...(resume.custom_sections || [])];
                                    newCustoms[customIndex] = { ...newCustoms[customIndex], heading: e.target.value };
                                    updateResume({ custom_sections: newCustoms }, { immediate: true });
                                  }}
                                  className="font-headline text-2xl font-bold rounded-xl px-4 py-2 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm w-full"
                                  placeholder="Section Heading"
                                />
                              ) : (
                                <h3 className="font-headline text-2xl font-bold text-on-background">{customSection.heading || "Custom Section"}</h3>
                              )}
                            </div>
                          </div>

                          <div>

                            <ul className="space-y-2">
                              {(customSection.bullets ?? []).map((bulletObj, bidx) => (
                                <li key={bidx} className="text-on-background text-sm flex items-start gap-3 rounded-lg p-3 transition-all">
                                  <span className="text-primary mt-1 font-bold">•</span>
                                  {editMode ? (
                                    <div className="flex-1 flex flex-col sm:flex-row gap-2 items-stretch sm:items-start w-full min-w-0">
                                      <textarea
                                        value={typeof bulletObj === 'string' ? bulletObj : bulletObj.text}
                                        onChange={(e) => {
                                          const newCustoms = [...(resume.custom_sections || [])];
                                          if (typeof newCustoms[customIndex].bullets![bidx] === 'string') {
                                            newCustoms[customIndex].bullets![bidx] = { text: e.target.value };
                                          } else {
                                            (newCustoms[customIndex].bullets![bidx] as any).text = e.target.value;
                                          }
                                          updateResume({ custom_sections: newCustoms }, { immediate: true });
                                        }}
                                        className="w-full sm:flex-[2] rounded-lg px-3 py-2 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm resize-none min-w-0"
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
                                          updateResume({ custom_sections: newCustoms }, { immediate: true });
                                        }}
                                        className="w-full sm:flex-[1] text-xs rounded-lg px-3 py-2 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm min-w-0"
                                        placeholder="Behind URL (e.g., leetcode.com/user)"
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
                              <div className="flex flex-wrap justify-between items-center gap-3 mt-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newCustoms = [...(resume.custom_sections || [])];
                                    if (!newCustoms[customIndex].bullets) newCustoms[customIndex].bullets = [];
                                    newCustoms[customIndex].bullets!.push({ text: '', url: '' });
                                    updateResume({ custom_sections: newCustoms }, { immediate: true });
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
                                    updateResume({ custom_sections: newCustoms, section_order: newOrder }, { immediate: true });
                                    setActiveEditSection('contact');
                                  }}
                                  className="flex-shrink-0 px-3 py-1 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors font-semibold"
                                >
                                  Remove Section
                                </button>
                              </div>
                            )}
                          </div>
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
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-12 h-12 rounded-2xl bg-primary-container/20 flex items-center justify-center">
                                <Zap className="w-6 h-6 text-primary" />
                              </div>
                              <h3 className="font-headline text-2xl font-bold text-on-background">Summary</h3>
                            </div>

                            {editMode ? (
                              <textarea
                                value={resume.summary || ''}
                                onChange={(e) => updateResume({ summary: e.target.value })}
                                onInput={(e) => {
                                  const el = e.currentTarget;
                                  el.style.height = 'auto';
                                  el.style.height = el.scrollHeight + 'px';
                                }}
                                ref={(el) => {
                                  if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
                                }}
                                className="w-full rounded-xl px-4 py-3 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm resize-none overflow-hidden"
                                rows={1}
                                placeholder="Professional summary..."
                              />
                            ) : (
                              <p className="text-on-background leading-relaxed">{resume.summary}</p>
                            )}
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
                              className="flex items-center justify-between mb-6"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-secondary-container/20 flex items-center justify-center">
                                  <GraduationCap className="w-6 h-6 text-secondary-container" />
                                </div>
                                <h3 className="font-headline text-2xl font-bold text-on-background">Education</h3>
                              </div>
                              {editMode && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newEducation = [...resume.education, { institution: '', location: '', degree: '', duration: '', cgpa: '' }];
                                    updateResume({ education: newEducation }, { immediate: true });
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-xl transition-colors border border-primary/20 flex-shrink-0"
                                >
                                  <PlusCircle className="w-3.5 h-3.5" />
                                  Add
                                </button>
                              )}
                            </div>

                            <div>
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
                                            newEducation[idx] = { ...newEducation[idx], degree: e.target.value };
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
                                            newEducation[idx] = { ...newEducation[idx], institution: e.target.value };
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
                                              newEducation[idx] = { ...newEducation[idx], location: e.target.value };
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
                                              newEducation[idx] = { ...newEducation[idx], duration: e.target.value };
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
                                              newEducation[idx] = { ...newEducation[idx], cgpa: e.target.value };
                                              updateResume({ education: newEducation });
                                            }}
                                            className="flex-1 min-w-0 rounded-xl px-4 py-2 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm mr-2"
                                            placeholder="CGPA / Score"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const newEducation = resume.education.filter((_, i) => i !== idx);
                                              updateResume({ education: newEducation }, { immediate: true });
                                            }}
                                            className="flex-shrink-0 px-3 py-1 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors font-semibold"
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
                                        updateResume({ education: newEducation }, { immediate: true });
                                      }}
                                      className="px-4 py-2 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary/20 transition-colors"
                                      type="button"
                                    >
                                      + Add Education Field
                                    </button>
                                  </div>
                                )}
                              </>
                            </div>
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
                              className="flex items-center justify-between mb-6"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-tertiary-container/20 flex items-center justify-center">
                                  <Briefcase className="w-6 h-6 text-tertiary-container" />
                                </div>
                                <h3 className="font-headline text-2xl font-bold text-on-background">Experience</h3>
                              </div>
                              {editMode && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newExperience = [...resume.experience, { job_title: '', company: '', location: '', duration: '', bullets: [''] }];
                                    updateResume({ experience: newExperience }, { immediate: true });
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-xl transition-colors border border-primary/20 flex-shrink-0"
                                >
                                  <PlusCircle className="w-3.5 h-3.5" />
                                  Add
                                </button>
                              )}
                            </div>

                            <div>
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
                                            newExperience[idx] = { ...newExperience[idx], job_title: e.target.value };
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
                                            newExperience[idx] = { ...newExperience[idx], company: e.target.value };
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
                                              newExperience[idx] = { ...newExperience[idx], duration: e.target.value };
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
                                              newExperience[idx] = { ...newExperience[idx], location: e.target.value };
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
                                                  const newBullets = [...newExperience[idx].bullets];
                                                  newBullets[bidx] = e.target.value;
                                                  newExperience[idx] = { ...newExperience[idx], bullets: newBullets };
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
                                            updateResume({ experience: newExperience }, { immediate: true });
                                          }}
                                          className="px-3 py-1 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors font-semibold"
                                        >
                                          + Add Bullet Point
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const newExperience = resume.experience.filter((_, i) => i !== idx);
                                            updateResume({ experience: newExperience }, { immediate: true });
                                          }}
                                          className="flex-shrink-0 px-3 py-1 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors font-semibold"
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
                                        updateResume({ experience: newExperience }, { immediate: true });
                                      }}
                                      className="px-4 py-2 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary/20 transition-colors"
                                      type="button"
                                    >
                                      + Add Experience
                                    </button>
                                  </div>
                                )}
                              </>
                            </div>
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
                              className="flex items-center justify-between mb-6"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-primary-container/20 flex items-center justify-center">
                                  <FolderGit2 className="w-6 h-6 text-primary" />
                                </div>
                                <h3 className="font-headline text-2xl font-bold text-on-background">Projects</h3>
                              </div>

                            </div>

                            <div>
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
                                              newProjects[idx] = { ...newProjects[idx], title: e.target.value };
                                              updateResume({ projects: newProjects });
                                            }}
                                            className="w-full font-bold rounded-xl px-4 py-2 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm"
                                            placeholder="Project Title"
                                          />
                                          <div className="flex flex-col sm:flex-row gap-2">
                                            <input
                                              type="text"
                                              value={proj.link || ''}
                                              onChange={(e) => {
                                                const newProjects = [...resume.projects];
                                                newProjects[idx] = { ...newProjects[idx], link: e.target.value };
                                                updateResume({ projects: newProjects });
                                              }}
                                              className="sm:w-24 w-full flex-shrink-0 text-sm rounded-xl px-3 py-2 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm"
                                              placeholder="Link"
                                            />
                                            <input
                                              type="url"
                                              value={proj.link_href || ''}
                                              onChange={(e) => {
                                                const newProjects = [...resume.projects];
                                                newProjects[idx] = { ...newProjects[idx], link_href: e.target.value };
                                                updateResume({ projects: newProjects });
                                              }}
                                              className="flex-1 text-sm rounded-xl px-3 py-2 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm"
                                              placeholder="https://github.com/..."
                                            />
                                          </div>
                                        </div>
                                        <input
                                          type="text"
                                          value={proj.tech_stack}
                                          onChange={(e) => {
                                            const newProjects = [...resume.projects];
                                            newProjects[idx] = { ...newProjects[idx], tech_stack: e.target.value };
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
                                                  const newBullets = [...newProjects[idx].bullets];
                                                  newBullets[bidx] = e.target.value;
                                                  newProjects[idx] = { ...newProjects[idx], bullets: newBullets };
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
                                            updateResume({ projects: newProjects }, { immediate: true });
                                          }}
                                          className="px-3 py-1 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors font-semibold"
                                        >
                                          + Add Bullet Point
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const newProjects = resume.projects.filter((_, i) => i !== idx);
                                            updateResume({ projects: newProjects }, { immediate: true });
                                          }}
                                          className="flex-shrink-0 px-3 py-1 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors font-semibold"
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
                                        updateResume({ projects: newProjects }, { immediate: true });
                                      }}
                                      className="px-4 py-2 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary/20 transition-colors"
                                      type="button"
                                    >
                                      + Add Project
                                    </button>
                                  </div>
                                )}
                              </>
                            </div>
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
                              className="flex items-center justify-between mb-6"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center">
                                  <Code className="w-6 h-6 text-black" />
                                </div>
                                <h3 className="font-headline text-2xl font-bold text-on-background">Technical Skills</h3>
                              </div>
                              {editMode && (
                                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-lg border border-primary/20 flex-shrink-0">
                                  <Sparkles className="w-3 h-3" />
                                  Tags
                                </span>
                              )}
                            </div>

                            <div>
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

                                  {/* Custom skill rows */}
                                  {(resume.technical_skills.custom_categories || []).map((cat, catIdx) => (
                                    <div key={catIdx} className="relative group">
                                      {editMode ? (
                                        <div className="flex items-center gap-2 mb-2">
                                          <input
                                            type="text"
                                            value={cat.label}
                                            onChange={(e) => {
                                              const updated = [...(resume.technical_skills.custom_categories || [])];
                                              updated[catIdx] = { ...updated[catIdx], label: e.target.value };
                                              updateResume({ technical_skills: { ...resume.technical_skills, custom_categories: updated } });
                                            }}
                                            placeholder="Category name (e.g. Operating Systems)"
                                            className="font-semibold text-sm rounded-lg px-3 py-1.5 border border-dashed border-primary/40 bg-primary/5 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-on-background min-w-[180px] transition-all"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const updated = (resume.technical_skills.custom_categories || []).filter((_, i) => i !== catIdx);
                                              updateResume({ technical_skills: { ...resume.technical_skills, custom_categories: updated } }, { immediate: true });
                                            }}
                                            className="text-xs text-red-400 hover:text-red-600 font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
                                          >
                                            Remove row
                                          </button>
                                        </div>
                                      ) : (
                                        (cat.label.trim() !== "" || cat.skills.length > 0) && <p className="font-semibold text-on-background mb-2">{cat.label || "Custom"}:</p>
                                      )}
                                      {(editMode || cat.label.trim() !== "" || cat.skills.length > 0) && (
                                        <EditableSkillTags
                                          skills={cat.skills}
                                          onChange={(newSkills) => {
                                            const updated = [...(resume.technical_skills.custom_categories || [])];
                                            updated[catIdx] = { ...updated[catIdx], skills: newSkills };
                                            updateResume({ technical_skills: { ...resume.technical_skills, custom_categories: updated } });
                                          }}
                                          editMode={editMode}
                                          colorClass="bg-violet-500/10 text-violet-700"
                                          showHighlights={false}
                                        />
                                      )}
                                    </div>
                                  ))}

                                  {/* Add custom row button */}
                                  {editMode && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = [...(resume.technical_skills.custom_categories || []), { label: '', skills: [] }];
                                        updateResume({ technical_skills: { ...resume.technical_skills, custom_categories: updated } }, { immediate: true });
                                      }}
                                      className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-primary/30 text-primary/70 hover:border-primary hover:text-primary hover:bg-primary/5 text-sm font-semibold transition-all duration-200 w-full justify-center"
                                    >
                                      <PlusCircle className="w-4 h-4" />
                                      Add custom row
                                    </button>
                                  )}
                                </div>
                              </>
                            </div>
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
                              className="flex items-center justify-between mb-6"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-secondary-container/20 flex items-center justify-center">
                                  <Award className="w-6 h-6 text-secondary-container" />
                                </div>
                                <h3 className="font-headline text-2xl font-bold text-on-background">Certifications & Achievements</h3>
                              </div>
                              {editMode && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newItems = [...uniqueItems, ''];
                                    updateResume({
                                      certifications_and_achievements: newItems,
                                      certifications: [],
                                      achievements: []
                                    });
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-xl transition-colors border border-primary/20 flex-shrink-0"
                                >
                                  <PlusCircle className="w-3.5 h-3.5" />
                                  Add
                                </button>
                              )}
                            </div>

                            <div>
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
                                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors self-start mt-1"
                                          >
                                            <Trash2 className="w-4 h-4" />
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
                            </div>
                          </motion.div>
                        );
                      }

                      default:
                        return null;
                    }
                  })}


                </motion.div>
              )}


              {showChanges && (
                <motion.div
                  key="changes-made"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="w-full max-w-2xl mx-auto space-y-5"
                >
                  {/* ── Sub-section Nav Pills ── */}
                  <div className="flex gap-2 flex-wrap">
                    {resume.job_strategy && resume.job_strategy.length > 0 && (
                      <button
                        type="button"
                        onClick={() => document.getElementById('ai-analysis-job-strategy')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-400/25 hover:bg-amber-500/20 hover:border-amber-400/50 transition-all active:scale-95"
                      >
                        💼 Job Strategy
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => document.getElementById('ai-analysis-suggestions')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#006859]/10 text-[#006859] border border-[#006859]/25 hover:bg-[#006859]/20 hover:border-[#006859]/50 transition-all active:scale-95"
                    >
                      💡 AI Suggestions
                    </button>
                    <button
                      type="button"
                      onClick={() => document.getElementById('ai-analysis-changes')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#12f8d7]/10 text-[#0a9980] border border-[#12f8d7]/25 hover:bg-[#12f8d7]/20 hover:border-[#12f8d7]/50 transition-all active:scale-95"
                    >
                      ✨ AI Changes
                    </button>
                  </div>

                  {/* ── Job Strategy Card ── (shown first) */}
                  {resume.job_strategy && resume.job_strategy.length > 0 && (
                    <div id="ai-analysis-job-strategy" className="rounded-[2rem] overflow-hidden shadow-xl border border-amber-500/20">
                      {/* Header */}
                      <div className="bg-gradient-to-r from-amber-600 to-orange-500 px-6 py-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <h3 className="text-white font-bold text-base leading-tight">Job Strategy</h3>
                          <p className="text-white/70 text-xs">Best-fit roles from your original resume + search queries</p>
                        </div>
                        <span className="ml-auto bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                          {resume.job_strategy.length} roles
                        </span>
                      </div>

                      {/* Role Cards */}
                      <div className="bg-surface-container-lowest px-5 py-5 space-y-4">
                        {resume.job_strategy.map((item, idx) => {
                          const matchColor =
                            item.match === "Strong"
                              ? "bg-emerald-500/15 text-emerald-600 border-emerald-400/30"
                              : item.match === "Good"
                                ? "bg-blue-500/15 text-blue-600 border-blue-400/30"
                                : "bg-amber-500/15 text-amber-600 border-amber-400/30";
                          const matchDot =
                            item.match === "Strong"
                              ? "bg-emerald-500"
                              : item.match === "Good"
                                ? "bg-blue-500"
                                : "bg-amber-500";
                          return (
                            <motion.div
                              key={idx}
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.08 + idx * 0.07 }}
                              className="p-4 rounded-2xl bg-amber-500/5 border border-amber-400/15 hover:bg-amber-500/10 transition-colors"
                            >
                              {/* Role title + match badge */}
                              <div className="flex items-center gap-2 mb-3 flex-wrap">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white text-[10px] font-black flex-shrink-0">
                                  {idx + 1}
                                </div>
                                <p className="font-bold text-sm text-on-background flex-1">{item.role}</p>
                                <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${matchColor}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${matchDot}`} />
                                  {item.match} Match
                                </span>
                              </div>

                              {/* Search Query Pills */}
                              <div className="space-y-2">
                                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
                                  <Search className="w-3 h-3" /> Recommended Searches
                                </p>
                                {item.search_queries.map((query, qIdx) => {
                                  const isLocked = credits === 0 && qIdx === 0;
                                  
                                  const isUrl = query.startsWith("http");
                                  const targetUrl = isUrl ? query : `https://www.google.com/search?q=${encodeURIComponent(query)}`;
                                  const displayLabel = isUrl && query.includes("linkedin.com") ? "Search Posts on LinkedIn" : query;

                                  if (isLocked) {
                                    return (
                                      <button
                                        key={qIdx}
                                        type="button"
                                        onClick={() => { setPricingTrigger("download"); setShowPricingPopup(true); }}
                                        className="relative flex items-start gap-2 w-full text-left px-3 py-2 rounded-xl bg-white/60 border border-amber-300/30 overflow-hidden group cursor-pointer"
                                      >
                                        <Search className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5 opacity-30" />
                                        <span className="text-xs text-on-background leading-relaxed flex-1 font-medium blur-sm select-none pointer-events-none truncate">
                                          {displayLabel}
                                        </span>
                                        <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-amber-50/80 backdrop-blur-[2px] rounded-xl">
                                          <span className="text-sm">🔒</span>
                                          <span className="text-xs font-bold text-amber-700">Unlock full strategy</span>
                                          <span className="text-[10px] font-black bg-amber-500 text-white px-2 py-0.5 rounded-full ml-1">Upgrade</span>
                                        </div>
                                      </button>
                                    );
                                  }
                                  return (
                                    <a
                                      key={qIdx}
                                      href={targetUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-start gap-2 w-full text-left px-3 py-2 rounded-xl bg-white/60 border border-amber-300/30 hover:bg-amber-50 hover:border-amber-400/50 transition-all group"
                                    >
                                      <Search className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                                      <span className="text-xs text-on-background leading-relaxed flex-1 font-medium break-words">{displayLabel}</span>
                                      <ExternalLink className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </a>
                                  );
                                })}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* AI Suggestions Card */}
                  {resume.ai_suggestions && resume.ai_suggestions.length > 0 && (
                    <div id="ai-analysis-suggestions" className="rounded-[2rem] overflow-hidden shadow-xl border border-[#006859]/15">
                      {/* Header */}
                      <div className="bg-gradient-to-r from-[#006859] to-[#0a9980] px-6 py-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" /><line x1="9" y1="21" x2="15" y2="21" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-white font-bold text-base leading-tight">AI Suggestions</h3>
                          <p className="text-white/70 text-xs">These tips make you stand among top1% applicants</p>
                        </div>
                        <span className="ml-auto bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                          {resume.ai_suggestions.length}
                        </span>
                      </div>
                      {/* Suggestions List */}
                      <div className="bg-surface-container-lowest px-6 py-5 space-y-3">
                        {resume.ai_suggestions.map((tip, idx) => {
                          const total = resume.ai_suggestions!.length;
                          const isLocked = credits === 0 && idx >= total - 3;
                          return (
                            <motion.div
                              key={idx}
                              initial={{ opacity: 0, x: -16 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.1 + idx * 0.06 }}
                              className={`relative flex items-start gap-3 p-3 rounded-xl border transition-colors overflow-hidden ${isLocked
                                ? "bg-[#006859]/5 border-[#006859]/10 cursor-pointer"
                                : "bg-[#006859]/5 border-[#006859]/10 hover:bg-[#006859]/10"
                                }`}
                              onClick={isLocked ? () => { setPricingTrigger("download"); setShowPricingPopup(true); } : undefined}
                            >
                              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#006859] to-[#12f8d7] flex items-center justify-center text-white text-[10px] font-black flex-shrink-0 mt-0.5">
                                {idx + 1}
                              </div>
                              <p className={`text-sm text-on-background leading-relaxed flex-1 ${isLocked ? "blur-sm select-none pointer-events-none" : ""}`}>{tip}</p>
                              {isLocked && (
                                <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-[#e8faf7]/80 backdrop-blur-[2px] rounded-xl">
                                  <span className="text-sm">🔒</span>
                                  <span className="text-xs font-bold text-[#006859]">Unlock all tips</span>
                                  <span className="text-[10px] font-black bg-[#006859] text-white px-2 py-0.5 rounded-full ml-1">Upgrade</span>
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* AI Analysis Card */}
                  <div id="ai-analysis-changes" className="rounded-[2rem] overflow-hidden shadow-xl border border-[#006859]/15">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-[#006859] to-[#0a9980] px-6 py-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-white font-bold text-base leading-tight">AI Changes</h3>
                        <p className="text-white/70 text-xs">What the AI improved in your resume</p>
                      </div>
                      <span className="ml-auto bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                        {resume.changes.length}
                      </span>
                    </div>

                    <div className="bg-surface-container-lowest px-6 py-5">
                      {/* Statistics */}
                      <div className="grid grid-cols-2 gap-4 mb-5">
                        <div className="bg-[#006859]/8 p-4 rounded-xl text-center border border-[#006859]/10">
                          <p className="text-3xl font-bold text-[#006859]">+{scoreImprovement}</p>
                          <p className="text-xs text-on-surface-variant mt-1">Points Gained</p>
                        </div>
                        <div className="bg-[#006859]/8 p-4 rounded-xl text-center border border-[#006859]/10">
                          <p className="text-3xl font-bold text-[#006859]">{resume.changes.length}</p>
                          <p className="text-xs text-on-surface-variant mt-1">Improvements</p>
                        </div>
                      </div>

                      {/* Change List — scrollable */}
                      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {resume.changes.map((change, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -16 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 + idx * 0.05 }}
                            className="flex items-start gap-3 p-3 rounded-xl bg-[#006859]/5 border border-[#006859]/10 hover:bg-[#006859]/10 transition-colors"
                          >
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#006859] to-[#12f8d7] flex items-center justify-center text-white text-[10px] font-black flex-shrink-0 mt-0.5">
                              {idx + 1}
                            </div>
                            <p className="text-sm text-on-background leading-relaxed flex-1">{change}</p>
                          </motion.div>
                        ))}
                      </div>
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
                <label htmlFor="highlight-missed" className="flex items-center gap-2 cursor-pointer group select-none">
                  <span className="text-xs font-semibold text-on-background group-hover:text-primary transition-colors">Highlights</span>
                  <div className="relative">
                    <input
                      id="highlight-missed"
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

          <div className="flex-1 w-full bg-[#0c0f12] overflow-y-auto px-4 py-8 sm:px-8 sm:py-12 flex justify-center items-start">
            <div className="relative bg-white shadow-2xl rounded-sm ring-1 ring-white/20 w-full max-w-[850px] transition-all duration-300"
              style={{
                aspectRatio: selectedTemplate === "templateLetter" ? "8.5 / 11" : "210 / 297",
                minHeight: "400px"
              }}
            >
              <MobilePDFPreview key={`desktop-${selectedTemplate}`} refreshKey={JSON.stringify({ resume, showHighlights, matchedKeywords, missingKeywords })}>
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
              </MobilePDFPreview>
            </div>
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
        }}
      />
      {showFeedback && (
        <FeedbackModal
          userId={currentUserId}
          sessionId={sessionGuid}
          onClose={() => setShowFeedback(false)}
        />
      )}

      {showReferral && referralCode && (
        <ReferralModal
          referralCode={referralCode}
          onClose={() => setShowReferral(false)}
        />
      )}
      {/* The 5-Second Teaser Auth Wall */}
      <PricingPopup
        isOpen={showTeaserAuthGate}
        onClose={() => { }} // Un-closable: force login to continue
        onSuccess={() => setShowTeaserAuthGate(false)}
        directPay={false}
        forcePlanSelect={false}
        prefetchedUser={null}
        prefetchedCredits={0}
        disableClose={true}
        loginOnly={true}
      />
    </div>
  );
}
