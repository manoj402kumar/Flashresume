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

export default function AnalyzePage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<CombinedAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectApproved, setProjectApproved] = useState(false);

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

    // Go to preview page
    router.push("/preview");
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
    <div className="min-h-screen bg-surface font-sans py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="font-headline text-4xl md:text-5xl font-bold text-on-background mb-4">
            Resume Analysis
          </h1>
          <p className="text-lg text-on-surface-variant">
            Here's how your resume matches the job description
          </p>
        </motion.div>

        {/* ATS Score Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-primary/20 to-primary-container/20 rounded-[3rem] p-12 mb-8 relative overflow-hidden"
        >
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary-container/30 blur-3xl rounded-full"></div>
          <div className="relative z-10 text-center">
            <div className="inline-flex items-center gap-3 mb-4">
              <Target className="w-8 h-8 text-primary" />
              <h2 className="font-headline text-2xl font-bold text-on-background">
                Current ATS Score
              </h2>
            </div>
            <div className="text-7xl font-black text-primary mb-4">
              {analysis.ats_score}%
            </div>
            <p className="text-on-surface-variant text-lg">
              {analysis.ats_score >= 70
                ? "Good match! We'll optimize it further."
                : "Needs improvement. Our AI will enhance it."}
            </p>
          </div>
        </motion.div>

        {/* Matched Skills */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-surface-container-lowest rounded-[2rem] p-8 mb-8 shadow-xl"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-primary-container/20 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-headline text-2xl font-bold text-on-background">
              Matched Keywords
            </h3>
            <span className="ml-auto bg-primary-container/20 px-4 py-2 rounded-full text-primary font-bold">
              {analysis.matched_skills.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {analysis.matched_skills.map((skill, idx) => (
              <motion.span
                key={idx}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + idx * 0.02 }}
                className="px-4 py-2 bg-primary-container/20 text-primary rounded-full text-sm font-medium flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                {skill}
              </motion.span>
            ))}
          </div>
        </motion.div>

        {/* Missing Skills */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-surface-container-lowest rounded-[2rem] p-8 mb-8 shadow-xl"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-error/20 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-error" />
            </div>
            <h3 className="font-headline text-2xl font-bold text-on-background">
              Missing Keywords
            </h3>
            <span className="ml-auto bg-error/20 px-4 py-2 rounded-full text-error font-bold">
              {analysis.missing_skills.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {analysis.missing_skills.map((skill, idx) => (
              <motion.span
                key={idx}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + idx * 0.02 }}
                className="px-4 py-2 bg-error/10 text-error rounded-full text-sm font-medium flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4" />
                {skill}
              </motion.span>
            ))}
          </div>
          <div className="mt-6 p-4 bg-tertiary-container/10 border border-tertiary-container/20 rounded-xl">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-tertiary-container flex-shrink-0 mt-0.5" />
              <p className="text-sm text-on-surface-variant">
                Our AI will naturally integrate these missing keywords into your resume where relevant.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Project Approval (if needed) */}
        {/* ONLY show if: requires_consent is true AND suggested_project exists AND has NO relevant projects */}
        {analysis.requires_consent && analysis.suggested_project && !analysis.has_relevant_projects && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-surface-container-lowest rounded-[2rem] p-8 mb-8 shadow-xl border-2 border-primary/20"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-primary-container/20 flex items-center justify-center">
                <FolderGit2 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-headline text-2xl font-bold text-on-background">
                Project Suggestion
              </h3>
            </div>

            <div className="bg-primary-container/10 rounded-xl p-6 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary-container/20 flex items-center justify-center flex-shrink-0">
                  <Code className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-lg text-on-background mb-2">
                    {analysis.suggested_project.title}
                  </h4>
                  <p className="text-sm text-on-surface-variant mb-3">
                    <strong>Tech Stack:</strong> {analysis.suggested_project.tech_stack}
                  </p>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    {analysis.suggested_project.description}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-tertiary-container/10 border border-tertiary-container/20 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-tertiary-container flex-shrink-0 mt-0.5" />
                <div className="text-sm text-on-surface-variant">
                  <p className="font-semibold mb-1">Why this suggestion?</p>
                  <p>
                    {analysis.has_relevant_projects
                      ? `You have ${analysis.total_projects_count} project(s), but we recommend adding this highly relevant project to strengthen your profile.`
                      : "Your resume lacks projects relevant to this job description. Adding this project will significantly improve your ATS score."}
                  </p>
                </div>
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer p-4 bg-surface-container-low rounded-xl hover:bg-surface-container-lowest transition-colors">
              <input
                type="checkbox"
                checked={projectApproved}
                onChange={(e) => setProjectApproved(e.target.checked)}
                className="w-5 h-5 rounded border-2 border-primary text-primary focus:ring-2 focus:ring-primary"
              />
              <span className="text-on-background font-medium">
                Yes, add this project to my resume
              </span>
            </label>
          </motion.div>
        )}

        {/* Info Box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-primary-container/10 border border-primary-container/20 rounded-2xl p-6 mb-8"
        >
          <div className="flex items-start gap-4">
            <Sparkles className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
            <div>
              <h4 className="font-bold text-on-background mb-2">What happens next?</h4>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Our AI will analyze your Work Experience and Projects sections, then show you exactly what will be enhanced before generating the final resume. You'll have full control over the changes.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Action Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex justify-center"
        >
          <button
            onClick={handleProceed}
            className="flash-gradient text-white text-lg font-bold px-12 py-5 rounded-full flex items-center gap-3 hover:opacity-90 transition-all shadow-xl shadow-primary/25 active:scale-95"
          >
            Continue to Preview
            <ArrowRight className="w-6 h-6" />
          </button>
        </motion.div>
      </div>
    </div>
  );
}
