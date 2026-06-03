"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Target,
  XCircle,
  Lightbulb,
  FolderGit2,
  Code
} from "lucide-react";
import type { CombinedAnalysisResponse } from "@/lib/api";
import ModelSelector from "@/components/ModelSelector";

export default function AnalyzePage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<CombinedAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectApproved, setProjectApproved] = useState(true);

  useEffect(() => {
    const analysisData = localStorage.getItem("analysis");

    if (!analysisData) {
      router.push("/");
      return;
    }

    const parsedAnalysis = JSON.parse(analysisData);
    console.log("[DEBUG] Analysis data:", parsedAnalysis);
    console.log("[DEBUG] has_relevant_projects:", parsedAnalysis.has_relevant_projects);
    console.log("[DEBUG] relevant_projects:", parsedAnalysis.relevant_projects);
    console.log("[DEBUG] suggested_project:", parsedAnalysis.suggested_project);
    console.log("[DEBUG] requires_consent:", parsedAnalysis.requires_consent);

    setAnalysis(parsedAnalysis);
    setLoading(false);
  }, [router]);

  const handleProceed = () => {
    // Save project approval if needed
    if (analysis?.requires_consent && analysis.suggested_project && projectApproved) {
      localStorage.setItem("approved_project", JSON.stringify(analysis.suggested_project));
    } else {
      // CRITIAL FIX: If consent is not required or not approved, explicitly clear
      // any lingering approved project from a previous session to prevent leaking.
      localStorage.removeItem("approved_project");
    }

    // Go to generate page
    router.push("/generate");
  };

  if (loading || !analysis) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto mb-6"></div>
          <p className="text-on-surface-variant font-medium">Loading analysis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface font-sans py-10 px-4 md:py-16 md:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-2xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-wide uppercase mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            Analysis Complete
          </div>
          <h1 className="font-headline text-4xl md:text-5xl font-extrabold text-on-background mb-4 tracking-tight">
            Resume Match Analysis
          </h1>
          <p className="text-lg text-on-surface-variant font-medium">
            Here's how your resume matches against the job description.
          </p>
        </motion.div>

        {/* ATS Score Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="relative bg-gradient-to-br from-surface-container-lowest to-surface-container-low rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 shadow-2xl border border-surface-container-high overflow-hidden flex flex-col items-center justify-center text-center"
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-40 bg-[#006859]/20 blur-[80px] rounded-[100%] pointer-events-none"></div>

          <div className="relative z-10 flex flex-col items-center">
            <div className="inline-flex items-center gap-2 mb-2 text-on-surface-variant font-semibold tracking-wide uppercase text-sm">
              <Target className="w-4 h-4 text-[#006859]" />
              Current ATS Score
            </div>

            <div className="text-[6rem] md:text-[8rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-[#006859] to-[#12f8d7] leading-none drop-shadow-sm mb-4">
              {analysis.ats_score}%
            </div>

            <div className="flex items-center justify-center gap-2 mb-6">
              <div className={`h-2.5 w-2.5 rounded-full ${analysis.ats_score >= 70 ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]' : 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)]'}`}></div>
              <p className="text-on-background font-bold text-lg md:text-xl">
                {analysis.ats_score >= 70
                  ? "Great start! We'll push it to perfection."
                  : "Let's increase it."}
              </p>
            </div>

            {analysis.model_used && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface rounded-2xl shadow-sm border border-surface-container-high text-xs text-on-surface-variant font-medium">
                <Sparkles className="w-3.5 h-3.5 text-[#006859]" />
                Analyzed by <span className="font-bold text-[#006859]">{analysis.model_used}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Keywords Grid (Matched vs Missing) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Matched Keywords */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-surface-container-lowest rounded-[2rem] p-6 md:p-8 shadow-lg border border-surface-container-low flex flex-col h-full"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h3 className="font-headline text-xl font-bold text-on-background">
                  Matched Skills
                </h3>
              </div>
              <span className="bg-primary/10 px-3 py-1 rounded-full text-primary font-bold text-sm">
                {analysis.matched_skills.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-2.5 flex-1 content-start">
              {analysis.matched_skills.length > 0 ? (
                analysis.matched_skills.map((skill, idx) => (
                  <motion.span
                    key={idx}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + idx * 0.02 }}
                    className="px-3.5 py-1.5 bg-primary/10 text-primary rounded-xl text-sm font-semibold border border-primary/20 hover:bg-primary/20 transition-colors"
                  >
                    {skill}
                  </motion.span>
                ))
              ) : (
                <p className="text-sm text-on-surface-variant italic w-full text-center py-4">No exact matches found.</p>
              )}
            </div>
          </motion.div>

          {/* Missing Keywords */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-surface-container-lowest rounded-[2rem] p-6 md:p-8 shadow-lg border border-surface-container-low flex flex-col h-full"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center text-error">
                  <XCircle className="w-5 h-5" />
                </div>
                <h3 className="font-headline text-xl font-bold text-on-background">
                  Missing Skills
                </h3>
              </div>
              <span className="bg-error/10 px-3 py-1 rounded-full text-error font-bold text-sm">
                {(analysis.all_missing_skills ?? analysis.missing_skills).length}
              </span>
            </div>
            <div className="flex flex-wrap gap-2.5 flex-1 content-start mb-6">
              {(analysis.all_missing_skills ?? analysis.missing_skills).length > 0 ? (
                (analysis.all_missing_skills ?? analysis.missing_skills).map((skill, idx) => (
                  <motion.span
                    key={idx}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 + idx * 0.02 }}
                    className="px-3.5 py-1.5 bg-error/10 text-error rounded-xl text-sm font-semibold border border-error/20 hover:bg-error/20 transition-colors"
                  >
                    {skill}
                  </motion.span>
                ))
              ) : (
                <p className="text-sm text-on-surface-variant italic w-full text-center py-4">You have all the required skills!</p>
              )}
            </div>
            <div className="mt-auto p-4 bg-tertiary-container/10 border border-tertiary-container/30 rounded-2xl flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-tertiary flex-shrink-0 mt-0.5" />
              <p className="text-xs md:text-sm text-on-surface-variant font-medium">
                Our AI will seamlessly weave these missing keywords into your resume bullet points where contextually relevant.
              </p>
            </div>
          </motion.div>
        </div>

        {/* Project Approval (if needed) */}
        {analysis.requires_consent && analysis.suggested_project && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={`relative rounded-[2rem] p-1 shadow-2xl transition-all duration-300 ${projectApproved ? 'bg-gradient-to-r from-[#006859] to-[#12f8d7] shadow-[#006859]/20' : 'bg-surface-container-high border border-surface-container-highest'}`}
          >
            <div className="bg-surface-container-lowest rounded-[1.9rem] p-6 md:p-8 h-full">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${projectApproved ? 'bg-[#006859]/10 text-[#006859]' : 'bg-surface-container-high text-on-surface-variant'}`}>
                    <FolderGit2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-headline text-2xl font-bold text-on-background">
                      Strategic Project Suggestion
                    </h3>
                    <p className="text-sm text-on-surface-variant font-medium">Boost your technical match instantly</p>
                  </div>
                </div>

                {/* Custom Toggle/Checkbox */}
                <label className="flex items-center gap-3 cursor-pointer group bg-surface p-2 pr-4 rounded-full border border-surface-container-high hover:border-[#006859]/50 transition-colors">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={projectApproved}
                      onChange={(e) => setProjectApproved(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="w-12 h-6 bg-surface-container-high rounded-full peer-checked:bg-[#006859] transition-colors duration-300"></div>
                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-md transform peer-checked:translate-x-6 transition-transform duration-300 flex items-center justify-center">
                      {projectApproved && <CheckCircle2 className="w-3 h-3 text-[#006859]" />}
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${projectApproved ? 'text-[#006859]' : 'text-on-surface-variant'}`}>
                    {projectApproved ? 'Include Project' : 'Skip Project'}
                  </span>
                </label>
              </div>

              <div className={`rounded-2xl p-6 transition-colors duration-300 ${projectApproved ? 'bg-[#006859]/5 border border-[#006859]/10' : 'bg-surface-container-low border border-transparent'}`}>
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${projectApproved ? 'bg-white shadow-sm text-[#006859]' : 'bg-surface text-on-surface-variant'}`}>
                    <Code className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-bold text-lg mb-1.5 ${projectApproved ? 'text-on-background' : 'text-on-surface-variant'}`}>
                      {analysis.suggested_project.title}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Tech Stack:</span>
                      <span className={`text-xs px-2 py-1 rounded-md font-semibold ${projectApproved ? 'bg-[#006859]/10 text-[#006859]' : 'bg-surface text-on-surface-variant border border-surface-container-high'}`}>
                        {analysis.suggested_project.tech_stack}
                      </span>
                    </div>
                    <p className={`text-sm leading-relaxed ${projectApproved ? 'text-on-surface-variant' : 'text-on-surface-variant/70'}`}>
                      {analysis.suggested_project.description}
                    </p>
                  </div>
                </div>
              </div>

              {!projectApproved && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 overflow-hidden"
                >
                  <div className="bg-error/10 border border-error/20 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-error font-medium">
                      <strong className="block mb-1">Warning: Low Relevance</strong>
                      Without a relavant project there is no point of applying and get shortlisted. Don't worry You can always build this project later.
                    </p>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {/* Action Bottom Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-surface-container-lowest rounded-[2rem] p-6 shadow-xl border border-surface-container-high flex flex-col items-center gap-6 relative z-[60]"
        >
          <div className="absolute inset-0 overflow-hidden rounded-[2rem] pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#006859]/5 to-transparent skew-x-12 translate-x-[-100%] animate-[shimmer_3s_infinite]"></div>
          </div>

          <div className="w-full max-w-md relative z-10">
            <p className="text-sm font-bold text-on-background mb-2 flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-[#006859]" /> Select Generation Model
            </p>
            <ModelSelector storageKey="preferred_model" label="R2 Model (Generation)" />
          </div>

          <div className="relative z-10">
            <button
              onClick={handleProceed}
              disabled={!!(analysis.requires_consent && !projectApproved)}
              className={`text-white text-lg font-bold px-14 py-4 rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 ${analysis.requires_consent && !projectApproved
                ? "bg-surface-container-high text-on-surface-variant cursor-not-allowed border border-surface-container-highest"
                : "bg-gradient-to-r from-[#006859] to-[#12f8d7] shadow-[0_8px_30px_rgba(0,104,89,0.3)] hover:shadow-[0_8px_30px_rgba(18,248,215,0.4)] hover:-translate-y-0.5 hover:opacity-90 active:translate-y-0 active:shadow-none"
                }`}
            >
              Generate
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
