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
  GripVertical
} from "lucide-react";
import type { TemplateV1 } from "@/lib/api";
import {
  isBulletEnhanced,
  getHighlightClass,
} from "@/lib/highlighting";
import ResumePDF from "@/components/ResumePDF";
import ResumePDFTemplate2 from "@/components/ResumePDFTemplate2";
import dynamic from "next/dynamic";
import DownloadGateModal from "@/components/DownloadGateModal";
import CreditBadge from "@/components/CreditBadge";
import { supabase } from "@/lib/supabase";

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
            className={`px-3 py-1.5 ${colorClass} rounded-full text-sm font-medium flex items-center gap-2 ${
              showHighlights && isHighlighted ? "ring-2 ring-yellow-400 shadow-lg shadow-yellow-200/50 scale-105" : ""
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
            className="px-3 py-1.5 border-2 border-dashed border-surface-container-high rounded-full text-sm focus:outline-none focus:border-primary"
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showHighlights, setShowHighlights] = useState(true);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [missingKeywords, setMissingKeywords] = useState<string[]>([]);
  const [matchedKeywords, setMatchedKeywords] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<"template1" | "template2">("template1");
  // Native HTML5 drag state — simple, fires exactly once on drop
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [showDownloadGate, setShowDownloadGate] = useState(false);
  const [hasPaidAccess, setHasPaidAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  const handleSectionDragStart = (sectionId: string) => {
    setDraggingId(sectionId);
  };

  const handleSectionDragOver = (e: React.DragEvent, sectionId: string) => {
    e.preventDefault();
    setDragOverId(sectionId);
  };

  const handleSectionDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggingId || draggingId === targetId || !resume) return;
    const currentOrder = resume.section_order || ["summary", "education", "experience", "projects", "skills", "certifications"];
    const fromIdx = currentOrder.indexOf(draggingId);
    const toIdx = currentOrder.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const newOrder = [...currentOrder];
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, draggingId);
    updateResume({ section_order: newOrder });
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleSectionDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  useEffect(() => {
    const fetchSession = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get("session_id");
      
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
          setMissingKeywords(parsedAnalysis.missing_skills || []);
          setMatchedKeywords(parsedAnalysis.matched_skills || []);
        } catch(e) {}
      }

      if (!parsed.section_order || parsed.section_order.length === 0) {
        parsed.section_order = ["summary", "education", "experience", "projects", "skills", "certifications"];
      }
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
    const { data } = await supabase
      .from("users")
      .select("credits_balance")
      .eq("id", session.user.id)
      .single();

    if (data && data.credits_balance >= 10) {
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

  const handleCopyJSON = () => {
    if (resume) {
      navigator.clipboard.writeText(JSON.stringify(resume, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStartOver = () => {
    localStorage.removeItem("generated_resume");
    localStorage.removeItem("resume_text");
    localStorage.removeItem("job_description");
    localStorage.removeItem("analysis");
    localStorage.removeItem("no_jd_mode");
    localStorage.removeItem("approved_project");
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
    
    // Deduct credit first
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setShowDownloadGate(true);
      setDownloadingPDF(false);
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    try {
      const res = await fetch(`${apiUrl}/api/payments/deduct-credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          user_id: session.user.id,
          session_id: new URLSearchParams(window.location.search).get("session_id") || undefined
        })
      });
      
      if (!res.ok) {
        setShowDownloadGate(true);
        setDownloadingPDF(false);
        return;
      }
      
      // Re-evaluate access silently
      await checkAccess();
    } catch (e) {
      console.error("Failed to deduct credit", e);
      setShowDownloadGate(true);
      setDownloadingPDF(false);
      return;
    }

    try {
      // Use React-PDF for high-quality, ATS-friendly frontend PDF generation
      // Ensure highlights are strictly DISABLED for the downloaded PDF
      const PDFComponent = selectedTemplate === "template1" 
                           ? ResumePDF 
                           : ResumePDFTemplate2;
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
    } catch (error) {
      console.error("PDF generation failed:", error);
    } finally {
      setDownloadingPDF(false);
    }
  };

  const handleDownloadPDFDirect = async () => {
    if (!resume) return;
    setDownloadingPDF(true);
    try {
      const PDFComponent = selectedTemplate === "template1" 
                           ? ResumePDF 
                           : ResumePDFTemplate2;
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
              <Sparkles className="w-8 h-8 text-primary-container animate-pulse" />
            </div>
          </div>
          <p className="text-on-surface-variant font-medium">Loading your resume...</p>
        </div>
      </div>
    );
  }

  const scoreImprovement = resume.ats_score_after - resume.ats_score_before;

  return (
    <div className="h-[100dvh] flex flex-col bg-surface font-sans overflow-hidden">
      {/* Top App Bar - Fixed non-scrolling */}
      <header className="flex-shrink-0 z-50 bg-surface border-b border-surface-container-low shadow-sm">
        <div className="w-full px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-container/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-headline text-lg font-bold text-on-background leading-tight">Your Resume</h1>
              <p className="text-xs text-on-surface-variant leading-tight flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-primary" /> AI-Optimized
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <CreditBadge onTopUpClick={() => setShowDownloadGate(true)} />
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
              onClick={handleCopyJSON}
              className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold text-on-surface-variant bg-surface-container-low hover:bg-surface-container-high transition-colors"
            >
              <Copy className="w-4 h-4" />
              {copied ? "Copied" : "JSON"}
            </button>
            
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
                  handleDownloadPDF();   // already paid → download directly
                } else {
                  setShowDownloadGate(true);  // not paid → show gate
                }
              }}
              disabled={downloadingPDF || checkingAccess}
              className={`flex items-center gap-2 px-4 py-1.5 sm:px-5 sm:py-2 rounded-xl text-sm font-bold text-white transition-all shadow-sm ${
                downloadingPDF || checkingAccess
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
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row relative">
        
        {/* Left Column (Editor & Metrics) */}
        <div className="w-full lg:w-[45%] h-full flex flex-col bg-surface border-r border-surface-container-low z-10 shadow-xl lg:shadow-none transition-all">
          
          {/* Segmented Toggles inside Sticky Top */}
          <div className="flex-shrink-0 bg-surface/95 backdrop-blur-md p-4 border-b border-surface-container-low flex flex-col gap-3 py-4 sticky top-0 z-20">
            <div className="flex bg-surface-container-lowest p-1 rounded-[1.25rem] border border-surface-container-low shadow-inner">
              <button
                onClick={() => { setEditMode(true); setShowChanges(false); setShowMissedKeywords(false); }}
                className={`flex-1 py-2 px-2 text-sm font-semibold transition-all rounded-xl flex items-center justify-center gap-2 ${
                  editMode
                    ? "bg-primary text-white shadow-md relative"
                    : "text-on-surface-variant hover:text-on-background hover:bg-surface-container"
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
                className={`flex-1 py-2 px-2 text-sm font-semibold transition-all rounded-xl flex items-center justify-center gap-2 ${
                  showChanges
                    ? "bg-secondary-container text-secondary-container-on shadow-md text-secondary"
                    : "text-on-surface-variant hover:text-on-background hover:bg-surface-container"
                }`}
              >
                <Sparkles className={`w-4 h-4 ${showChanges ? 'text-secondary' : 'text-on-surface-variant'}`} />
                AI Changes
              </button>
              <button
                onClick={() => { setShowMissedKeywords(true); setEditMode(false); setShowChanges(false); }}
                className={`flex-1 py-2 px-2 text-sm font-semibold transition-all rounded-xl flex items-center justify-center gap-2 ${
                  showMissedKeywords
                    ? "bg-error text-white shadow-md relative"
                    : "text-on-surface-variant hover:text-on-background hover:bg-surface-container"
                }`}
              >
                <Zap className={`w-4 h-4 ${showMissedKeywords ? 'text-white' : 'text-on-surface-variant'}`} />
                Missed Keywords
                {missingKeywords.length > 0 && !showMissedKeywords && (
                  <span className="absolute top-2 right-2 flex min-w-[16px] h-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-white shadow-[0_0_0_2px_#fff]">{missingKeywords.length}</span>
                )}
              </button>
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
              
              {/* Drag Drop Section Reordering */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-surface-container-lowest rounded-[2rem] p-6 shadow-md border border-primary/10"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-headline font-bold text-on-background text-lg">Reorder Sections</h3>
                  <span className="text-sm text-on-surface-variant bg-surface-container px-3 py-1 rounded-full">Drag to reorder</span>
                </div>
                <div className="space-y-2">
                  {(resume.section_order || []).map((sectionId) => {
                    const sectionMeta = SECTION_LABELS[sectionId];
                    if (!sectionMeta) return null;
                    const isDragging = draggingId === sectionId;
                    const isOver = dragOverId === sectionId && !isDragging;
                    return (
                      <div
                        key={sectionId}
                        draggable
                        onDragStart={() => handleSectionDragStart(sectionId)}
                        onDragOver={(e) => handleSectionDragOver(e, sectionId)}
                        onDrop={(e) => handleSectionDrop(e, sectionId)}
                        onDragEnd={handleSectionDragEnd}
                        className={`flex items-center gap-4 px-4 py-3 rounded-xl cursor-grab active:cursor-grabbing border-2 transition-all duration-150 shadow-sm select-none
                          ${ isDragging ? "opacity-40 scale-95 bg-surface-container border-primary/30" : "bg-surface-container border-transparent hover:border-primary/20" }
                          ${ isOver ? "border-primary bg-primary/5 scale-[1.02]" : "" }
                        `}
                      >
                        <GripVertical className="text-on-surface-variant/50 w-5 h-5 flex-shrink-0" />
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center">
                            {sectionMeta.icon}
                          </div>
                          <span className="font-semibold text-on-background">{sectionMeta.label}</span>
                        </div>
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
                className="bg-surface-container-lowest rounded-[2rem] p-8 shadow-xl hover:shadow-2xl transition-all duration-300 border border-primary/5"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-primary-container/20 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-headline text-2xl font-bold text-on-background">Contact Information</h3>
                </div>
                
                {editMode ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={resume.heading.name}
                      onChange={(e) => updateResume({ heading: { ...resume.heading, name: e.target.value } })}
                      className="w-full text-2xl font-bold text-on-background border-2 border-primary-container/40 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary transition-all"
                      placeholder="Full Name"
                    />
                    <input
                      type="tel"
                      value={resume.heading.phone}
                      onChange={(e) => updateResume({ heading: { ...resume.heading, phone: e.target.value } })}
                      className="w-full border-2 border-surface-container-high rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary transition-all"
                      placeholder="Phone"
                    />
                    <input
                      type="email"
                      value={resume.heading.email}
                      onChange={(e) => updateResume({ heading: { ...resume.heading, email: e.target.value } })}
                      className="w-full border-2 border-surface-container-high rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary transition-all"
                      placeholder="Email"
                    />
                    {/* LinkedIn: display text + actual URL */}
                    <p className="text-xs text-on-surface-variant font-semibold uppercase tracking-wide">LinkedIn</p>
                    <input
                      type="text"
                      value={cleanDisplayUrl(resume.heading.linkedin_url, "linkedin")}
                      onChange={(e) => updateResume({ heading: { ...resume.heading, linkedin_url: e.target.value } })}
                      className="w-full border-2 border-surface-container-high rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary transition-all"
                      placeholder="linkedin"
                    />
                    <input
                      type="url"
                      value={resume.heading.linkedin_url_href || "https://linkedin.com/in/username"}
                      onChange={(e) => updateResume({ heading: { ...resume.heading, linkedin_url_href: e.target.value } })}
                      className="w-full border-2 border-surface-container-high rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary transition-all text-on-surface-variant"
                      placeholder="https://linkedin.com/in/username"
                    />
                    {/* GitHub: display text + actual URL */}
                    <p className="text-xs text-on-surface-variant font-semibold uppercase tracking-wide">GitHub</p>
                    <input
                      type="text"
                      value={cleanDisplayUrl(resume.heading.github_url, "github.com/username")}
                      onChange={(e) => updateResume({ heading: { ...resume.heading, github_url: e.target.value } })}
                      className="w-full border-2 border-surface-container-high rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary transition-all"
                      placeholder="github.com/username"
                    />
                    <input
                      type="url"
                      value={resume.heading.github_url_href || "https://github.com/username"}
                      onChange={(e) => updateResume({ heading: { ...resume.heading, github_url_href: e.target.value } })}
                      className="w-full border-2 border-surface-container-high rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary transition-all text-on-surface-variant"
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

              {/* Summary Section */}
              {(resume.summary || editMode) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  whileHover={{ y: -4 }}
                  className="bg-surface-container-lowest rounded-[2rem] p-8 shadow-xl hover:shadow-2xl transition-all duration-300 border border-primary/5"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-primary-container/20 flex items-center justify-center">
                      <Zap className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-headline text-2xl font-bold text-on-background">Summary</h3>
                  </div>
                  
                  {editMode ? (
                    <textarea
                      value={resume.summary || ''}
                      onChange={(e) => updateResume({ summary: e.target.value })}
                      className="w-full border-2 border-surface-container-high rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary resize-none"
                      rows={3}
                      placeholder="Professional summary..."
                    />
                  ) : (
                    <p className="text-on-background leading-relaxed">{resume.summary}</p>
                  )}
                </motion.div>
              )}

              {/* Education Section */}
              {resume.education.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  whileHover={{ y: -4 }}
                  className="bg-surface-container-lowest rounded-[2rem] p-8 shadow-xl hover:shadow-2xl transition-all duration-300 border border-primary/5"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-secondary-container/20 flex items-center justify-center">
                      <GraduationCap className="w-6 h-6 text-secondary-container" />
                    </div>
                    <h3 className="font-headline text-2xl font-bold text-on-background">Education</h3>
                  </div>
                  
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
                            className="w-full font-bold border-2 border-surface-container-high rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary"
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
                            className="w-full border-2 border-surface-container-high rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary"
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
                              className="border-2 border-surface-container-high rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary"
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
                              className="border-2 border-surface-container-high rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary"
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
                              className="flex-1 border-2 border-surface-container-high rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary mr-4"
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
                </motion.div>
              )}

              {/* Experience Section - Continuing in next part due to length */}
              {resume.experience.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  whileHover={{ y: -4 }}
                  className="bg-surface-container-lowest rounded-[2rem] p-8 shadow-xl hover:shadow-2xl transition-all duration-300 border border-primary/5"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-tertiary-container/20 flex items-center justify-center">
                      <Briefcase className="w-6 h-6 text-tertiary-container" />
                    </div>
                    <h3 className="font-headline text-2xl font-bold text-on-background">Experience</h3>
                  </div>
                  
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
                            className="w-full font-bold border-2 border-surface-container-high rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary"
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
                            className="w-full border-2 border-surface-container-high rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary"
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
                              className="text-sm border-2 border-surface-container-high rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary"
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
                              className="text-sm border-2 border-surface-container-high rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary"
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
                                  className="flex-1 border-2 border-surface-container-high rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary resize-none"
                                  rows={2}
                                />
                              ) : (
                                <span className="flex items-start gap-2 flex-1">
                                  <span className="flex-1">{bullet}</span>
                                  {showHighlights && isHighlighted && (
                                    <Sparkles className="w-4 h-4 text-yellow-500 flex-shrink-0 animate-pulse" title="AI enhanced" />
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
                </motion.div>
              )}

              {/* Projects Section */}
              {resume.projects.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  whileHover={{ y: -4 }}
                  className="bg-surface-container-lowest rounded-[2rem] p-8 shadow-xl hover:shadow-2xl transition-all duration-300 border border-primary/5"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-primary-container/20 flex items-center justify-center">
                      <FolderGit2 className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-headline text-2xl font-bold text-on-background">Projects</h3>
                  </div>
                  
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
                              className="w-full font-bold border-2 border-surface-container-high rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary"
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
                                className="flex-[1] text-sm border-2 border-surface-container-high rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary"
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
                                className="flex-[2] text-sm border-2 border-surface-container-high rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary"
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
                            className="w-full text-sm border-2 border-surface-container-high rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary"
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
                                  className="flex-1 border-2 border-surface-container-high rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary resize-none"
                                  rows={2}
                                />
                              ) : (
                                <span className="flex items-start gap-2 flex-1">
                                  <span className="flex-1">{bullet}</span>
                                  {showHighlights && isHighlighted && (
                                    <Sparkles className="w-4 h-4 text-yellow-500 flex-shrink-0 animate-pulse" title="AI enhanced" />
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
                          const newProjects = [...resume.projects, { title: '', tech_stack: '', link: '', link_href: '', bullets: [''] }];
                          updateResume({ projects: newProjects });
                        }}
                        className="px-4 py-2 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary/20 transition-colors"
                        type="button"
                      >
                        + Add Project
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Technical Skills Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                whileHover={{ y: -4 }}
                className="bg-surface-container-lowest rounded-[2rem] p-8 shadow-xl hover:shadow-2xl transition-all duration-300 border border-primary/5"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-secondary-container/20 flex items-center justify-center">
                    <Code className="w-6 h-6 text-secondary-container" />
                  </div>
                  <h3 className="font-headline text-2xl font-bold text-on-background">Technical Skills</h3>
                </div>
                
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
                  {(editMode || resume.technical_skills.frameworks.length > 0) && (
                    <div>
                      <p className="font-semibold text-on-background mb-2">Frameworks & Libraries:</p>
                      <EditableSkillTags
                        skills={resume.technical_skills.frameworks}
                        onChange={(newSkills) =>
                          updateResume({
                            technical_skills: {
                              ...resume.technical_skills,
                              frameworks: newSkills,
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
              </motion.div>

              {/* Certifications Section (if 2+ certifications) */}
              {resume.certifications && resume.certifications.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.75 }}
                  whileHover={{ y: -4 }}
                  className="bg-surface-container-lowest rounded-[2rem] p-8 shadow-xl hover:shadow-2xl transition-all duration-300 border border-primary/5"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-primary-container/20 flex items-center justify-center">
                      <Award className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-headline text-2xl font-bold text-on-background">Certifications</h3>
                  </div>
                  
                  <ul className="space-y-3">
                    {resume.certifications.map((cert, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-on-background">
                        <span className="text-primary mt-1">•</span>
                        {editMode ? (
                          <textarea
                            value={cert}
                            onChange={(e) => {
                              const newCertifications = [...resume.certifications!];
                              newCertifications[idx] = e.target.value;
                              updateResume({ certifications: newCertifications });
                            }}
                            className="flex-1 border-2 border-surface-container-high rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary resize-none"
                            rows={2}
                          />
                        ) : (
                          <span className="flex-1">{cert}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}

              {/* Certifications / Achievements */}
              {(() => {
                const combinedItems = [
                  ...(resume.certifications_and_achievements ?? []),
                  ...(resume.certifications ?? []),
                  ...(resume.achievements ?? []),
                ];
                const uniqueItems = [...new Set(combinedItems)];

                if (uniqueItems.length === 0) return null;

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.75 }}
                    whileHover={{ y: -4 }}
                    className="bg-surface-container-lowest rounded-[2rem] p-8 shadow-xl hover:shadow-2xl transition-all duration-300 border border-primary/5"
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-tertiary-container/20 flex items-center justify-center">
                        <Award className="w-6 h-6 text-tertiary-container" />
                      </div>
                      <h3 className="font-headline text-2xl font-bold text-on-background">Certifications / Achievements</h3>
                    </div>
                    
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
                                className="flex-1 border-2 border-surface-container-high rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary resize-none"
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
                  </motion.div>
                );
              })()}
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
                <div className="bg-surface-container-lowest rounded-[2rem] p-8 shadow-2xl border border-secondary-container/10">
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
                <div className="bg-surface-container-lowest rounded-[2rem] p-8 shadow-2xl border border-error/10">
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
                        These keywords from the job description could not be naturally integrated into your existing experience. Try to explicitly add these terms into your skills or bullet points if applicable to your actual experience.
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

        {/* Right Column (Live PDF Preview) */}
        <div className="w-full lg:w-[55%] h-[60vh] lg:h-full bg-surface-container-lowest relative flex flex-col">
          {/* Floating Controls Row */}
          <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
             {/* Template Selector */}
             <div className="flex bg-surface/90 backdrop-blur-md rounded-2xl shadow-lg border border-primary/10 overflow-hidden">
                <button 
                  onClick={() => setSelectedTemplate("template1")}
                  className={`px-3 py-2 text-xs font-semibold transition-colors ${selectedTemplate === "template1" ? "bg-primary text-white" : "text-on-surface-variant hover:bg-surface-container"}`}
                >
                  Template 1
                </button>
                <div className="w-[1px] bg-primary/10"></div>
                <button 
                  onClick={() => setSelectedTemplate("template2")}
                  className={`px-3 py-2 text-xs font-semibold transition-colors ${selectedTemplate === "template2" ? "bg-primary text-white" : "text-on-surface-variant hover:bg-surface-container"}`}
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
            <PDFViewer key={`${selectedTemplate}-${showHighlights ? "on" : "off"}`} width="100%" height="100%" className="border-none" showToolbar={true}>
              {selectedTemplate === "template1" ? (
                <ResumePDF 
                  resume={resume} 
                  showHighlights={showHighlights}
                  matchedKeywords={matchedKeywords}
                  missingKeywords={missingKeywords}
                />
              ) : (
                <ResumePDFTemplate2 
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
      {/* Download Gate Modal */}
      <DownloadGateModal
        isOpen={showDownloadGate}
        onClose={() => setShowDownloadGate(false)}
        onPaymentSuccess={() => {
          setHasPaidAccess(true);      // unlock for this session
          setShowDownloadGate(false);
          handleDownloadPDFDirect();          // trigger download immediately after payment
        }}
        initialPlan={null}
      />
    </div>
  );
}
