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
  FolderGit2
} from "lucide-react";
import type { TemplateV1 } from "@/lib/api";
import {
  isBulletEnhanced,
  getHighlightClass,
} from "@/lib/highlighting";
import ResumePDF from "@/components/ResumePDF";
import dynamic from "next/dynamic";

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
const JUNK_PATTERNS = /^(linkedin profile|github link|linkedin|github|link|url|n\/a|none|your.*(url|link|profile|username))$/i;
function cleanDisplayUrl(val: string | undefined | null, fallback: string): string {
  if (!val || JUNK_PATTERNS.test(val.trim())) return fallback;
  return val.replace(/^https?:\/\//i, "");
}

export default function ResultPage() {
  const router = useRouter();
  const [resume, setResume] = useState<TemplateV1 | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChanges, setShowChanges] = useState(true);
  const [copied, setCopied] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showHighlights, setShowHighlights] = useState(true);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  useEffect(() => {
    const resumeData = localStorage.getItem("generated_resume");
    if (!resumeData) {
      router.push("/");
      return;
    }
    const parsed = JSON.parse(resumeData);
    // Sanitize junk LLM values on load so edit fields show clean defaults
    parsed.heading.linkedin_url = cleanDisplayUrl(parsed.heading.linkedin_url, "linkedin.com/in/username");
    parsed.heading.github_url = cleanDisplayUrl(parsed.heading.github_url, "github.com/username");
    // Build hrefs from display text if not already set
    if (!parsed.heading.linkedin_url_href) {
      parsed.heading.linkedin_url_href = `https://${parsed.heading.linkedin_url}`;
    }
    if (!parsed.heading.github_url_href) {
      parsed.heading.github_url_href = `https://${parsed.heading.github_url}`;
    }
    setResume(parsed);
    setLoading(false);
  }, [router]);

  const handleCopyJSON = () => {
    if (resume) {
      navigator.clipboard.writeText(JSON.stringify(resume, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStartOver = () => {
    localStorage.clear();
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
      // Try LaTeX PDF generation first (better quality)
      try {
        const response = await fetch('http://localhost:8000/api/generate-pdf-latex', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resume_data: resume,
            filename: resume.heading.name.replace(/\s+/g, '_')
          })
        });
        
        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${resume.heading.name.replace(/\s+/g, "_")}_Resume.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          return;
        }
      } catch (latexError) {
        console.log('LaTeX PDF generation failed, falling back to React-PDF:', latexError);
      }
      
      // Fallback to React-PDF if LaTeX fails
      const blob = await pdf(<ResumePDF resume={resume} />).toBlob();
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
    <div className="min-h-screen bg-surface font-sans">
      {/* Glassmorphic Toolbar - Fixed Top */}
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="fixed top-0 left-0 right-0 z-50 glass-header border-b border-surface-container-low"
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left: Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-container/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-headline text-lg font-bold text-on-background">Your Resume</h1>
                <p className="text-xs text-on-surface-variant">AI-Optimized</p>
              </div>
            </div>

            {/* Center: Score Badge - Enhanced Visibility */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.3 }}
              className="hidden md:flex items-center gap-4 bg-gradient-to-r from-primary-container/20 to-primary/10 px-8 py-4 rounded-[2rem] border-2 border-primary/30 shadow-lg"
            >
              <div className="text-center px-3">
                <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1">Before</p>
                <p className="text-3xl font-bold text-on-surface-variant">{resume.ats_score_before}</p>
              </div>
              <div className="flex flex-col items-center">
                <TrendingUp className="w-6 h-6 text-primary animate-pulse" />
                <div className="w-12 h-0.5 bg-primary mt-1"></div>
              </div>
              <div className="text-center px-3">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">After</p>
                <p className="text-3xl font-bold text-primary">{resume.ats_score_after}</p>
              </div>
              <div className="bg-gradient-to-r from-primary to-primary-container text-white px-5 py-2 rounded-full text-lg font-bold shadow-md animate-pulse">
                +{scoreImprovement}
              </div>
            </motion.div>

            {/* Right: Actions - Enhanced Visibility */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowHighlights(!showHighlights)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all shadow-md ${
                  showHighlights
                    ? "bg-gradient-to-r from-yellow-400 to-yellow-500 text-white"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-lowest border-2 border-surface-container-high"
                }`}
                title="Toggle AI highlights"
              >
                <Sparkles className="w-5 h-5" />
                <span className="hidden lg:inline text-sm">Highlights</span>
              </button>
              <button
                onClick={() => setEditMode(!editMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all shadow-md ${
                  editMode
                    ? "bg-gradient-to-r from-primary to-primary-container text-white"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-lowest border-2 border-surface-container-high"
                }`}
                title="Toggle edit mode"
              >
                {editMode ? <Eye className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
                <span className="hidden lg:inline text-sm">{editMode ? "View" : "Edit"}</span>
              </button>
              <AnimatePresence>
                {hasUnsavedChanges && (
                  <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    onClick={handleSaveChanges}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold hover:opacity-90 transition-all shadow-md"
                    title="Save changes"
                  >
                    <Save className="w-5 h-5" />
                    <span className="hidden lg:inline text-sm">Save</span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="pt-24 pb-32 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Hero Success Banner */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-gradient-to-br from-primary/20 to-primary-container/20 rounded-[3rem] p-12 mb-12 relative overflow-hidden"
          >
            {/* Decorative blur orbs */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary-container/30 blur-3xl rounded-full animate-pulse"></div>
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-secondary-container/10 blur-3xl rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
            
            <div className="relative z-10 text-center">
              <motion.div
                initial={{ scale: 0, rotate: 0 }}
                animate={{ scale: 1, rotate: 360 }}
                transition={{ type: "spring", duration: 1, delay: 0.4 }}
                className="inline-block mb-6"
              >
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="w-12 h-12 text-primary" />
                </div>
              </motion.div>
              
              <h1 className="font-headline text-4xl md:text-5xl font-bold text-on-background mb-4">
                Your Resume is Ready!
              </h1>
              <p className="text-xl text-on-surface-variant mb-4">
                AI-enhanced and optimized for ATS systems
              </p>
              {resume._model_used && (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-sm mb-8">
                  <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                  <span className="text-on-surface-variant">Generated by</span>
                  <span className="font-bold text-primary">{resume._model_used}</span>
                </div>
              )}

              {/* Mobile Score Display - Enhanced */}
              <div className="md:hidden flex items-center justify-center gap-4 bg-gradient-to-r from-primary-container/20 to-primary/10 backdrop-blur-sm px-6 py-5 rounded-2xl border-2 border-primary/30 shadow-lg">
                <div className="text-center">
                  <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Before</p>
                  <p className="text-3xl font-bold text-on-surface-variant">{resume.ats_score_before}</p>
                </div>
                <div className="flex flex-col items-center">
                  <TrendingUp className="w-6 h-6 text-primary animate-pulse" />
                  <div className="w-8 h-0.5 bg-primary mt-1"></div>
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide">After</p>
                  <p className="text-3xl font-bold text-primary">{resume.ats_score_after}</p>
                </div>
                <div className="bg-gradient-to-r from-primary to-primary-container text-white px-4 py-2 rounded-full text-base font-bold shadow-md animate-pulse">
                  +{scoreImprovement}
                </div>
              </div>
            </div>
          </motion.div>

          {/* PDF PREVIEW ON TOP */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-12 rounded-[2rem] overflow-hidden border-2 border-primary/20 shadow-x2xl bg-surface-container-lowest"
          >
            <div className="bg-primary/5 p-4 border-b border-primary/10 flex items-center justify-between">
              <h2 className="font-headline font-bold text-on-background flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Live PDF Preview
              </h2>
            </div>
            <div className="h-[850px] w-full">
              <PDFViewer width="100%" height="100%" className="border-none">
                <ResumePDF resume={resume} />
              </PDFViewer>
            </div>
          </motion.div>

          {/* Two-Column Layout */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Resume Content - Left (2 columns) */}
            <div className="lg:col-span-2 space-y-6">
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
                      value={cleanDisplayUrl(resume.heading.linkedin_url, "linkedin.com/in/username")}
                      onChange={(e) => updateResume({ heading: { ...resume.heading, linkedin_url: e.target.value } })}
                      className="w-full border-2 border-surface-container-high rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary transition-all"
                      placeholder="linkedin.com/in/username"
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
                          {cleanDisplayUrl(resume.heading.linkedin_url, "linkedin.com/in/username")}
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
              {resume.summary && (
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
                      value={resume.summary}
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
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={proj.title}
                              onChange={(e) => {
                                const newProjects = [...resume.projects];
                                newProjects[idx].title = e.target.value;
                                updateResume({ projects: newProjects });
                              }}
                              className="flex-[2] font-bold border-2 border-surface-container-high rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary"
                              placeholder="Project Title"
                            />
                            <input
                              type="text"
                              value={proj.link || ''}
                              onChange={(e) => {
                                const newProjects = [...resume.projects];
                                newProjects[idx].link = e.target.value;
                                updateResume({ projects: newProjects });
                              }}
                              className="flex-1 text-sm border-2 border-surface-container-high rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary"
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
                              className="flex-[1.5] text-sm border-2 border-surface-container-high rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary"
                              placeholder="Actual Repo URL"
                            />
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
            </div>

            {/* Changes Sidebar - Right (1 column) */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="bg-surface-container-lowest rounded-[2rem] p-8 shadow-2xl border border-secondary-container/10"
                >
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
                        transition={{ delay: 0.6 + idx * 0.05 }}
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
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Action Bar - Bottom */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.8 }}
        className="fixed bottom-0 left-0 right-0 z-40 glass-header border-t border-surface-container-low p-6"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleDownloadPDF}
            disabled={downloadingPDF}
            className={`flex-1 py-4 px-6 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
              downloadingPDF
                ? "bg-surface-container-high cursor-not-allowed"
                : "flash-gradient hover:opacity-90 shadow-xl shadow-primary/25 active:scale-95"
            }`}
          >
            {downloadingPDF ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span>Download PDF</span>
              </>
            )}
          </button>
          <button
            onClick={handleCopyJSON}
            className="flex-1 py-4 px-6 rounded-xl font-bold text-on-background bg-surface-container-low border-2 border-surface-container-high hover:bg-surface-container-lowest transition-all flex items-center justify-center gap-2"
          >
            <Copy className="w-5 h-5" />
            {copied ? "Copied!" : "Copy JSON"}
          </button>
          <button
            onClick={handleStartOver}
            className="flex-1 py-4 px-6 rounded-xl font-bold text-on-background bg-surface-container-low border-2 border-surface-container-high hover:bg-surface-container-lowest transition-all flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            Start Over
          </button>
        </div>
      </motion.div>
    </div>
  );
}
