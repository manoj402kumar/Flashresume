"use client";

import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight,
  Bolt,
  Check,
  CheckCircle2,
  CloudUpload,
  Rocket,
  Star,
  Upload,
  Verified,
  AlertTriangle,
  Wand2,
  FileText,
  X,
  User as UserIcon,
  Loader2,
  Crosshair,
  Sparkles,
  PenLine,
  SlidersHorizontal,
  GraduationCap,
  Briefcase
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { parseResume, analyzeResume } from "@/lib/api";
import PricingPopup from "@/components/PricingPopup";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import CreditBadge from "@/components/CreditBadge";
import AccountSection from "@/components/AccountSection";
import LiveDemoSection from "@/components/LiveDemoSection";
import ModelSelector from "@/components/ModelSelector";

export default function App() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [inputType, setInputType] = useState<"file" | "text">("file");
  const [parsedText, setParsedText] = useState("");
  const [showParsedText, setShowParsedText] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [showDownloadGate, setShowDownloadGate] = useState(false);
  const [selectedPricingPlan, setSelectedPricingPlan] = useState<"pay_per_use" | "regular" | "student" | null>(null);
  const [showLoginOnly, setShowLoginOnly] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [credits, setCredits] = useState<number>(0);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [optimizeMode, setOptimizeMode] = useState<"jd" | "no_jd" | "manual" | null>("jd");
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setCurrentUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowModeDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const fetchAccountData = async () => {
      const { data: userData } = await supabase.from("users").select("credits_balance").eq("id", currentUser.id).single();
      if (userData) setCredits(userData.credits_balance);

      const { data: subData } = await supabase.from("subscriptions").select("*").eq("user_id", currentUser.id).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
      setSubscriptionData(subData);
    };

    fetchAccountData();

    // Subscribe to credit updates
    const channel = supabase.channel(`page_credits_${currentUser.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${currentUser.id}` }, (payload) => {
        setCredits(payload.new.credits_balance);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/jpg",
      "image/png"
    ];
    if (droppedFile && allowedTypes.includes(droppedFile.type)) {
      setFile(droppedFile);
      setResumeText("");
      setError("");
    } else {
      setError("Please upload PDF, DOCX, JPG, or PNG file");
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResumeText("");
      setError("");
      setParsedText("");

      // Auto-parse for better UX (silent background parsing)
      setParsing(true);
      try {
        const parseResult = await parseResume(selectedFile);
        setParsedText(parseResult.resume_text);
      } catch (err: any) {
        // Silent fail - user can click button if needed
        console.log("Auto-parse failed:", err.message);
      } finally {
        setParsing(false);
      }
    }
  };

  const handleSeeParsedText = async () => {
    if (!file) {
      setError("Please upload a file first");
      return;
    }

    setParsing(true);
    setError("");

    try {
      const parseResult = await parseResume(file);
      setParsedText(parseResult.resume_text);
      setShowParsedText(true);
    } catch (err: any) {
      setError(err.message || "Failed to parse file");
    } finally {
      setParsing(false);
    }
  };

  const handleGenerate = async () => {
    if (inputType === "file" && !file) {
      setError("Please upload a resume file");
      return;
    }
    if (inputType === "text" && !resumeText.trim()) {
      setError("Please paste your resume text");
      return;
    }

    setLoading(true);
    setError("");

    // Clear stale flags from any previous session
    localStorage.removeItem("no_jd_mode");

    try {
      let finalResumeText = resumeText;

      if (inputType === "file" && file) {
        const parseResult = await parseResume(file);
        finalResumeText = parseResult.resume_text;
      }

      localStorage.setItem("resume_text", finalResumeText);
      localStorage.setItem("job_description", optimizeMode === "jd" ? jobDescription : "");
      // Clear any leaked state from previous runs
      localStorage.removeItem("approved_project");
      localStorage.setItem("no_ai_changes", optimizeMode === "manual" ? "true" : "false");

      if (!optimizeMode) {
        setError("Please select an optimization mode.");
        setLoading(false);
        return;
      }

      if (optimizeMode === "jd") {
        // Optimize for JD: validate JD present, analyze against it
        if (!jobDescription.trim()) {
          setError("Please paste a job description to optimize for.");
          setLoading(false);
          return;
        }
        // Read R1 model preference (set by the R1 ModelSelector on this page)
        const r1Model = localStorage.getItem("r1_preferred_model") ?? "";
        const analysisResult = await analyzeResume(finalResumeText, jobDescription, r1Model);
        localStorage.setItem("analysis", JSON.stringify(analysisResult));
        router.push("/analyze");
      } else {
        // No-JD mode or Manual: skip analysis, go straight to preview
        const dummyAnalysis = {
          ats_score: 0,
          matched_skills: [],
          missing_skills: [],
          has_relevant_projects: true,
          relevant_projects: [],
          total_projects_count: 0,
          requires_consent: false,
          suggested_project: null,
        };
        localStorage.setItem("analysis", JSON.stringify(dummyAnalysis));
        localStorage.setItem("no_jd_mode", "true");
        router.push("/generate");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen font-sans" suppressHydrationWarning>
      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 glass-header border-b border-surface-container-low">
        <div className="flex justify-between items-center max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 w-full">
          <div className="flex items-center gap-2 shrink-0">
            {/* Hexagon logo mark */}
            <div className="relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9">
              <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-[0_0_6px_rgba(0,210,190,0.45)]">
                <path
                  d="M18 2L32 10V26L18 34L4 26V10L18 2Z"
                  fill="url(#hex-grad)"
                  stroke="rgba(0,210,190,0.3)"
                  strokeWidth="0.8"
                />
                <defs>
                  <linearGradient id="hex-grad" x1="4" y1="2" x2="32" y2="34" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#00D2BE" />
                    <stop offset="1" stopColor="#00A896" />
                  </linearGradient>
                </defs>
                {/* Bolt icon centered */}
                <path
                  d="M20 8L13 20h6l-1 8 8-12h-6l1-8z"
                  fill="white"
                  fillOpacity="0.95"
                  transform="translate(-1.5, 0)"
                />
              </svg>
            </div>
            <span className="text-xl sm:text-2xl font-extrabold tracking-tighter text-on-background font-headline">
              Flashresume
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#process" className="text-on-surface-variant hover:text-primary transition-colors font-medium">Process</a>
            {currentUser && (
              <a href="#pricing" className="text-on-surface-variant hover:text-primary transition-colors font-medium">Pricing</a>
            )}
            <a href="#reviews" className="text-on-surface-variant hover:text-primary transition-colors font-medium">Reviews</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {currentUser ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <CreditBadge onTopUpClick={() => { setSelectedPricingPlan(null); setShowDownloadGate(true); }} />

                {/* Account Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-colors flex items-center justify-center relative shadow-sm"
                  >
                    <UserIcon className="w-4 h-4 sm:w-5 sm:h-5 text-on-surface-variant" />
                    {credits < 10 && <span className="absolute top-0 right-0 w-3 h-3 bg-error rounded-full border-2 border-surface"></span>}
                  </button>

                  <AnimatePresence>
                    {showAccountDropdown && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowAccountDropdown(false)}></div>
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 mt-3 w-72 bg-surface-container-lowest border border-surface-container-high rounded-2xl shadow-2xl overflow-hidden z-50"
                        >
                          <div className="p-4 border-b border-surface-container-low bg-surface-container-lowest">
                            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Account</p>
                            <p className="text-sm text-on-background truncate font-medium">{currentUser.email}</p>
                          </div>

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

                            <div className="pt-2 space-y-2">
                              <button
                                onClick={() => {
                                  setShowAccountDropdown(false);
                                  setShowDownloadGate(true);
                                }}
                                className="w-full py-2.5 bg-surface-container-low hover:bg-surface-container-high text-on-background text-sm font-bold rounded-xl transition-colors"
                              >
                                Buy More Credits
                              </button>

                              <button
                                onClick={async () => {
                                  await supabase.auth.signOut();
                                  setCurrentUser(null);
                                  setShowAccountDropdown(false);
                                }}
                                className="w-full py-2.5 text-error text-sm font-bold rounded-xl hover:bg-error/10 transition-colors border border-error/20"
                              >
                                Sign Out
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowLoginOnly(true)}
                  className="text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 rounded-full border border-on-surface-variant/20 hover:bg-surface-container-low transition-colors text-on-surface-variant whitespace-nowrap"
                >
                  Log In
                </button>
                <button
                  onClick={() => document.getElementById('upload-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  className="flash-gradient text-white font-bold text-xs sm:text-sm px-4 sm:px-6 py-2 sm:py-2.5 rounded-full hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-primary/20 whitespace-nowrap"
                >
                  Get Started
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>


      <main className="pt-24">
        {/* Hero Section */}
        <section className="max-w-5xl mx-auto px-6 py-20 md:py-32 flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h1 className="font-headline text-5xl md:text-7xl font-bold tracking-tight text-on-background leading-[1.1] mb-6">
              Your resume, <br className="md:hidden" />
              <span className="text-primary italic">rebuilt</span> in <span className="bg-primary-container/30 px-3 rounded-xl mx-1">60 seconds.</span>
            </h1>
            <p className="text-xl text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
              Just put your resume and we take the rest.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="w-full max-w-2xl relative mx-auto"
          >
            <div id="upload-card" className="bg-surface-container-lowest rounded-[2rem] p-8 shadow-2xl shadow-primary/5 border border-primary/5">
              <div className="space-y-6">
                <div className="flex gap-2 p-1.5 bg-surface-container-low rounded-xl">
                  <button
                    onClick={() => setInputType("file")}
                    className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary ${inputType === "file"
                      ? "bg-surface-container-lowest text-primary shadow-sm"
                      : "text-on-surface-variant hover:text-on-background hover:bg-surface-container-low/50"
                      }`}
                  >
                    Upload File
                  </button>
                  <button
                    onClick={() => setInputType("text")}
                    className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary ${inputType === "text"
                      ? "bg-surface-container-lowest text-primary shadow-sm"
                      : "text-on-surface-variant hover:text-on-background hover:bg-surface-container-low/50"
                      }`}
                  >
                    Paste Text
                  </button>
                </div>


                {inputType === "file" ? (
                  <>
                    <input
                      type="file"
                      accept=".pdf,.docx,.jpg,.jpeg,.png"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      onDrop={handleDrop}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      className={`p-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors ${isDragging
                        ? "border-primary bg-primary/5"
                        : file
                          ? "border-primary-container bg-primary-container/10"
                          : "border-primary-container/50 bg-surface-container-low hover:bg-surface-container-lowest"
                        }`}
                    >
                      <CloudUpload className="text-primary w-12 h-12 mb-4" />
                      <span className="font-headline text-on-background font-bold text-center">
                        {file ? file.name : "Drop your current resume"}
                      </span>
                      <span className="text-sm text-on-surface-variant mt-2 text-center">PDF, DOCX, JPG, PNG (Max 10MB)</span>
                    </label>
                  </>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={resumeText}
                      onChange={(e) => setResumeText(e.target.value)}
                      className="w-full px-6 py-4 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary-container transition-all placeholder:text-on-surface-variant/50 min-h-[224px] resize-none"
                      placeholder="Paste your current resume text here... (Experience, Education, Skills, etc.)"
                    />
                  </div>
                )}
                <div className="flex justify-end mt-1">
                  <a
                    href="/scratch"
                    className="text-xs font-semibold text-tertiary hover:text-tertiary-container transition-colors flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    No old resume?
                  </a>
                </div>
                {/* ── Optimize Mode Selection ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-surface-container-low rounded-2xl p-2 sm:p-1.5 sm:pl-5">
                  <p className="font-sans text-[11px] font-bold uppercase tracking-wider text-on-surface-variant pl-2 sm:pl-0 pt-1 sm:pt-0">
                    Select an option
                  </p>
                  <div className="grid grid-cols-3 sm:flex w-full sm:w-auto gap-1.5 sm:gap-1">
                    {([
                      {
                        id: "jd" as const,
                        activeCls: "bg-surface-container-lowest text-primary shadow-sm border border-surface-container-highest",
                        radioBorder: "border-primary",
                        radioDot: "bg-primary",
                        label: "With JD",
                      },
                      {
                        id: "no_jd" as const,
                        activeCls: "bg-surface-container-lowest text-primary shadow-sm border border-surface-container-highest",
                        radioBorder: "border-primary",
                        radioDot: "bg-primary",
                        label: "No JD",
                      },
                      {
                        id: "manual" as const,
                        activeCls: "bg-surface-container-lowest text-primary shadow-sm border border-surface-container-highest",
                        radioBorder: "border-primary",
                        radioDot: "bg-primary",
                        label: "No Change",
                      }
                    ] as const).map((opt) => {
                      const isActive = optimizeMode === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setOptimizeMode(opt.id)}
                          className={`flex items-center justify-center gap-1.5 sm:gap-2 px-1 sm:px-3 py-2.5 rounded-xl transition-all duration-200 border border-transparent ${isActive
                            ? opt.activeCls
                            : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-background"
                            }`}
                        >
                          <div className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full border-[1.5px] flex-shrink-0 flex items-center justify-center transition-colors ${isActive ? opt.radioBorder : "border-on-surface-variant/60"}`}>
                            {isActive && <div className={`w-1.5 h-1.5 rounded-full ${opt.radioDot}`} />}
                          </div>
                          <span className="text-[10px] sm:text-xs font-bold whitespace-nowrap">
                            {opt.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* JD textarea — only shown in JD mode */}
                {optimizeMode === "jd" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-2 overflow-hidden pt-2"
                  >
                    <label className="font-sans text-xs font-semibold uppercase tracking-wider text-on-surface-variant ml-1">
                      PASTE JOB DESCRIPTION
                    </label>
                    <textarea
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      className="w-full px-6 py-4 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary-container transition-all placeholder:text-on-surface-variant/50 min-h-[120px] resize-none"
                      placeholder="Paste the job description here..."
                    />
                  </motion.div>
                )}

                {error && (
                  <div className="text-error text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {error}
                  </div>
                )}
                {inputType === "file" && file && (
                  <button
                    onClick={handleSeeParsedText}
                    disabled={parsing}
                    className="w-full bg-surface-container-high text-on-background py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-surface-container-highest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FileText className="w-5 h-5" />
                    {parsing ? "Parsing..." : "See Parsed Text"}
                  </button>
                )}

                {/* ── Model Selectors ── */}

                {/* With JD: R1 selector above the submit button */}
                {optimizeMode === "jd" && (
                  <ModelSelector storageKey="r1_preferred_model" label="R1 Model (Analysis)" />
                )}

                {/* No JD: R2 selector above the submit button */}
                {optimizeMode === "no_jd" && (
                  <ModelSelector storageKey="preferred_model" label="R2 Model (Generation)" />
                )}

                {/* No Change: R2 selector above the submit button */}
                {optimizeMode === "manual" && (
                  <ModelSelector storageKey="preferred_model" label="R2 Model (Generation)" />
                )}

                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="w-full bg-on-background text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Bolt className="text-primary-container w-5 h-5 fill-primary-container" />
                  {loading ? "Processing..." : !optimizeMode ? "Select an option first" : optimizeMode === "jd" ? "Optimize for JD" : optimizeMode === "no_jd" ? "Optimize Resume" : "Continue to Editor"}
                </button>
              </div>
            </div>
            {/* Decorative Elements */}
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-primary-container/20 blur-3xl rounded-full -z-10"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-tertiary-container/10 blur-3xl rounded-full -z-10"></div>
          </motion.div>
        </section>



        {/* Use Cases Section */}

        <section className="py-24 overflow-hidden">
          <div className="max-w-7xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-16 text-center"
            >
              <span className="font-sans text-xs font-bold uppercase tracking-widest text-primary mb-3 block">Who is it for?</span>
              <h2 className="font-headline text-4xl md:text-5xl font-bold text-on-background leading-tight">Use cases</h2>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  number: "01",
                  icon: <GraduationCap className="w-6 h-6 text-primary" />,
                  title: "Freshers",
                  desc: "Applying on-campus or off-campus on portals and need a resume that beats ATS filters and actual human recruiter.",
                  accent: "from-primary/10 to-primary/5",
                  border: "border-primary/20",
                  numColor: "text-primary",
                },
                {
                  number: "02",
                  icon: <Briefcase className="w-6 h-6 text-secondary" />,
                  title: "Job Switchers",
                  desc: "Employees ready to make their next move and want a polished, targeted resume that reflects their real experience.",
                  accent: "from-secondary/10 to-secondary/5",
                  border: "border-secondary/20",
                  numColor: "text-secondary",
                },
                {
                  number: "03",
                  icon: <PenLine className="w-6 h-6 text-tertiary" />,
                  title: "First-Time Builders",
                  desc: "Students who have never written a resume and need a clean starting point - no blank page paralysis.",
                  accent: "from-tertiary/10 to-tertiary/5",
                  border: "border-tertiary/20",
                  numColor: "text-tertiary",
                },
              ].map((card, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.12 }}
                  className={`relative bg-gradient-to-br ${card.accent} border ${card.border} rounded-3xl p-8 flex flex-col gap-5 hover:scale-[1.02] transition-transform duration-300`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-surface-container-lowest flex items-center justify-center shadow-sm">
                      {card.icon}
                    </div>
                    <span className={`font-black text-4xl ${card.numColor} opacity-20 font-headline`}>{card.number}</span>
                  </div>
                  <div>
                    <h3 className="font-headline text-2xl font-bold text-on-background mb-2">{card.title}</h3>
                    <p className="text-on-surface-variant leading-relaxed">{card.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Live Demo Section */}
        <LiveDemoSection />

        {/* Pricing Section */}
        {currentUser && (
          <section id="pricing" className="bg-surface py-32">
            <div className="max-w-7xl mx-auto px-6 text-center mb-20">
              <h2 className="font-headline text-4xl md:text-5xl font-bold text-on-background mb-4">Invest in yourself</h2>
              <p className="text-on-surface-variant text-lg">Premium features, student-friendly pricing.</p>
            </div>
            <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-8 items-stretch">
              {/* One-Time */}
              <div className="bg-surface-container-low p-10 rounded-[2rem] flex flex-col border border-surface-container-high">
                <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-5 h-5 text-on-surface-variant" />
                </div>
                <h3 className="font-headline text-2xl font-bold mb-1">One-Time</h3>
                <p className="text-sm text-on-surface-variant mb-4">2 resume downloads</p>
                <div className="text-4xl font-black mb-1">₹29</div>
                <p className="text-sm text-on-surface-variant mb-8">20 Credits</p>
                <ul className="space-y-3 mb-10 text-left flex-grow">
                  <li className="flex items-center gap-3 text-on-surface-variant">
                    <CheckCircle2 className="text-primary w-4 h-4 flex-shrink-0" />
                    20 Credits
                  </li>
                  <li className="flex items-center gap-3 text-on-surface-variant">
                    <CheckCircle2 className="text-primary w-4 h-4 flex-shrink-0" />
                    Best plan to verify
                  </li>
                </ul>
                <button
                  onClick={() => { setSelectedPricingPlan("pay_per_use"); setShowDownloadGate(true); }}
                  className="w-full py-4 rounded-xl border border-on-surface-variant/20 font-bold hover:bg-surface-container-high transition-colors"
                >
                  Get Started
                </button>
              </div>

              {/* Most Popular — BEST VALUE */}
              <div className="bg-surface-container-lowest p-10 rounded-[2rem] flex flex-col relative border-2 border-primary shadow-2xl shadow-primary/10 scale-105 z-10">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 flash-gradient text-white px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest whitespace-nowrap">
                  BEST VALUE
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Star className="w-5 h-5 text-primary fill-primary/30" />
                </div>
                <h3 className="font-headline text-2xl font-bold mb-1">Most Popular</h3>
                <p className="text-sm text-on-surface-variant mb-4">300 Credits (30 Resumes)</p>
                <div className="text-4xl font-black mb-1">₹199</div>
                <p className="text-sm text-on-surface-variant mb-8">/2 Months</p>
                <ul className="space-y-3 mb-10 text-left flex-grow">
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="text-primary w-4 h-4 flex-shrink-0" />
                    300 Credits
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="text-primary w-4 h-4 flex-shrink-0" />
                    Valid for 2 Months
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="text-primary w-4 h-4 flex-shrink-0" />
                    All Premium Features
                  </li>
                </ul>
                <button
                  onClick={() => { setSelectedPricingPlan("regular"); setShowDownloadGate(true); }}
                  className="w-full flash-gradient text-white py-4 rounded-xl font-bold hover:opacity-90 transition-opacity"
                >
                  Pay & Continue →
                </button>
              </div>

              {/* Student Plan — STUDENT OFFER */}
              <div className="bg-surface-container-low p-10 rounded-[2rem] flex flex-col relative border-2 border-amber-400/60">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest whitespace-nowrap shadow-md shadow-orange-500/30">
                  STUDENT OFFER
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mb-4">
                  <Verified className="w-5 h-5 text-amber-500" />
                </div>
                <h3 className="font-headline text-2xl font-bold mb-1">Student Plan</h3>
                <p className="text-sm text-on-surface-variant mb-4">400 Credits (40 Resumes)</p>
                <div className="text-4xl font-black mb-1">₹99</div>
                <p className="text-sm text-on-surface-variant mb-8">/3 months</p>
                <ul className="space-y-3 mb-10 text-left flex-grow">
                  <li className="flex items-center gap-3 text-on-surface-variant">
                    <CheckCircle2 className="text-primary w-4 h-4 flex-shrink-0" />
                    400 Credits
                  </li>
                  <li className="flex items-center gap-3 text-on-surface-variant">
                    <CheckCircle2 className="text-primary w-4 h-4 flex-shrink-0" />
                    Valid for 3 Months
                  </li>
                  <li className="flex items-center gap-3 text-on-surface-variant">
                    <CheckCircle2 className="text-primary w-4 h-4 flex-shrink-0" />
                    All Premium Features
                  </li>
                  <li className="flex items-center gap-3 text-amber-600 font-bold text-sm">
                    ✓ Verified Student
                  </li>
                </ul>
                <button
                  onClick={() => { setSelectedPricingPlan("student"); setShowDownloadGate(true); }}
                  className="w-full py-4 rounded-xl border-2 border-amber-400 bg-amber-50 text-amber-700 font-bold hover:bg-amber-100 transition-colors"
                >
                  Claim Student Offer
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Account & Refer Earn Section */}
        {currentUser && (
          <AccountSection onTopUpClick={() => { setSelectedPricingPlan(null); setShowDownloadGate(true); }} />
        )}

        {/* Reviews Section */}
        <section id="reviews" className="py-32">
          <div className="max-w-7xl mx-auto px-6">
            <div className="mb-20">
              <h2 className="font-headline text-4xl md:text-5xl font-bold text-on-background mb-4">Real people. Real results.</h2>
              <p className="text-on-surface-variant text-lg">Join 10,000+ career-starters who landed their dream roles.</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  name: "Arjun Mehta",
                  role: "Product Designer @ Fintech",
                  img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBamvFX_lBj5oKYuP3ghkp_o6OL_suAAV1WS1J7PdMpK39HZC-xoeZh_TJ8fZiaS4qOs--6_mlsJ1XJy7ZYKcS-omO1jm1ow_Va6cDJbd5RMEpBYn_7UyAe2Frj8n3wM10ICWjAR-g4j-QTdf-Q2yNF6vg6wLC_qL0KzWSpYklfVpUr-XZbwrvgWIcPCJ9k40HnMA9WRu7pvz23wE7gDEHRsti9zZvYgRRZUg2S2E_RmbT58tDUfQDzqNN6_nezn65tRJ8Z2ZwprVNP",
                  text: "Literally took me 2 minutes. I was struggling with my resume for weeks. before this 3 applications per day now it is more than 20."
                },
                {
                  name: "Sarah Chen",
                  role: "Software Engineer",
                  img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCJ9LQtMFP_xybQ9Q1zQcecq6WmoxdyOx-5ZNB1kDkzuhx3NhZREE0ApteR9jc_O1wDIkYlWZ2-vVsJlWyDMAVTPFr7hMJGdm7FfZJXSpuTWsY7pXHG6XHw7c4mdhVazs2VGcXevgWrzDE29CMWlQAg0q2_3Z3diGNQnFdPsrevQ3MWiJ-1Fc2OEjy48nAb4ZnPfMMiAB4XfpmBqfrs7uGoiYZFnqoEHLUxXveQoAC5Hws3nfKSTkHyNLiit90JD9XRRIFQf_Nvq4Yj",
                  text: "The editorial templates are fire. I've never seen a resume builder that actually cares about design this much."
                },
                {
                  name: "Rahul Verma",
                  role: "Marketing Specialist",
                  img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCPfj15XNt8XC7KiUq7HSu8kMnUpZdT0-3K3XhKNCP6MYPOjzPXHm8iGw-aOyBQ_9ghnoAiT5SCv_bXhyEvcgjFgbb4NTNiqdLUp_XTeJEy_zLhk8JhnSkER5-QQoP-a_I_hCLHSzRNq1EAgkfNgafppwDhA-FumFkoRgonIaTAi8U7psjLGOYdfT4cNL_xrxO1eThFxscDz875qAU5tUWRLtnvG-Bu5AAxuNA0lm6C0HrmvQqA-ELDfMPlOmJsfVzy1hDE-61hKQ8C",
                  text: "₹99 is a steal for this value. I have seen agencies and other tools charging in 1000s still fail in giving results."
                }
              ].map((review, idx) => (
                <div key={idx} className="bg-surface-container-low p-8 rounded-3xl">
                  <div className="flex items-center gap-4 mb-6">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={review.img}
                      alt={review.name}
                      className="w-12 h-12 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h4 className="font-bold">{review.name}</h4>
                      <p className="text-xs text-on-surface-variant">{review.role}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 mb-4 text-primary">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-primary" />
                    ))}
                  </div>
                  <p className="text-on-surface-variant italic leading-relaxed">"{review.text}"</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer CTA */}
        <section className="max-w-7xl mx-auto px-6 mb-32">
          <div className="flash-gradient rounded-[3rem] py-20 px-10 text-center text-white overflow-hidden relative">
            <div className="relative z-10">
              <h2 className="font-headline text-4xl md:text-6xl font-bold mb-6">Let's make it happen together.</h2>
              <p className="text-xl mb-12 opacity-90 max-w-2xl mx-auto">
                Stop sending basic resumes, send top 1% resume that recruiters care.
              </p>
              <button
                onClick={() => document.getElementById('upload-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className="bg-white text-primary text-xl font-bold px-12 py-5 rounded-full hover:shadow-2xl transition-all active:scale-95"
              >
                Try Free Now
              </button>
            </div>
            {/* Abstract Accents */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
          </div>
        </section>
      </main>

      {/* Purchase Success Toast */}
      {purchaseSuccess && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 bg-on-background text-surface px-6 py-4 rounded-2xl shadow-2xl shadow-black/30 border border-white/10">
            <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-sm">Credits Added Successfully!</p>
              <p className="text-xs opacity-70 mt-0.5">Upload your resume above and click Generate to get started.</p>
            </div>
            <button
              onClick={() => setPurchaseSuccess(false)}
              className="ml-4 opacity-50 hover:opacity-100 transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Parsed Text Modal */}
      {showParsedText && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-4xl w-full max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-surface-container-low">
              <h3 className="font-headline text-2xl font-bold">Parsed Resume Text</h3>
              <button
                onClick={() => setShowParsedText(false)}
                className="p-2 hover:bg-surface-container-low rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <pre className="whitespace-pre-wrap text-sm text-on-surface-variant font-mono bg-surface-container-low p-4 rounded-xl">
                {parsedText}
              </pre>
            </div>
            <div className="p-6 border-t border-surface-container-low">
              <button
                onClick={() => setShowParsedText(false)}
                className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-surface-container-low w-full py-12 border-t border-on-surface-variant/10">
        <div className="flex flex-col md:flex-row justify-between items-center px-8 max-w-7xl mx-auto gap-8">
          <div className="text-lg font-black text-on-background font-headline">Flashresume</div>
          <div className="flex gap-8 font-sans text-xs tracking-wide uppercase font-bold">
            <a href="#" className="text-on-surface-variant hover:text-primary transition-colors">Privacy Policy</a>
            <a href="#" className="text-on-surface-variant hover:text-primary transition-colors">Terms of Service</a>
            <a href="#" className="text-on-surface-variant hover:text-primary transition-colors">Contact Support</a>
          </div>
          <div className="text-on-surface-variant text-xs font-sans uppercase tracking-wide">
            © 2024 Flashresume. All rights reserved.
          </div>
        </div>
      </footer>
      {/* Pricing Popup Modal */}
      <PricingPopup
        isOpen={showDownloadGate}
        onClose={() => setShowDownloadGate(false)}
        onSuccess={() => {
          setShowDownloadGate(false);
          // Refresh credits from Supabase immediately
          if (currentUser) {
            supabase.from("users").select("credits_balance").eq("id", currentUser.id).single()
              .then(({ data }) => { if (data) setCredits(data.credits_balance); });
          }
          // Show success toast — do NOT redirect to /result
          // (user purchased from home page, no resume session exists yet)
          setPurchaseSuccess(true);
          setTimeout(() => setPurchaseSuccess(false), 5000);
        }}
        initialPlan={selectedPricingPlan}
        directPay={!!selectedPricingPlan}
        prefetchedUser={currentUser}
        prefetchedCredits={credits}
      />
      {/* Login-only popup — no pricing, no redirect */}
      <PricingPopup
        isOpen={showLoginOnly}
        onClose={() => setShowLoginOnly(false)}
        onSuccess={() => setShowLoginOnly(false)}
        directPay={false}
        forcePlanSelect={false}
        prefetchedUser={currentUser}
        prefetchedCredits={credits}
      />
    </div>
  );
}
