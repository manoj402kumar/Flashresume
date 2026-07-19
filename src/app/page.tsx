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
  Briefcase,
  Info,
  Laptop,
  Package
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { parseResume, analyzeResume } from "@/lib/api";
import PricingPopup from "@/components/PricingPopup";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import CreditBadge from "@/components/CreditBadge";

import TemplatesCarousel from "@/components/TemplatesCarousel";
import ModelSelector from "@/components/ModelSelector";
import OnboardingTour from "@/components/OnboardingTour";
import ReviewsMarquee from "@/components/ReviewsMarquee";

// -- Animated counter hook --------------------------------------------------
function useCountUp(target: number, duration = 1400, decimals = 0) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const t = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setCount(eased * target);
      if (t >= 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [target, duration]);
  return decimals === 0 ? Math.floor(count) : Number(count.toFixed(decimals));
}

// ── Review Trust Stats Bar ────────────────────────────────────────────────────
type ReviewStats = { avg_rating: number; total_reviews: number; five_star_rate: number; total_signups: number; live_users?: number };

function ReviewStatsBar({ onStats, variant = "default" }: { onStats?: (s: ReviewStats) => void; variant?: "default" | "center" }) {
  const [stats, setStats] = useState<ReviewStats | null>(null);

  useEffect(() => {
    const fetchStats = () => {
      fetch("/api/public-review-stats")
        .then(r => r.json())
        .then((d: ReviewStats) => { setStats(d); onStats?.(d); })
        .catch(() => { });
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedSignups = useCountUp(stats?.total_signups || 0, 3000);
  const animatedRating = useCountUp(stats?.avg_rating || 0, 3000, 1);
  const animatedReviews = useCountUp(stats?.total_reviews || 0, 3000);
  const animatedFiveStar = useCountUp(stats?.five_star_rate || 0, 3000);
  const animatedLive = useCountUp(stats?.live_users || 0, 3000);

  if (!stats || stats.total_reviews < 5) return null;

  const filledStars = Math.round(animatedRating);

  return (
    <div className="w-full mb-12">
      <div className="max-w-7xl mx-auto px-2 sm:px-6">
        <div className={`border-y border-surface-container-highest py-5 sm:py-6 flex flex-nowrap items-center gap-5 sm:gap-8 md:gap-12 ${variant === "center" ? "justify-center" : "justify-center sm:justify-start"}`}>
          {/* Avg Rating */}
          <div className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-3">
            <span className="text-base sm:text-3xl font-black text-on-background tabular-nums">{animatedRating}</span>
            <div className="flex flex-col items-center sm:items-start gap-0.5 sm:gap-1">
              <span className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-2.5 h-2.5 sm:w-4 sm:h-4 ${i < filledStars ? "fill-[#006859] text-[#006859]" : "text-surface-container-highest fill-surface-container-highest"
                      }`}
                  />
                ))}
              </span>
              <span className="text-[8px] sm:text-xs text-on-surface-variant font-semibold sm:font-medium tracking-wide sm:tracking-normal uppercase sm:normal-case whitespace-nowrap">
                Total Rating <span className="sm:hidden">({stats.total_reviews})</span>
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden sm:block flex-shrink-0 h-10 w-px bg-surface-container-highest" />

          {/* Total Reviews */}
          <div className="hidden sm:flex flex-col items-center sm:items-start">
            <span className="text-base sm:text-3xl font-black text-on-background tabular-nums">{animatedReviews.toLocaleString()}</span>
            <span className="text-[8px] sm:text-xs text-on-surface-variant font-semibold sm:font-medium tracking-wide sm:tracking-normal uppercase sm:normal-case mt-0.5 sm:mt-1 whitespace-nowrap">Total Reviews</span>
          </div>

          {/* Divider */}
          <div className="hidden sm:block flex-shrink-0 h-10 w-px bg-surface-container-highest" />

          {/* 5★ Rate */}
          <div className="flex flex-col items-center sm:items-start">
            <span className="text-base sm:text-3xl font-black text-on-background tabular-nums">{animatedFiveStar}%</span>
            <span className="text-[8px] sm:text-xs text-on-surface-variant font-semibold sm:font-medium tracking-wide sm:tracking-normal uppercase sm:normal-case mt-0.5 sm:mt-1 whitespace-nowrap">5★ Rate</span>
          </div>

          {/* Divider */}
          <div className="hidden sm:block flex-shrink-0 h-10 w-px bg-surface-container-highest" />

          {/* Total Signups */}
          <div className="flex flex-col items-center sm:items-start">
            <span className="text-base sm:text-3xl font-black text-on-background tabular-nums">{animatedSignups.toLocaleString()}</span>
            <span className="text-[8px] sm:text-xs text-on-surface-variant font-semibold sm:font-medium tracking-wide sm:tracking-normal uppercase sm:normal-case mt-0.5 sm:mt-1 whitespace-nowrap">Total Users</span>
          </div>

          {/* Divider */}
          <div className="hidden sm:block flex-shrink-0 h-10 w-px bg-surface-container-highest" />

          {/* Live Users */}
          <div className="flex flex-col items-center sm:items-start">
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="relative flex h-1.5 w-1.5 sm:h-2.5 sm:w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2.5 sm:w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-base sm:text-3xl font-black text-on-background tabular-nums">{animatedLive}</span>
            </div>
            <span className="text-[8px] sm:text-xs text-on-surface-variant font-semibold sm:font-medium tracking-wide sm:tracking-normal uppercase sm:normal-case mt-0.5 sm:mt-1 whitespace-nowrap">Live Users</span>
          </div>

          {/* Verified badge */}
          {variant !== "center" && (
            <div className="ml-auto hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-[#006859]/8 border border-[#006859]/20">
              <Verified className="w-4 h-4 text-[#006859]" />
              <span className="text-xs font-semibold text-[#006859]">Verified Reviews</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
  const [showBuyMoreCredits, setShowBuyMoreCredits] = useState(false);
  const [selectedPricingPlan, setSelectedPricingPlan] = useState<"pay_per_use" | "bulk_offer" | "student" | null>(null);
  const [hoveredPlan, setHoveredPlan] = useState<string>("bulk_offer");
  const [showLoginOnly, setShowLoginOnly] = useState(false);
  const [totalSignups, setTotalSignups] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const accountDropdownRef = useRef<HTMLDivElement>(null);

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
  const [credits, setCredits] = useState<number>(0);
  const [analysisCountdown, setAnalysisCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [buckets, setBuckets] = useState<any[]>([]);
  const [optimizeMode, setOptimizeMode] = useState<"jd" | "manual" | "first_resume" | null>("jd");
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<"nav" | "dropdown" | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;
      setCurrentUser(user);

      // Track visit AFTER auth resolves so user_id is known for dev filtering.
      // Auth reads from localStorage — instant. Tracking is fire-and-forget, never blocks the user.
      if (process.env.NODE_ENV === "production") {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        fetch(`${apiUrl}/api/analytics/track-visit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page_type: "landing", user_id: user?.id ?? null }),
        }).catch(() => { }); // silent fail — never block the user
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setCurrentUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Show mobile hint popup after a short delay, only on mobile


  // Visit tracking moved inside getSession() above — fires once after auth resolves with correct user_id

  // ── Referral Capture: Step 1 ─────────────────────────────────────────────
  // On page load, read ?ref=CODE from the URL and store it in localStorage.
  // This persists across OAuth redirects so the code survives Google sign-in.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get("ref");
    if (refCode && refCode.trim().length > 0) {
      localStorage.setItem("flashresume_ref", refCode.trim().toUpperCase());
    }
  }, []);

  // ── Referral Capture: Step 2 ─────────────────────────────────────────────
  // When a user signs in, check if there's a stored referral code and apply it.
  // This sets `referred_by` in the DB so the payment verifier can award the bonus.
  useEffect(() => {
    if (!currentUser) return;
    const storedRef = localStorage.getItem("flashresume_ref");
    if (!storedRef) return;

    const applyReferral = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/user/apply-referral`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            referral_code: storedRef,
          }),
        });
        const json = await res.json();
        // Clear localStorage regardless — if skipped/error, no point retrying
        localStorage.removeItem("flashresume_ref");
        if (json.status === "ok") {
          console.log("[Referral] Referral applied successfully.");
        }
      } catch (err) {
        // Non-critical — never block the user
        console.warn("[Referral] Could not apply referral code:", err);
      }
    };

    applyReferral();
  }, [currentUser]);

  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowModeDropdown(false);
      }
      setActiveTooltip(null);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const fetchAccountData = async () => {
      // 1. Fetch referral code
      const { data: uData } = await supabase.from("users").select("referral_code").eq("id", currentUser.id).single();
      if (uData?.referral_code) setReferralCode(uData.referral_code);

      // 2. Fetch all active/queued/fallback buckets
      const { data: bucketData } = await supabase
        .from("credit_buckets")
        .select("*")
        .eq("user_id", currentUser.id)
        .in("status", ["active", "queued", "fallback"])
        .gt("remaining_credits", 0)
        .order("created_at", { ascending: true });

      if (bucketData) {
        setBuckets(bucketData);
        // Compute total credits
        const total = bucketData.reduce((acc, b) => acc + b.remaining_credits, 0);
        setCredits(total);
      } else {
        // Fallback to old table if migration hasn't run yet
        const { data: oldData } = await supabase.from("users").select("credits_balance").eq("id", currentUser.id).single();
        setCredits(oldData?.credits_balance || 0);
      }
    };

    fetchAccountData();

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
      setParsedText("");

      // Auto-parse for better UX (silent background parsing)
      setParsing(true);
      parseResume(droppedFile).then(parseResult => {
        setParsedText(parseResult.resume_text);
        // Store extracted links for later use in the generate step
        if (parseResult.extracted_links) {
          localStorage.setItem("extracted_links", JSON.stringify(parseResult.extracted_links));
        }
      }).catch(err => {
        console.log("Auto-parse failed:", err.message);
      }).finally(() => {
        setParsing(false);
      });
    } else {
      setError("Please upload PDF, DOCX file");
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
        // Store extracted links for later use in the generate step
        if (parseResult.extracted_links) {
          localStorage.setItem("extracted_links", JSON.stringify(parseResult.extracted_links));
        }
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
    if (optimizeMode !== "first_resume") {
      if (inputType === "file" && !file) {
        setError("Please upload a resume file");
        return;
      }
      if (inputType === "text" && !resumeText.trim()) {
        setError("Please paste your resume text");
        return;
      }
    }

    // First Resume (scratch) is intentionally excluded for low-friction onboarding

    setLoading(true);
    setError("");

    // Clear stale flags and cache from any previous session
    localStorage.removeItem("no_jd_mode");
    localStorage.removeItem("generated_resume");
    localStorage.removeItem("analysis");

    try {
      let finalResumeText = resumeText;
      let finalExtractedLinks = null;

      if (inputType === "file" && file) {
        // Use auto-parsed text if already available (parsed on upload)
        if (parsedText) {
          finalResumeText = parsedText;
          // Retrieve the links that were saved during auto-parse
          const autoParsedLinks = localStorage.getItem("extracted_links");
          if (autoParsedLinks) {
            finalExtractedLinks = JSON.parse(autoParsedLinks);
          }
        } else {
          const parseResult = await parseResume(file);
          finalResumeText = parseResult.resume_text;
          if (parseResult.extracted_links) {
            finalExtractedLinks = parseResult.extracted_links;
          }
        }
      }

      // Now clear everything and save the fresh ones
      localStorage.removeItem("extracted_links");
      if (finalExtractedLinks) {
        localStorage.setItem("extracted_links", JSON.stringify(finalExtractedLinks));
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

        // Start 15-second countdown for UX feedback
        setAnalysisCountdown(15);
        countdownRef.current = setInterval(() => {
          setAnalysisCountdown((prev) => {
            if (prev === null || prev <= 1) {
              if (countdownRef.current) clearInterval(countdownRef.current);
              return null;
            }
            return prev - 1;
          });
        }, 1000);

        try {
          // Read R1 model preference (set by the R1 ModelSelector on this page)
          const r1Model = localStorage.getItem("r1_preferred_model") ?? "";
          const analysisResult = await analyzeResume(finalResumeText, jobDescription, r1Model);
          localStorage.setItem("analysis", JSON.stringify(analysisResult));
          if (countdownRef.current) clearInterval(countdownRef.current);
          setAnalysisCountdown(null);
          router.push("/analyze");
        } catch (err: any) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          setAnalysisCountdown(null);
          throw err; // re-throw to outer catch
        }
      } else if (optimizeMode === "first_resume") {
        router.push("/scratch");
      } else {
        // Manual: skip analysis, go straight to preview
        const dummyAnalysis = {
          ats_score: 0,
          matched_skills: [],
          missing_skills: [],
          updated_missing_skills: [],
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

  const handleShare = async () => {
    if (!referralCode) return;
    const url = `${window.location.origin}/?ref=${referralCode}`;

    // 1. Copy to clipboard synchronously first. 
    // iOS Safari blocks clipboard access if it happens after an 'await'.
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(url).catch(() => { });
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
    } catch (e) {
      // Ignore copy errors
    }

    // 2. Attempt native share sheet
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Flashresume",
          text: "I used Flashresume to rebuild my resume in 60 seconds! Must try.",
          url: url,
        });
        return;
      } catch (err: any) {
        if (err.name === "AbortError") return;
      }
    }

    // 3. If native share fails or isn't supported, show "Copied" UI
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen font-sans overflow-x-hidden" suppressHydrationWarning>
      {/* Onboarding tour — shown once to first-time visitors (any auth state) */}
      <OnboardingTour />
      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 glass-header border-b border-surface-container-low">
        {/* Mobile-only referral announcement bar — logged-in users only */}
        {currentUser && (
          <>
            <style>{`
              @keyframes referral-shine {
                0%   { transform: translateX(-100%) skewX(-20deg); }
                100% { transform: translateX(300%) skewX(-20deg); }
              }
              .referral-shine-sweep {
                animation: referral-shine 2.2s ease-in-out infinite;
                animation-delay: 1s;
              }
            `}</style>
            <button
              onClick={handleShare}
              className="md:hidden w-full relative overflow-hidden flex items-center justify-center gap-2.5 text-white text-sm font-bold py-3.5 px-4 tracking-wide active:opacity-80 transition-opacity"
              style={{ background: "linear-gradient(90deg, #006859 0%, #008570 50%, #006859 100%)" }}
            >
              {/* Shimmer sweep */}
              <span
                className="referral-shine-sweep pointer-events-none absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                aria-hidden="true"
              />
              {/* Pulsing dot */}
              <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
              </span>
              🎁 Refer &amp; get 20 credits —&nbsp;<span className="underline underline-offset-2">tap here</span>
            </button>
          </>
        )}
        <div className="flex justify-between items-center max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 w-full">

          <div className="flex items-center gap-2 shrink-0">
            {/* Hexagon logo mark */}
            <div className="relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9">
              <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                <path
                  d="M18 2L32 10V26L18 34L4 26V10L18 2Z"
                  fill="url(#hex-grad)"
                  stroke="rgba(0,104,89,0.3)"
                  strokeWidth="0.8"
                />
                <defs>
                  <linearGradient id="hex-grad" x1="4" y1="2" x2="32" y2="34" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#006859" />
                    <stop offset="1" stopColor="#12f8d7" />
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
                <div className="hidden sm:flex items-center mr-1">
                  <button
                    onClick={handleShare}
                    className="relative overflow-hidden flex items-center gap-1 bg-[#006859] text-white pl-3 pr-2 py-1.5 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95"
                  >
                    {/* Shimmer sweep */}
                    <span className="referral-shine-sweep pointer-events-none absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent" aria-hidden="true" />
                    🎁 <span className="hidden md:inline">{copied ? "Copied!" : "Invite & Earn"}</span>
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label="View tooltip"
                      className="relative group/tooltip inline-flex items-center cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTooltip(activeTooltip === "nav" ? null : "nav");
                      }}
                      onMouseEnter={() => setActiveTooltip("nav")}
                      onMouseLeave={() => setActiveTooltip(null)}
                    >
                      <Info className="w-3.5 h-3.5 opacity-70 hover:opacity-100 transition-opacity ml-1 cursor-help" />
                      <span className={`absolute top-full mt-2 left-1/2 -translate-x-1/2 ${activeTooltip === "nav" ? "block" : "hidden group-hover/tooltip:block"} bg-[#1a1a1f] text-white text-[10px] font-semibold leading-normal rounded-lg px-2.5 py-1.5 w-48 shadow-xl text-center pointer-events-none z-50`}>
                        You will be credited +20 credits after your friend downloads his/her first resume. Hurry up!
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-b-[#1a1a1f]"></span>
                      </span>
                    </div>
                  </button>
                </div>
                <CreditBadge onTopUpClick={() => { setSelectedPricingPlan(null); setShowDownloadGate(true); }} />

                {/* Account Dropdown */}
                <div className="relative" ref={accountDropdownRef}>
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


                            {buckets.length > 0 && (
                              <div className="space-y-4 mt-5">
                                {buckets.map(b => {
                                  const activeBucket = buckets.find(b => b.status === 'active');
                                  const activePlanName = activeBucket ? (activeBucket.plan_type === 'student' ? 'student plan' : activeBucket.plan_type === 'bulk_offer' ? 'bulk plan' : activeBucket.plan_type === 'regular' ? 'pro plan' : 'previous plan') : 'previous plan';
                                  const name = b.plan_type === 'student' ? '🎓 Student Plan' : b.plan_type === 'bulk_offer' ? '📦 Bulk Offer' : b.plan_type === 'regular' ? '👑 Pro Monthly' : b.plan_type === 'pay_per_use' ? '💳 Pay Per Use' : '🎁 Referral Credits';
                                  let validText = "";
                                  if (b.status === 'active' && b.expires_at) {
                                    validText = `Valid till ${new Date(b.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                                  } else if (b.status === 'queued') {
                                    validText = `Starts after ${activePlanName}`;
                                  } else if (b.status === 'fallback' || !b.validity_duration_days) {
                                    validText = `Lifetime (No Expiration)`;
                                  }

                                  const isQueued = b.status === 'queued';

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
                              <button
                                onClick={handleShare}
                                className="relative overflow-hidden w-full py-2.5 bg-[#006859] text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                              >
                                {/* Shimmer sweep */}
                                <span className="referral-shine-sweep pointer-events-none absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent" aria-hidden="true" />
                                🎁 {copied ? "Link Copied!" : "Invite Friends (+20 Credits)"}
                                <div
                                  className="relative group/tooltip inline-flex items-center"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveTooltip(activeTooltip === "dropdown" ? null : "dropdown");
                                  }}
                                  onMouseEnter={() => setActiveTooltip("dropdown")}
                                  onMouseLeave={() => setActiveTooltip(null)}
                                >
                                  <Info className="w-3.5 h-3.5 opacity-70 hover:opacity-100 transition-opacity ml-1 cursor-help" />
                                  <span className={`absolute right-full mr-2 top-1/2 -translate-y-1/2 ${activeTooltip === "dropdown" ? "block" : "hidden group-hover/tooltip:block"} bg-[#1a1a1f] text-white text-[10px] font-semibold leading-normal rounded-lg px-2.5 py-1.5 w-48 shadow-xl text-center pointer-events-none z-50`}>
                                    You will be credited +20 credits after your friend downloads his/her first resume. Hurry up!
                                    <span className="absolute left-full top-1/2 -translate-y-1/2 border-[4px] border-transparent border-l-[#1a1a1f]"></span>
                                  </span>
                                </div>
                              </button>
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
                                  setShowBuyMoreCredits(true);
                                }}
                                className="w-full py-2.5 bg-surface-container-low hover:bg-surface-container-high text-on-background text-sm font-bold rounded-xl transition-colors"
                              >
                                Buy More Credits
                              </button>

                              <button
                                onClick={() => {
                                  setShowAccountDropdown(false);
                                  router.push('/contact');
                                }}
                                className="w-full py-2.5 bg-surface-container-low hover:bg-surface-container-high text-on-background text-sm font-bold rounded-xl transition-colors"
                              >
                                Help / Contact
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
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12 md:py-16 flex flex-col items-center">

          {/* Heading block */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mb-8 max-w-3xl mx-auto"
          >
            {/* Confident Pill Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-xs sm:text-sm font-bold text-amber-700 mb-6 shadow-sm shadow-amber-500/10 whitespace-nowrap"
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span>
                Flashresume - World's best ATS resumes
              </span>
            </motion.div>
            <h1 className="font-headline text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-on-background leading-[1.1] mb-5 text-center w-full">
              <span>
                Apply-ready resume in{" "}
                <span className="relative inline-block">
                  <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-[#006859] to-[#12f8d7] italic">60 secs.</span>
                  <span className="absolute inset-x-0 bottom-1 h-3 bg-[#006859]/12 rounded-md -z-0 skew-x-1"></span>
                </span>
              </span>
            </h1>
          </motion.div>

          {/* Upload Card */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-2xl md:max-w-lg relative mx-auto"
          >
            {/* Glow halos */}
            <div className="absolute -top-10 -right-10 w-48 h-48 bg-[#006859]/15 blur-[70px] rounded-full -z-10 pointer-events-none"></div>
            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-[#12f8d7]/10 blur-[70px] rounded-full -z-10 pointer-events-none"></div>

            <div
              id="upload-card"
              className="bg-surface-container-lowest rounded-[2rem] p-5 sm:p-6 md:p-5 shadow-[0_20px_70px_rgba(0,104,89,0.08)] border border-[#006859]/10"
            >
              <div className="space-y-4">

                {/* Optimize Mode Selection */}
                <div id="tour-step-1-choose-option" className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 ml-0.5">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#006859] text-white text-[10px] font-black flex-shrink-0">1</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Choose Option</span>
                  </div>
                  <div className="flex flex-row items-center justify-between gap-2 sm:gap-4 bg-surface-container-low rounded-2xl p-1.5 pl-4 sm:pl-5">
                    <div className="flex flex-1 sm:flex-none w-full sm:w-auto gap-1 justify-end">
                      {([
                        {
                          id: "jd" as const,
                          activeCls: "bg-surface-container-lowest text-[#006859] shadow-sm border border-surface-container-highest",
                          radioBorder: "border-[#006859]",
                          radioDot: "bg-[#006859]",
                          label: "JD Optimize",
                        },
                        {
                          id: "manual" as const,
                          activeCls: "bg-surface-container-lowest text-[#006859] shadow-sm border border-surface-container-highest",
                          radioBorder: "border-[#006859]",
                          radioDot: "bg-[#006859]",
                          label: "Edit Resume",
                        },
                        {
                          id: "first_resume" as const,
                          activeCls: "bg-surface-container-lowest text-[#006859] shadow-sm border border-surface-container-highest",
                          radioBorder: "border-[#006859]",
                          radioDot: "bg-[#006859]",
                          label: "First Resume",
                        }
                      ] as const).map((opt) => {
                        const isActive = optimizeMode === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setOptimizeMode(opt.id)}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-1 sm:gap-2 px-1 sm:px-3 py-2.5 rounded-xl transition-all duration-200 border border-transparent ${isActive
                              ? opt.activeCls
                              : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-background"
                              }`}
                          >
                            <div className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full border-[1.5px] flex-shrink-0 flex items-center justify-center transition-colors ${isActive ? opt.radioBorder : "border-on-surface-variant/60"}`}>
                              {isActive && <div className={`w-1.5 h-1.5 rounded-full ${opt.radioDot}`} />}
                            </div>
                            <span className="text-[9px] min-[375px]:text-[10px] sm:text-xs font-bold leading-tight text-left sm:text-center whitespace-nowrap">
                              {opt.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {optimizeMode !== "first_resume" && (
                  <>
                    {/* Tab switcher — Upload / Paste */}
                    <div id="tour-step-2-upload-resume" className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 mb-1 ml-0.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#006859] text-white text-[10px] font-black flex-shrink-0">2</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Upload Resume</span>
                      </div>
                      <div className="flex gap-1.5 p-1.5 bg-surface-container-low rounded-2xl">
                        <button
                          onClick={() => setInputType("file")}
                          className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 focus:outline-none ${inputType === "file"
                            ? "bg-surface-container-lowest text-[#006859] shadow-sm"
                            : "text-on-surface-variant hover:text-on-background"
                            }`}
                        >
                          Upload File
                        </button>
                        <button
                          onClick={() => setInputType("text")}
                          className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 focus:outline-none ${inputType === "text"
                            ? "bg-surface-container-lowest text-[#006859] shadow-sm"
                            : "text-on-surface-variant hover:text-on-background"
                            }`}
                        >
                          Paste Text
                        </button>
                      </div>

                      {/* File drop zone / Paste textarea */}
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
                            className={`flex flex-col items-center justify-center cursor-pointer rounded-2xl border-2 border-dashed py-3 sm:py-6 px-6 transition-all duration-200 w-full overflow-hidden
                            ${isDragging
                                ? "border-[#006859] bg-[#006859]/8 scale-[1.01]"
                                : file
                                  ? "border-[#006859]/60 bg-[#006859]/5"
                                  : "border-surface-container-highest hover:border-[#006859]/40 bg-surface-container-low hover:bg-surface-container-lowest"
                              }`}
                          >
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-colors ${file ? 'bg-[#006859]/10' : 'bg-surface-container-high'}`}>
                              <CloudUpload className={`w-6 h-6 ${file ? 'text-[#006859]' : 'text-on-surface-variant'}`} />
                            </div>
                            <span className="font-headline text-on-background font-bold text-center text-base truncate w-full px-2 mb-1">
                              {file ? file.name : "Drop your current resume"}
                            </span>
                            <span className="text-sm text-on-surface-variant text-center">PDF, DOCX (Max 5MB)</span>
                            {!file && (
                              <span className="mt-3 text-xs font-bold text-[#006859] bg-[#006859]/10 px-3 py-1.5 rounded-full">
                                Browse files
                              </span>
                            )}
                          </label>
                        </>
                      ) : (
                        <textarea
                          value={resumeText}
                          onChange={(e) => setResumeText(e.target.value)}
                          className="w-full px-5 py-4 rounded-2xl bg-surface-container-low border-2 border-transparent focus:border-[#006859]/30 focus:ring-0 focus:outline-none transition-all placeholder:text-on-surface-variant/50 min-h-[140px] resize-none text-sm leading-relaxed"
                          placeholder="Paste your current resume text here... (Experience, Education, Skills, etc.)"
                        />
                      )}
                    </div>
                  </>
                )}

                {/* JD textarea */}
                {optimizeMode === "jd" && (
                  <motion.div
                    id="tour-step-3-jd"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-2 overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-1 ml-0.5">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#006859] text-white text-[10px] font-black flex-shrink-0">3</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Paste Job Description</span>
                      </div>
                      {!jobDescription && (
                        <button
                          type="button"
                          onClick={() => setJobDescription(`Work on Java-based application development tasks under the mentorship of senior developers.
Write clean, structured, and maintainable code using Java, Spring Boot, and related frameworks.
Assist in developing and maintaining REST APIs and basic microservices.
Learn to work with SQL/NoSQL databases, perform simple queries, and understand data storage mechanisms.
Participate in bug fixing, unit testing, and code review processes.
Learn to create and run unit tests for code quality assurance.
Understand and follow secure coding practices, authentication basics, and data privacy guidelines.
Gain exposure to performance optimization, caching, and basic load-balancing concepts.
Collaborate with Product, QA, and DevOps teams for end-to-end development activities.
Support and maintain documentation for tasks, modules, and small features.
Required Skills & Qualifications

Basic understanding of Core Java, OOP concepts, and common coding principles.
Familiarity with advanced Java concepts like Collections, Exception Handling, and basic Multithreading.
Knowledge of Spring Boot, REST API concepts, and microservices fundamentals.
Understanding of SQL and basic CRUD operations.
Awareness of security, authentication, and data privacy concepts.
Ability to learn Git, version control workflows, and basic CI/CD tools.
Strong problem-solving mindset and willingness to learn rapidly.
Good communication and teamwork skills.
Pursuing or completed a degree in Computer Science, Engineering, or equivalent technical field.`)}
                          className="flex items-center gap-1 text-[10px] font-bold text-white bg-[#006859] hover:bg-[#005548] border border-[#006859] px-2.5 py-1 rounded-full transition-all duration-150 active:scale-95 whitespace-nowrap"
                        >
                          <Wand2 className="w-2.5 h-2.5" />
                          Use sample
                        </button>
                      )}
                    </div>
                    <textarea
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      className="w-full px-5 py-3 rounded-2xl bg-surface-container-low border-2 border-transparent focus:border-[#006859]/30 focus:ring-0 focus:outline-none transition-all placeholder:text-on-surface-variant/50 min-h-[80px] resize-none text-sm"
                      placeholder="Paste the job description here..."
                    />
                  </motion.div>
                )}

                {/* Error */}
                {error && (
                  <div className="text-error text-sm font-medium flex items-center gap-2 bg-error/5 border border-error/15 rounded-xl px-4 py-3">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                {/* See Parsed Text */}
                {inputType === "file" && file && (
                  <button
                    onClick={handleSeeParsedText}
                    disabled={parsing}
                    className="w-full bg-surface-container-high text-on-background py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-surface-container-highest transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <FileText className="w-4 h-4" />
                    {parsing ? "Parsing..." : "See Parsed Text"}
                  </button>
                )}

                {/* Main CTA */}
                {(() => {
                  const isDevMode = currentUser?.email === "flashresume.in@gmail.com";
                  if (!isDevMode) return null;
                  return (
                    <>
                      {optimizeMode === "jd" && (
                        <ModelSelector storageKey="r1_preferred_model" label="R1 Model (Analysis)" />
                      )}
                      {optimizeMode === "first_resume" && (
                        <ModelSelector storageKey="preferred_model" label="R2 Model (Generation)" />
                      )}
                      {optimizeMode === "manual" && (
                        <ModelSelector storageKey="preferred_model" label="R2 Model (Generation)" />
                      )}
                    </>
                  );
                })()}
                <button
                  id="tour-step-cta"
                  onClick={handleGenerate}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-[#006859] to-[#12f8d7] text-white py-3.5 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 shadow-[0_8px_30px_rgba(0,104,89,0.3)] hover:shadow-[0_8px_30px_rgba(18,248,215,0.4)] hover:-translate-y-0.5 hover:opacity-90 active:translate-y-0 active:shadow-none transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                >
                  <Bolt className="text-white w-5 h-5 fill-white opacity-80" />
                  {loading && optimizeMode === "jd" && analysisCountdown !== null
                    ? `Analyzing... [${analysisCountdown}s]`
                    : loading
                      ? "Processing..."
                      : !optimizeMode
                        ? "Select an option first"
                        : optimizeMode === "jd"
                          ? "Optimize for JD"
                          : optimizeMode === "first_resume"
                            ? "Build From Scratch"
                            : "Edit manually"}
                </button>



              </div>
            </div>
          </motion.div>
        </section>

        {/* ── Inspirational Quote Section ──────────────────────────────── */}
        <section className="py-24 overflow-hidden relative">
          {/* Ambient background glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div className="w-[600px] h-[200px] rounded-full bg-black opacity-5 blur-[120px]" />
          </div>

          <div className="max-w-4xl mx-auto px-6 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="flex flex-col items-center text-center"
            >
              {/* Decorative top line */}
              <motion.div
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
                className="w-16 h-[2px] bg-gradient-to-r from-transparent via-black to-transparent mb-8 origin-center"
              />

              {/* Opening quotation mark */}
              <span
                aria-hidden="true"
                className="text-7xl font-serif leading-none text-black opacity-15 select-none mb-2"
                style={{ fontFamily: "Georgia, serif", lineHeight: 1 }}
              >
                &ldquo;
              </span>

              {/* The Quote */}
              <motion.h2
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.3 }}
                className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight text-black"
              >
                Stop not till the goal is reached.
              </motion.h2>

              {/* Attribution */}
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.55 }}
                className="mt-6 text-sm sm:text-base font-medium tracking-widest uppercase text-black/50"
              >
                — Swami Vivekananda
              </motion.p>

              {/* Decorative bottom line */}
              <motion.div
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.65, ease: "easeOut" }}
                className="w-16 h-[2px] bg-gradient-to-r from-transparent via-black to-transparent mt-8 origin-center"
              />
            </motion.div>
          </div>
        </section>

        {/* ── Trust Stats Divider ──────────────────────────────────────── */}
        <ReviewStatsBar variant="center" />

        {/* ── Templates Section ──────────────────────────────────────── */}
        <TemplatesCarousel />

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
                  desc: "Students who are building their first resume with proper inspiration and guidance.",
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


        {/* Pricing Section */}
        {currentUser && (
          <section id="pricing" className="bg-surface py-32">
            <div className="max-w-7xl mx-auto px-6 text-center mb-20">
              <h2 className="font-headline text-4xl md:text-5xl font-bold text-on-background mb-4">Invest in yourself</h2>
              {totalSignups && totalSignups > 0 && (
                <p className="text-on-surface-variant text-lg">
                  <span className="font-semibold text-[#006859]">
                    {totalSignups.toLocaleString("en-IN")} users already joined
                  </span>
                </p>
              )}
            </div>
            {/* Mobile: outer div scrolls, inner div provides pt-6 so badges have room */}
            <div className="overflow-x-auto pb-12 sm:overflow-visible">
              <div className="flex flex-nowrap sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-[1050px] mx-auto px-4 sm:px-6 pt-6 sm:pt-0">
                {/* One-Time */}
                <div
                  onMouseEnter={() => setHoveredPlan("pay_per_use")}
                  className={`flex-shrink-0 w-[280px] md:w-auto snap-center p-8 md:p-10 rounded-[2rem] flex flex-col transition-all duration-300 relative border-2 ${hoveredPlan === "pay_per_use" ? "border-transparent bg-gradient-to-b from-[#006859] to-[#12f8d7] shadow-2xl md:scale-105 z-10 text-white" : "bg-surface-container-low border-surface-container-high text-on-background"}`}
                >
                  {/* Selection Indicator */}
                  <div className={`absolute top-4 right-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${hoveredPlan === "pay_per_use" ? 'border-white bg-white scale-110' : 'border-on-surface-variant/30'}`}>
                    {hoveredPlan === "pay_per_use" && <CheckCircle2 className="w-4 h-4 text-[#006859]" />}
                  </div>

                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors ${hoveredPlan === "pay_per_use" ? "bg-white/20 text-white" : "bg-surface-container-high"}`}>
                    <CheckCircle2 className={`w-5 h-5 ${hoveredPlan === "pay_per_use" ? "text-white opacity-90" : "text-on-surface-variant"}`} />
                  </div>
                  <h3 className="font-headline text-2xl font-bold mb-1">One-Time</h3>
                  <p className={`text-sm mb-4 ${hoveredPlan === "pay_per_use" ? "text-white/90" : "text-on-surface-variant"}`}>1 resume download</p>
                  <div className="text-4xl font-black mb-1">₹29</div>
                  <p className={`text-sm mb-8 ${hoveredPlan === "pay_per_use" ? "text-white/90" : "text-on-surface-variant"}`}>/10 Days</p>
                  <ul className="space-y-3 mb-10 text-left flex-grow">
                    <li className={`flex items-center gap-3 ${hoveredPlan === "pay_per_use" ? "text-white" : "text-on-surface-variant"}`}>
                      <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${hoveredPlan === "pay_per_use" ? "text-white" : "text-primary"}`} />
                      10 Credits
                    </li>
                    <li className={`flex items-center gap-3 ${hoveredPlan === "pay_per_use" ? "text-white" : "text-on-surface-variant"}`}>
                      <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${hoveredPlan === "pay_per_use" ? "text-white" : "text-primary"}`} />
                      Valid for 10 Days
                    </li>
                  </ul>
                  <button
                    onClick={() => { setSelectedPricingPlan("pay_per_use"); setShowDownloadGate(true); }}
                    className={`w-full py-4 rounded-xl font-bold transition-colors ${hoveredPlan === "pay_per_use" ? "bg-white text-[#006859] shadow-lg shadow-black/5 hover:bg-white/90" : "border border-on-surface-variant/20 hover:bg-surface-container-high"}`}
                  >
                    Get Started
                  </button>
                </div>

                {/* Student Plan — STUDENT OFFER */}
                <div
                  onMouseEnter={() => setHoveredPlan("student")}
                  className={`flex-shrink-0 w-[280px] sm:w-auto snap-center p-8 md:p-10 rounded-[2rem] flex flex-col relative border-2 transition-all duration-300 ${hoveredPlan === "student" ? "border-transparent bg-gradient-to-b from-[#006859] to-[#12f8d7] shadow-2xl md:scale-105 z-10 text-white" : "bg-surface-container-low border-amber-400/60 text-on-background"}`}
                >
                  {/* Selection Indicator */}
                  <div className={`absolute top-4 right-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 z-20 ${hoveredPlan === "student" ? 'border-white bg-white scale-110' : 'border-amber-400/30'}`}>
                    {hoveredPlan === "student" && <CheckCircle2 className="w-4 h-4 text-[#006859]" />}
                  </div>

                  <div className={`absolute -top-4 left-1/2 -translate-x-1/2 overflow-hidden flex items-center gap-1.5 text-[10px] font-black px-3 py-0.5 rounded-full shadow-lg whitespace-nowrap tracking-wider border z-20 bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-orange-500/40 border-orange-400/50`}>
                    STUDENT OFFER
                    <span className="relative bg-white/25 text-white rounded-full px-1.5 py-0 text-[9px] font-black tracking-wide border border-white/30">50% OFF</span>
                  </div>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors ${hoveredPlan === "student" ? "bg-white/20 text-white" : "bg-amber-50 text-amber-500"}`}>
                    <GraduationCap className={`w-5 h-5 ${hoveredPlan === "student" ? "text-white opacity-90" : "text-amber-500"}`} />
                  </div>
                  <h3 className="font-headline text-2xl font-bold mb-1">Student Plan</h3>
                  <p className={`text-sm mb-4 transition-colors ${hoveredPlan === "student" ? "text-white/90" : "text-on-surface-variant"}`}>300 Credits (30 Resumes)</p>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className={`text-sm line-through leading-none ${hoveredPlan === "student" ? "text-white/55" : "text-on-surface-variant opacity-60"}`}>₹199</p>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md leading-none tracking-wide ${hoveredPlan === "student" ? "bg-white/25 text-white border border-white/30" : "bg-orange-500/15 text-orange-600 border border-orange-400/40"}`}>50% OFF</span>
                  </div>
                  <div className="text-4xl font-black mb-1">₹99</div>
                  <p className={`text-sm mb-8 transition-colors ${hoveredPlan === "student" ? "text-white/90" : "text-on-surface-variant"}`}>/2 months</p>
                  <ul className="space-y-3 mb-10 text-left flex-grow">
                    <li className={`flex items-center gap-3 transition-colors ${hoveredPlan === "student" ? "text-white" : "text-on-surface-variant"}`}>
                      <CheckCircle2 className={`w-4 h-4 flex-shrink-0 transition-colors ${hoveredPlan === "student" ? "text-white" : "text-primary"}`} />
                      300 Credits
                    </li>
                    <li className={`flex items-center gap-3 transition-colors ${hoveredPlan === "student" ? "text-white" : "text-on-surface-variant"}`}>
                      <CheckCircle2 className={`w-4 h-4 flex-shrink-0 transition-colors ${hoveredPlan === "student" ? "text-white" : "text-primary"}`} />
                      Valid for 2 Months
                    </li>
                    <li className={`flex items-center gap-3 transition-colors ${hoveredPlan === "student" ? "text-white" : "text-on-surface-variant"}`}>
                      <CheckCircle2 className={`w-4 h-4 flex-shrink-0 transition-colors ${hoveredPlan === "student" ? "text-white" : "text-primary"}`} />
                      All Premium Features
                    </li>
                    <li className="flex justify-center">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-wide border shadow-sm whitespace-nowrap ${hoveredPlan === "student"
                        ? "bg-gradient-to-r from-orange-500 to-amber-500 border-orange-400 text-white shadow-lg shadow-orange-500/20"
                        : "bg-orange-500/10 border-orange-400/40 text-orange-600"
                        }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse flex-shrink-0" />
                        Grab before {new Date(Date.now() + 86400000).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "/")}
                      </div>
                    </li>
                  </ul>
                  <button
                    onClick={() => { setSelectedPricingPlan("student"); setShowDownloadGate(true); }}
                    className={`w-full py-4 rounded-xl font-bold transition-all ${hoveredPlan === "student" ? "bg-white text-[#006859] shadow-lg shadow-black/5 hover:bg-white/90" : "border-2 border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100"}`}
                  >
                    Claim Student Offer
                  </button>
                </div>

                {/* Bulk Offer — BEST VALUE */}
                <div
                  onMouseEnter={() => setHoveredPlan("bulk_offer")}
                  className={`flex-shrink-0 w-[280px] sm:w-auto snap-center p-8 md:p-10 rounded-[2rem] flex flex-col relative border-2 transition-all duration-300 ${hoveredPlan === "bulk_offer" ? "border-transparent bg-gradient-to-b from-[#006859] to-[#12f8d7] shadow-2xl shadow-primary/30 md:scale-105 z-10 text-white" : "bg-surface-container-lowest border-primary shadow-lg shadow-primary/5 text-on-background"}`}
                >
                  {/* Selection Indicator */}
                  <div className={`absolute top-4 right-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 z-20 ${hoveredPlan === "bulk_offer" ? 'border-white bg-white scale-110' : 'border-primary/30'}`}>
                    {hoveredPlan === "bulk_offer" && <CheckCircle2 className="w-4 h-4 text-[#006859]" />}
                  </div>

                  <div className={`absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest whitespace-nowrap shadow-sm transition-colors ${hoveredPlan === "bulk_offer" ? "bg-white text-[#006859]" : "flash-gradient text-white"}`}>
                    Bulk Offer
                  </div>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors ${hoveredPlan === "bulk_offer" ? "bg-white/20" : "bg-primary/10"}`}>
                    <Package className={`w-5 h-5 transition-colors ${hoveredPlan === "bulk_offer" ? "text-white fill-white/30" : "text-primary"}`} />
                  </div>
                  <h3 className="font-headline text-2xl font-bold mb-1">Bulk Offer</h3>
                  <p className={`text-sm mb-4 transition-colors ${hoveredPlan === "bulk_offer" ? "text-white/90" : "text-on-surface-variant"}`}>3000 Credits (300 Resumes)</p>
                  {/* Strikethrough price */}
                  <div className="flex items-center gap-1.5 mb-1">
                    <p className={`text-sm line-through leading-none ${hoveredPlan === "bulk_offer" ? "text-white/55" : "text-on-surface-variant opacity-60"}`}>₹1,500</p>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md leading-none tracking-wide ${hoveredPlan === "bulk_offer" ? "bg-white/25 text-white border border-white/30" : "bg-primary/15 text-primary border border-primary/40"}`}>60% OFF</span>
                  </div>
                  <div className="text-4xl font-black mb-1">₹599</div>
                  <p className={`text-sm mb-8 transition-colors ${hoveredPlan === "bulk_offer" ? "text-white/90" : "text-on-surface-variant"}`}>/6 Months</p>
                  <ul className="space-y-3 mb-10 text-left flex-grow">
                    <li className={`flex items-center gap-3 transition-colors ${hoveredPlan === "bulk_offer" ? "text-white" : "text-on-background"}`}>
                      <CheckCircle2 className={`w-4 h-4 flex-shrink-0 transition-colors ${hoveredPlan === "bulk_offer" ? "text-white" : "text-primary"}`} />
                      <span>3000 Credits</span>
                    </li>
                    <li className={`flex items-center gap-3 transition-colors ${hoveredPlan === "bulk_offer" ? "text-white" : "text-on-background"}`}>
                      <CheckCircle2 className={`w-4 h-4 flex-shrink-0 transition-colors ${hoveredPlan === "bulk_offer" ? "text-white" : "text-primary"}`} />
                      <span>Valid for 6 Months</span>
                    </li>
                    <li className={`flex items-center gap-3 transition-colors ${hoveredPlan === "bulk_offer" ? "text-white" : "text-on-background"}`}>
                      <CheckCircle2 className={`w-4 h-4 flex-shrink-0 transition-colors ${hoveredPlan === "bulk_offer" ? "text-white" : "text-primary"}`} />
                      <span>Just ₹2 per Resume</span>
                    </li>
                    <li className={`flex items-center gap-3 transition-colors ${hoveredPlan === "bulk_offer" ? "text-white" : "text-on-background"}`}>
                      <CheckCircle2 className={`w-4 h-4 flex-shrink-0 transition-colors ${hoveredPlan === "bulk_offer" ? "text-white" : "text-primary"}`} />
                      <span>All Premium Features</span>
                    </li>
                  </ul>
                  <button
                    onClick={() => { setSelectedPricingPlan("bulk_offer"); setShowDownloadGate(true); }}
                    className={`w-full py-4 rounded-xl font-bold transition-all ${hoveredPlan === "bulk_offer" ? "bg-white text-[#006859] shadow-lg shadow-black/5 hover:bg-white/90" : "flash-gradient text-white hover:opacity-90"}`}
                  >
                    Claim Bulk Offer →
                  </button>
                </div>



              </div>
            </div>
          </section>
        )}



        {/* Reviews Section */}
        <section id="reviews" className="py-32">
          <div className="max-w-7xl mx-auto px-6">
            <div className="mb-12">
              <h2 className="font-headline text-4xl md:text-5xl font-bold text-on-background mb-4">Real people. Real Trust.</h2>
              <p className="text-on-surface-variant text-lg">Join the #fightclub.</p>
            </div>
          </div>

          <ReviewStatsBar onStats={(s) => setTotalSignups(s.total_signups)} />

          <div className="max-w-7xl mx-auto px-6">
            {/* ── Mobile: horizontal snap-scroll  ── Desktop: 3-col grid ── */}
            <div
              className="
                flex md:hidden
                gap-4
                overflow-x-auto
                snap-x snap-mandatory
                scroll-smooth
                pb-4
                -mx-6 px-6
                [&::-webkit-scrollbar]:hidden
                [scrollbar-width:none]
              "
            >
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
                <div
                  key={idx}
                  className="
                    snap-center snap-always
                    flex-shrink-0
                    w-[82vw]
                    bg-surface-container-low p-7 rounded-3xl
                    border border-surface-container-highest
                  "
                >
                  <div className="flex items-center gap-4 mb-5">
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

            {/* ── Desktop grid (unchanged) ── */}
            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-8">
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
            <ReviewsMarquee />
          </div>
        </section>

        {/* Footer CTA */}
        <section className="max-w-7xl mx-auto px-6 mb-32">
          <div className="flash-gradient rounded-[3rem] py-20 px-10 text-center text-white overflow-hidden relative">
            <div className="relative z-10">
              <h2 className="font-headline text-4xl md:text-6xl font-bold mb-6">Eliminate the drama</h2>
              <p className="text-xl mb-12 opacity-90 max-w-2xl mx-auto">
                Save your time, efforts and stress.
              </p>
              <button
                onClick={() => document.getElementById('upload-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className="bg-white text-primary text-xl font-bold px-12 py-5 rounded-full hover:shadow-2xl transition-all active:scale-95"
              >
                Try Now
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
          <div className="flex flex-wrap justify-center gap-6 md:gap-8 font-sans text-[10px] md:text-xs tracking-wide uppercase font-bold">
            <a href="/privacy" className="text-on-surface-variant hover:text-primary transition-colors">Privacy Policy</a>
            <a href="/terms" className="text-on-surface-variant hover:text-primary transition-colors">Terms of Service</a>
            <a href="/refund-policy" className="text-on-surface-variant hover:text-primary transition-colors">Refund Policy</a>
            <a href="/contact" className="text-on-surface-variant hover:text-primary transition-colors">Contact Support</a>
          </div>
          <div className="text-on-surface-variant text-xs font-sans uppercase tracking-wide">
            © 2024 Flashresume. All rights reserved.
          </div>
        </div>
      </footer>
      {/* Pricing Popup Modal */}
      <PricingPopup
        isOpen={showDownloadGate}
        onClose={() => {
          setShowDownloadGate(false);
          setPurchaseSuccess(false);
        }}
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
      {/* Buy More Credits popup — always shows plan selection regardless of current credits */}
      <PricingPopup
        isOpen={showBuyMoreCredits}
        onClose={() => setShowBuyMoreCredits(false)}
        onSuccess={() => {
          setShowBuyMoreCredits(false);
          // Refresh credits from Supabase immediately
          if (currentUser) {
            supabase.from("users").select("credits_balance").eq("id", currentUser.id).single()
              .then(({ data }) => { if (data) setCredits(data.credits_balance); });
          }
          setPurchaseSuccess(true);
          setTimeout(() => setPurchaseSuccess(false), 5000);
        }}
        forcePlanSelect={true}
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
        loginOnly={true}
      />
    </div>
  );
}
