"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { 
  CheckCircle2, 
  XCircle, 
  Lightbulb, 
  Rocket, 
  ArrowLeft, 
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Target
} from "lucide-react";
import type { AnalyzeResponse, ProjectCheckResponse } from "@/lib/api";

export default function AnalyzePage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [projectCheck, setProjectCheck] = useState<ProjectCheckResponse | null>(null);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load data from localStorage
    const analysisData = localStorage.getItem("analysis");
    const projectCheckData = localStorage.getItem("project_check");

    if (!analysisData || !projectCheckData) {
      // No data found - redirect back to home
      router.push("/");
      return;
    }

    const parsedAnalysis = JSON.parse(analysisData);
    const parsedProjectCheck = JSON.parse(projectCheckData);

    setAnalysis(parsedAnalysis);
    setProjectCheck(parsedProjectCheck);
    setLoading(false);

    // Animate ATS score
    let current = 0;
    const target = parsedAnalysis.ats_score;
    const increment = target / 50; // 50 steps
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setAnimatedScore(target);
        clearInterval(timer);
      } else {
        setAnimatedScore(Math.floor(current));
      }
    }, 20);

    return () => clearInterval(timer);
  }, [router]);

  if (loading || !analysis || !projectCheck) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto mb-6"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary-container animate-pulse" />
            </div>
          </div>
          <p className="text-on-surface-variant font-medium">Analyzing your resume...</p>
        </div>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-primary";
    if (score >= 40) return "text-secondary-container";
    return "text-error";
  };

  const getScoreGradient = (score: number) => {
    if (score >= 70) return "from-primary/20 to-primary-container/20";
    if (score >= 40) return "from-secondary-container/20 to-tertiary-container/20";
    return "from-error/20 to-error/10";
  };

  const getScoreMessage = (score: number) => {
    if (score >= 70) return { icon: CheckCircle2, text: "Excellent match! Your resume is well-optimized.", color: "text-primary" };
    if (score >= 40) return { icon: TrendingUp, text: "Good start, but there's room for improvement.", color: "text-secondary-container" };
    return { icon: AlertTriangle, text: "Needs significant optimization to pass ATS filters.", color: "text-error" };
  };

  const scoreMessage = getScoreMessage(analysis.ats_score);
  const ScoreIcon = scoreMessage.icon;

  return (
    <div className="min-h-screen bg-surface font-sans">
      {/* Header */}
      <div className="bg-surface-container-lowest border-b border-surface-container-low">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 bg-primary-container/20 px-4 py-2 rounded-full mb-4">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest text-primary">Analysis Complete</span>
            </div>
            <h1 className="font-headline text-4xl md:text-6xl font-bold text-on-background mb-4">
              Your Resume Score
            </h1>
            <p className="text-xl text-on-surface-variant max-w-2xl mx-auto">
              Here's how your resume matches the job description
            </p>
          </motion.div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-12 md:py-20">
        {/* ATS Score Hero Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative mb-12"
        >
          <div className={`bg-gradient-to-br ${getScoreGradient(analysis.ats_score)} rounded-[3rem] p-12 md:p-16 shadow-2xl shadow-primary/5 border border-primary/10 overflow-hidden relative`}>
            {/* Decorative blur orbs */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary-container/30 blur-3xl rounded-full"></div>
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-tertiary-container/20 blur-3xl rounded-full"></div>
            
            <div className="relative z-10">
              <div className="text-center mb-8">
                <p className="font-sans text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">Your ATS Score</p>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.8, delay: 0.4, type: "spring" }}
                  className={`text-8xl md:text-9xl font-black ${getScoreColor(analysis.ats_score)} mb-4 font-headline`}
                >
                  {animatedScore}
                  <span className="text-5xl md:text-6xl text-on-surface-variant">/100</span>
                </motion.div>
                
                {/* Progress Bar */}
                <div className="max-w-2xl mx-auto mb-6">
                  <div className="w-full h-4 bg-surface-container-high rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${animatedScore}%` }}
                      transition={{ duration: 1.5, delay: 0.6, ease: "easeOut" }}
                      className={`h-full rounded-full ${
                        analysis.ats_score >= 70
                          ? "flash-gradient"
                          : analysis.ats_score >= 40
                          ? "bg-secondary-container"
                          : "bg-error"
                      }`}
                    />
                  </div>
                </div>

                {/* Status Message */}
                <div className={`inline-flex items-center gap-3 ${scoreMessage.color} bg-surface-container-lowest/80 backdrop-blur-sm px-6 py-3 rounded-full`}>
                  <ScoreIcon className="w-5 h-5" />
                  <span className="font-medium">{scoreMessage.text}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Skills Analysis */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Matched Skills */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            whileHover={{ y: -4 }}
            className="bg-surface-container-lowest rounded-[2rem] p-8 shadow-xl hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300 border border-primary/5"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-primary-container/20 flex items-center justify-center">
                <CheckCircle2 className="text-primary w-6 h-6" />
              </div>
              <h2 className="font-headline text-2xl font-bold text-on-background">Matched Skills</h2>
            </div>
            {analysis.matched_skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {analysis.matched_skills.map((skill, idx) => (
                  <motion.span
                    key={idx}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.4 + idx * 0.05 }}
                    className="px-4 py-2 bg-primary-container/20 text-primary rounded-full text-sm font-semibold border border-primary/10"
                  >
                    {skill}
                  </motion.span>
                ))}
              </div>
            ) : (
              <p className="text-on-surface-variant text-sm">No matched skills found</p>
            )}
          </motion.div>

          {/* Missing Skills */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            whileHover={{ y: -4 }}
            className="bg-surface-container-lowest rounded-[2rem] p-8 shadow-xl hover:shadow-2xl hover:shadow-error/5 transition-all duration-300 border border-error/5"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-error/10 flex items-center justify-center">
                <XCircle className="text-error w-6 h-6" />
              </div>
              <h2 className="font-headline text-2xl font-bold text-on-background">Missing Skills</h2>
            </div>
            {analysis.missing_skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {analysis.missing_skills.map((skill, idx) => (
                  <motion.span
                    key={idx}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.5 + idx * 0.05 }}
                    className="px-4 py-2 bg-error/10 text-error rounded-full text-sm font-semibold border border-error/20"
                  >
                    {skill}
                  </motion.span>
                ))}
              </div>
            ) : (
              <p className="text-on-surface-variant text-sm">All required skills present! 🎉</p>
            )}
          </motion.div>
        </div>

        {/* Suggestions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="bg-surface-container-lowest rounded-[2rem] p-10 shadow-xl mb-12 border border-secondary-container/10 relative overflow-hidden"
        >
          {/* Decorative element */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-secondary-container/10 blur-3xl rounded-full"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-secondary-container/20 flex items-center justify-center">
                <Lightbulb className="text-secondary-container w-7 h-7" />
              </div>
              <h2 className="font-headline text-3xl font-bold text-on-background">Improvement Suggestions</h2>
            </div>
            {analysis.suggestions.length > 0 ? (
              <div className="space-y-4">
                {analysis.suggestions.map((suggestion, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.6 + idx * 0.1 }}
                    className="flex items-start gap-4 p-4 rounded-xl bg-surface-container-low hover:bg-surface-container-lowest transition-colors"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full flash-gradient flex items-center justify-center text-white font-bold text-sm">
                      {idx + 1}
                    </div>
                    <p className="text-on-background leading-relaxed flex-1">{suggestion}</p>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-on-surface-variant">No suggestions - your resume looks great! 🎉</p>
            )}
          </div>
        </motion.div>

        {/* Project Relevance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="bg-surface-container-lowest rounded-[2rem] p-10 shadow-xl mb-12 border border-tertiary-container/10 relative overflow-hidden"
        >
          {/* Decorative element */}
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-tertiary-container/10 blur-3xl rounded-full"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-tertiary-container/20 flex items-center justify-center">
                <Rocket className="text-tertiary-container w-7 h-7" />
              </div>
              <h2 className="font-headline text-3xl font-bold text-on-background">Project Analysis</h2>
            </div>
            
            {projectCheck.has_relevant_projects ? (
              <div className="bg-primary-container/10 border-2 border-primary-container/30 rounded-2xl p-6">
                <div className="flex items-start gap-3 mb-4">
                  <CheckCircle2 className="text-primary w-6 h-6 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-on-background font-bold text-lg mb-2">
                      Relevant projects found!
                    </p>
                    <p className="text-on-surface-variant leading-relaxed mb-4">
                      Your existing projects will be enhanced with job-specific keywords and metrics.
                    </p>
                  </div>
                </div>
                {projectCheck.relevant_projects.length > 0 && (
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wider text-primary mb-3">Projects to enhance:</p>
                    <div className="space-y-2">
                      {projectCheck.relevant_projects.map((project, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: 0.7 + idx * 0.1 }}
                          className="flex items-center gap-3 bg-surface-container-lowest p-3 rounded-xl"
                        >
                          <div className="w-2 h-2 rounded-full bg-primary"></div>
                          <span className="text-on-background font-medium">{project}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-secondary-container/10 border-2 border-secondary-container/30 rounded-2xl p-6">
                <div className="flex items-start gap-3 mb-4">
                  <AlertTriangle className="text-secondary-container w-6 h-6 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-on-background font-bold text-lg mb-2">
                      No relevant projects found
                    </p>
                    <p className="text-on-surface-variant leading-relaxed mb-4">
                      We'll suggest new projects aligned with the job description. You can review and approve them in the next step.
                    </p>
                  </div>
                </div>
                {projectCheck.suggested_projects.length > 0 && (
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wider text-secondary-container mb-3">Suggested projects:</p>
                    <div className="space-y-2">
                      {projectCheck.suggested_projects.map((project, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: 0.7 + idx * 0.1 }}
                          className="flex items-start gap-3 bg-surface-container-lowest p-4 rounded-xl"
                        >
                          <div className="w-2 h-2 rounded-full bg-secondary-container mt-2 flex-shrink-0"></div>
                          <span className="text-on-background leading-relaxed">{project}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Navigation Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <button
            onClick={() => router.push("/")}
            className="flex-1 py-5 px-8 rounded-xl font-bold text-on-background bg-surface-container-low border-2 border-surface-container-high hover:bg-surface-container-lowest transition-all duration-300 flex items-center justify-center gap-2 group"
          >
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
            Back to Home
          </button>
          <button
            onClick={() => router.push("/consent")}
            className="flex-1 py-5 px-8 rounded-xl font-bold text-white flash-gradient hover:opacity-90 transition-all duration-300 shadow-xl shadow-primary/25 active:scale-95 flex items-center justify-center gap-2 group"
          >
            Continue to Review
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </button>
        </motion.div>
      </main>
    </div>
  );
}
