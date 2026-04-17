"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Briefcase,
  FolderGit2,
  CheckCircle2,
  Loader2
} from "lucide-react";
import ModelSelector, { DEFAULT_MODEL_SELECTION, type ModelSelection } from "@/components/ModelSelector";

export default function PreviewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [noJdMode, setNoJdMode] = useState(false);
  const [modelSelection, setModelSelection] = useState<ModelSelection>(DEFAULT_MODEL_SELECTION);

  useEffect(() => {
    const resumeText = localStorage.getItem("resume_text");
    const analysis = localStorage.getItem("analysis");

    if (!resumeText || !analysis) {
      router.push("/");
      return;
    }

    setNoJdMode(localStorage.getItem("no_jd_mode") === "true");

    const savedModel = localStorage.getItem("preferred_model");
    if (savedModel) {
      const providerPrefixes: [string, ModelSelection["provider"]][] = [
        ["mistral-", "mistral"], ["open-mistral-", "mistral"],
        ["gemini-", "gemini"], ["gemma-", "gemini"],
        ["llama-3.3-70b", "cerebras"], ["qwen-3-", "cerebras"], ["llama3.1-", "cerebras"],
        ["llama-", "groq"], ["llama3-", "groq"], ["qwen-", "groq"],
      ];
      const provider = providerPrefixes.find(([p]) => savedModel.startsWith(p))?.[1] ?? "mistral";
      setModelSelection({ provider, model: savedModel });
    }
  }, [router]);

  const handleGenerate = () => {
    setLoading(true);
    router.push("/generate");
  };

  const handleBack = () => {
    if (noJdMode) {
      router.push("/");
    } else {
      router.push("/analyze");
    }
  };

  return (
    <div className="min-h-screen bg-surface font-sans py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="font-headline text-4xl md:text-5xl font-bold text-on-background mb-4">
            Preview Changes
          </h1>
          <p className="text-lg text-on-surface-variant">
            Our AI will enhance these sections of your resume
          </p>
        </motion.div>

        {/* Info Banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-primary/20 to-primary-container/20 rounded-[2rem] p-8 mb-12 relative overflow-hidden"
        >
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary-container/30 blur-3xl rounded-full"></div>
          <div className="relative z-10 flex items-start gap-4">
            <Sparkles className="w-8 h-8 text-primary flex-shrink-0 mt-1" />
            <div>
              <h2 className="font-headline text-2xl font-bold text-on-background mb-3">
                What Our AI Will Do
              </h2>
              <ul className="space-y-2 text-on-surface-variant">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Enhance weak bullet points in Work Experience with action verbs and metrics</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>{noJdMode ? "Strengthen project bullets with technical clarity and action verbs" : "Optimize Projects section with JD-relevant keywords and technical details"}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Keep your good content as-is (only improve what needs improvement)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Maintain exactly 2 high-quality projects for optimal resume length</span>
                </li>
                {!noJdMode && (
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>Naturally integrate missing keywords from job description</span>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Sections to be Enhanced */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Work Experience */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-surface-container-lowest rounded-[2rem] p-8 shadow-xl"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-tertiary-container/20 flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-tertiary-container" />
              </div>
              <h3 className="font-headline text-2xl font-bold text-on-background">
                Work Experience
              </h3>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-primary-container/10 rounded-xl border border-primary-container/20">
                <p className="text-sm text-on-surface-variant mb-2 font-semibold">
                  What we'll enhance:
                </p>
                <ul className="space-y-2 text-sm text-on-surface-variant">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>Add action verbs (Built, Developed, Implemented)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>Include authentic metrics (15+ CRUD operations, 3 APIs)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>Mention specific technologies used</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>Show scope and impact of your work</span>
                  </li>
                </ul>
              </div>
              <div className="p-4 bg-surface-container-low rounded-xl">
                <p className="text-xs text-on-surface-variant">
                  <strong>Note:</strong> Good bullet points will be kept as-is. Only weak/generic content will be enhanced.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Projects */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-surface-container-lowest rounded-[2rem] p-8 shadow-xl"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-primary-container/20 flex items-center justify-center">
                <FolderGit2 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-headline text-2xl font-bold text-on-background">
                Projects
              </h3>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-primary-container/10 rounded-xl border border-primary-container/20">
                <p className="text-sm text-on-surface-variant mb-2 font-semibold">
                  What we'll enhance:
                </p>
                <ul className="space-y-2 text-sm text-on-surface-variant">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>Keep exactly 2 most relevant projects</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>Add missing JD keywords naturally</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>Include technical complexity details</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>Show features and functionality built</span>
                  </li>
                </ul>
              </div>
              <div className="p-4 bg-surface-container-low rounded-xl">
                <p className="text-xs text-on-surface-variant">
                  <strong>Note:</strong> If you approved a suggested project, it will be added. Less relevant projects will be removed.
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Algorithm Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-tertiary-container/10 border border-tertiary-container/20 rounded-2xl p-6 mb-8"
        >
          <h4 className="font-bold text-on-background mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-tertiary-container" />
            Our Algorithm's Core Principle
          </h4>
          <p className="text-sm text-on-surface-variant leading-relaxed mb-3">
            <strong>"If original is good, keep it. Only enhance what needs enhancement."</strong>
          </p>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            We preserve your authentic experience and only improve weak/generic content. The goal is to help you get shortlisted in ATS while ensuring you can confidently discuss everything in your interview.
          </p>
        </motion.div>

        {/* Model Selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="mb-8"
        >
          <ModelSelector
            value={modelSelection}
            onChange={(sel) => {
              setModelSelection(sel);
              localStorage.setItem("preferred_model", sel.model);
            }}
            label="Select AI Model for Resume Generation"
          />
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <button
            onClick={handleBack}
            disabled={loading}
            className="px-8 py-4 rounded-full font-bold text-on-background bg-surface-container-low border-2 border-surface-container-high hover:bg-surface-container-lowest transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <ArrowLeft className="w-5 h-5" />
            {noJdMode ? "Back to Home" : "Back to Analysis"}
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="flash-gradient text-white text-lg font-bold px-12 py-4 rounded-full flex items-center justify-center gap-3 hover:opacity-90 transition-all shadow-xl shadow-primary/25 active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                Generate My Resume
                <ArrowRight className="w-6 h-6" />
              </>
            )}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
