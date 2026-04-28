"use client";

import { motion } from "motion/react";
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
  X
} from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { parseResume, analyzeResume } from "@/lib/api";
import DownloadGateModal from "@/components/DownloadGateModal";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import CreditBadge from "@/components/CreditBadge";

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
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setCurrentUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

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

    const hasJD = jobDescription.trim().length > 0;
    // Clear stale no_jd_mode flag from any previous session
    localStorage.removeItem("no_jd_mode");

    try {
      let finalResumeText = resumeText;

      if (inputType === "file" && file) {
        const parseResult = await parseResume(file);
        finalResumeText = parseResult.resume_text;
      }

      localStorage.setItem("resume_text", finalResumeText);
      localStorage.setItem("job_description", jobDescription);
      // Clear any leaked state from previous runs
      localStorage.removeItem("approved_project");

      if (hasJD) {
        // Normal flow: analyze against JD, show analysis page
        const analysisResult = await analyzeResume(finalResumeText, jobDescription);
        localStorage.setItem("analysis", JSON.stringify(analysisResult));
        router.push("/analyze");
      } else {
        // No-JD mode: skip analysis entirely, go straight to preview
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
        <div className="flex justify-between items-center max-w-7xl mx-auto px-6 py-4 w-full">
          <div className="text-2xl font-extrabold tracking-tighter text-on-background font-headline">
            Flashresume
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#process" className="text-on-surface-variant hover:text-primary transition-colors font-medium">Process</a>
            <a href="#pricing" className="text-on-surface-variant hover:text-primary transition-colors font-medium">Pricing</a>
            <a href="#reviews" className="text-on-surface-variant hover:text-primary transition-colors font-medium">Reviews</a>
          </div>
          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-3">
                <CreditBadge onTopUpClick={() => { setSelectedPricingPlan(null); setShowDownloadGate(true); }} />
                <span className="hidden md:block text-sm text-on-surface-variant font-medium truncate max-w-[160px]">
                  {currentUser.email}
                </span>
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setCurrentUser(null);
                  }}
                  className="text-sm font-bold px-4 py-2 rounded-full border border-on-surface-variant/20 hover:bg-surface-container-low transition-colors text-on-surface-variant"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setSelectedPricingPlan(null); setShowDownloadGate(true); }}
                  className="text-sm font-bold px-4 py-2 rounded-full border border-on-surface-variant/20 hover:bg-surface-container-low transition-colors text-on-surface-variant"
                >
                  Log In
                </button>
                <button
                  onClick={() => document.getElementById('file-upload')?.click()}
                  className="flash-gradient text-white font-bold px-6 py-2.5 rounded-full hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-primary/20"
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
            <div className="bg-surface-container-lowest rounded-[2rem] p-8 shadow-2xl shadow-primary/5 border border-primary/5">
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
                    href="/reference_Resume.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-tertiary hover:text-tertiary-container transition-colors flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    First time? View Gold Standard Template
                  </a>
                </div>
                <div className="space-y-2">
                  <label className="font-sans text-xs font-semibold uppercase tracking-wider text-on-surface-variant ml-1">
                    PASTE JOB DESCRIPTION
                  </label>
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    className="w-full px-6 py-4 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary-container transition-all placeholder:text-on-surface-variant/50 min-h-[120px] resize-none"
                    placeholder="Paste the job description here..."
                  />
                </div>
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
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="w-full bg-on-background text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Bolt className="text-primary-container w-5 h-5 fill-primary-container" />
                  {loading ? "Processing..." : jobDescription.trim() ? "Generate" : "Optimize Resume"}
                </button>
              </div>
            </div>
            {/* Decorative Elements */}
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-primary-container/20 blur-3xl rounded-full -z-10"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-tertiary-container/10 blur-3xl rounded-full -z-10"></div>
          </motion.div>
        </section>

        {/* How It Works */}
        <section id="process" className="bg-surface-container-low py-32">
          <div className="max-w-7xl mx-auto px-6">
            <div className="mb-20">
              <h2 className="font-headline text-4xl md:text-5xl font-bold text-on-background mb-4">Three steps. Zero effort.</h2>
              <p className="text-on-surface-variant text-lg">Eliminate the headache of updating your resume manually everytime for every JD.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: <Upload className="text-primary w-8 h-8" />,
                  title: "Upload",
                  desc: "Throw in your old resume and the job description you want. Our AI reads between the lines.",
                  bgColor: "bg-primary-container/20"
                },
                {
                  icon: <Wand2 className="text-secondary-container w-8 h-8" />,
                  title: "Refine",
                  desc: "Flashresume optimizes keywords, layout, and phrasing to beat the ATS bots instantly.",
                  bgColor: "bg-secondary-container/20"
                },
                {
                  icon: <Rocket className="text-tertiary-container w-8 h-8" />,
                  title: "Deploy",
                  desc: "Download a pixel-perfect, editorial-grade PDF that recruiters actually want to read.",
                  bgColor: "bg-tertiary-container/20"
                }
              ].map((step, idx) => (
                <motion.div
                  key={idx}
                  whileHover={{ y: -8 }}
                  className="bg-surface-container-lowest p-10 rounded-[2rem] transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-primary/5"
                >
                  <div className={`w-16 h-16 rounded-2xl ${step.bgColor} flex items-center justify-center mb-8`}>
                    {step.icon}
                  </div>
                  <h3 className="font-headline text-2xl font-bold mb-4">{step.title}</h3>
                  <p className="text-on-surface-variant leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ATS Demo Section */}
        <section className="py-32 overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="font-headline text-4xl md:text-6xl font-bold text-on-background mb-8 leading-tight">See what AI actually fixes.</h2>
              <p className="text-xl text-on-surface-variant mb-10">Flashresume objective is simple "Build resume that passes ats machine and then human recruiter in actual interview"</p>
              <ul className="space-y-6">
                {[
                  "Action Verb Optimization",
                  "Quantifiable Achievement Extraction",
                  "Layout Readability Score"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-4">
                    <CheckCircle2 className="text-primary-container w-6 h-6 fill-primary-container/20" />
                    <span className="font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
            <div className="relative">
              <div className="bg-surface-container-low rounded-[2.5rem] p-8 md:p-12">
                <div className="space-y-12">
                  {/* Score 1 */}
                  <div>
                    <div className="flex justify-between items-end mb-4">
                      <div>
                        <span className="font-sans text-xs font-bold uppercase tracking-widest text-on-surface-variant">BEFORE FLASHRESUME</span>
                        <h4 className="font-headline text-2xl font-bold">Standard Resume</h4>
                      </div>
                      <span className="text-4xl font-black text-error">34%</span>
                    </div>
                    <div className="w-full h-4 bg-surface-container-high rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: "34%" }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-error rounded-full"
                      />
                    </div>
                    <p className="mt-3 text-sm text-error font-medium flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      High risk of ATS rejection
                    </p>
                  </div>
                  {/* Score 2 */}
                  <div>
                    <div className="flex justify-between items-end mb-4">
                      <div>
                        <span className="font-sans text-xs font-bold uppercase tracking-widest text-primary">POST OPTIMIZATION</span>
                        <h4 className="font-headline text-2xl font-bold">Flash Profile</h4>
                      </div>
                      <span className="text-4xl font-black text-primary">89%</span>
                    </div>
                    <div className="w-full h-4 bg-surface-container-high rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: "89%" }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                        className="h-full flash-gradient rounded-full"
                      />
                    </div>
                    <p className="mt-3 text-sm text-primary font-medium flex items-center gap-1">
                      <Verified className="w-4 h-4" />
                      Interview Ready
                    </p>
                  </div>
                </div>
              </div>
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary-container/30 blur-3xl -z-10"></div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        {currentUser && (
          <section id="pricing" className="bg-surface py-32">
            <div className="max-w-7xl mx-auto px-6 text-center mb-20">
              <h2 className="font-headline text-4xl md:text-5xl font-bold text-on-background mb-4">Invest in yourself</h2>
              <p className="text-on-surface-variant text-lg">Premium features, student-friendly pricing.</p>
            </div>
            <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-8 items-stretch">
              {/* Free */}
              <div className="bg-surface-container-low p-10 rounded-[2rem] flex flex-col border border-transparent">
                <h3 className="font-headline text-2xl font-bold mb-2">Per Resume</h3>
                <div className="text-4xl font-black mb-8">
                  ₹29 <span className="text-base font-normal text-on-surface-variant">/download</span>
                </div>
                <ul className="space-y-4 mb-10 text-left flex-grow">
                  <li className="flex items-start gap-3 text-on-surface-variant">
                    <Check className="w-5 h-5 mt-0.5" />
                    30 Credits (3 downloads)
                  </li>
                  <li className="flex items-start gap-3 text-on-surface-variant">
                    <Check className="w-5 h-5 mt-0.5" />
                    Basic ATS Scan
                  </li>
                </ul>
                <button
                  onClick={() => { setSelectedPricingPlan("pay_per_use"); setShowDownloadGate(true); }}
                  className="w-full py-4 rounded-xl border border-on-surface-variant/20 font-bold hover:bg-surface-container-high transition-colors"
                >
                  Start Free
                </button>
              </div>

              {/* Student */}
              <div className="bg-surface-container-lowest p-10 rounded-[2rem] flex flex-col relative border-2 border-primary-container shadow-2xl shadow-primary/10 scale-105 z-10">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                  MOST POPULAR
                </div>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <span className="text-2xl">🎓</span>
                </div>
                <h3 className="font-headline text-2xl font-bold mb-2">Student Plan</h3>
                <div className="text-4xl font-black mb-8">
                  ₹99 <span className="text-base font-normal text-on-surface-variant">/60 days</span>
                </div>
                <ul className="space-y-4 mb-10 text-left flex-grow">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="text-primary w-5 h-5 mt-0.5 fill-primary/10" />
                    300 Credits
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="text-primary w-5 h-5 mt-0.5 fill-primary/10" />
                    60-Day Access
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="text-primary w-5 h-5 mt-0.5 fill-primary/10" />
                    All Templates
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="text-primary w-5 h-5 mt-0.5 fill-primary/10" />
                    Priority Support
                  </li>
                </ul>
                <button
                  onClick={() => { setSelectedPricingPlan("student"); setShowDownloadGate(true); }}
                  className="w-full flash-gradient text-white py-4 rounded-xl font-bold hover:opacity-90 transition-opacity"
                >
                  Claim Student Offer
                </button>
              </div>

              {/* Pro Monthly */}
              <div className="bg-surface-container-low p-10 rounded-[2rem] flex flex-col border border-transparent">
                <h3 className="font-headline text-2xl font-bold mb-2">Pro Monthly</h3>
                <div className="text-4xl font-black mb-8">
                  ₹199 <span className="text-base font-normal text-on-surface-variant">/60 days</span>
                </div>
                <ul className="space-y-4 mb-10 text-left flex-grow">
                  <li className="flex items-start gap-3 text-on-surface-variant">
                    <CheckCircle2 className="text-primary w-5 h-5 mt-0.5 fill-primary/10" />
                    Unlimited Resumes
                  </li>
                  <li className="flex items-start gap-3 text-on-surface-variant">
                    <CheckCircle2 className="text-primary w-5 h-5 mt-0.5 fill-primary/10" />
                    AI Tailoring per Job
                  </li>
                  <li className="flex items-start gap-3 text-on-surface-variant">
                    <CheckCircle2 className="text-primary w-5 h-5 mt-0.5 fill-primary/10" />
                    Premium Templates
                  </li>
                  <li className="flex items-start gap-3 text-on-surface-variant">
                    <CheckCircle2 className="text-primary w-5 h-5 mt-0.5 fill-primary/10" />
                    PDF Exports
                  </li>
                </ul>
                <button
                  onClick={() => { setSelectedPricingPlan("regular"); setShowDownloadGate(true); }}
                  className="w-full py-4 rounded-xl border border-on-surface-variant/20 font-bold hover:bg-surface-container-high transition-colors"
                >
                  Go Pro
                </button>
              </div>
            </div>
          </section>
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
                onClick={() => document.getElementById('file-upload')?.click()}
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
      {/* Download Gate Modal */}
      <DownloadGateModal
        isOpen={showDownloadGate}
        onClose={() => setShowDownloadGate(false)}
        onPaymentSuccess={() => {
          setShowDownloadGate(false);
          router.push("/result");
        }}
        initialPlan={selectedPricingPlan}
      />
    </div>
  );
}
