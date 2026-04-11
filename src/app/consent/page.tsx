"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { 
  CheckCircle2, 
  Lightbulb, 
  Rocket, 
  ArrowLeft, 
  ArrowRight,
  Shield,
  Sparkles,
  Info,
  CheckCheck,
  AlertCircle
} from "lucide-react";
import type { AnalyzeResponse, ProjectCheckResponse } from "@/lib/api";

export default function ConsentPage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [projectCheck, setProjectCheck] = useState<ProjectCheckResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Checkbox states
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  useEffect(() => {
    // Load data from localStorage
    const analysisData = localStorage.getItem("analysis");
    const projectCheckData = localStorage.getItem("project_check");

    if (!analysisData || !projectCheckData) {
      router.push("/");
      return;
    }

    const parsedAnalysis = JSON.parse(analysisData);
    const parsedProjectCheck = JSON.parse(projectCheckData);

    setAnalysis(parsedAnalysis);
    setProjectCheck(parsedProjectCheck);

    // Pre-select all suggestions by default
    setSelectedSuggestions(parsedAnalysis.suggestions);

    // Pre-select suggested projects if any
    if (parsedProjectCheck.suggested_projects) {
      setSelectedProjects(parsedProjectCheck.suggested_projects);
    }

    setLoading(false);
  }, [router]);

  const toggleSuggestion = (suggestion: string) => {
    setSelectedSuggestions((prev) =>
      prev.includes(suggestion)
        ? prev.filter((s) => s !== suggestion)
        : [...prev, suggestion]
    );
  };

  const toggleProject = (project: string) => {
    setSelectedProjects((prev) =>
      prev.includes(project)
        ? prev.filter((p) => p !== project)
        : [...prev, project]
    );
  };

  const handleGenerate = () => {
    // Combine all approved suggestions
    const approvedSuggestions = [
      ...selectedSuggestions,
      ...selectedProjects,
    ];

    // Save to localStorage
    localStorage.setItem("approved_suggestions", JSON.stringify(approvedSuggestions));

    // Navigate to generate page
    router.push("/generate");
  };

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
          <p className="text-on-surface-variant font-medium">Loading suggestions...</p>
        </div>
      </div>
    );
  }

  const totalSelected = selectedSuggestions.length + selectedProjects.length;
  const hasSelections = totalSelected > 0;

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
            <div className="inline-flex items-center gap-2 bg-secondary-container/20 px-4 py-2 rounded-full mb-4">
              <Shield className="w-4 h-4 text-secondary-container" />
              <span className="text-xs font-bold uppercase tracking-widest text-secondary-container">Your Control</span>
            </div>
            <h1 className="font-headline text-4xl md:text-6xl font-bold text-on-background mb-4">
              Review & Approve
            </h1>
            <p className="text-xl text-on-surface-variant max-w-2xl mx-auto">
              Select which improvements you want to apply to your resume
            </p>
          </motion.div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-12 md:py-20">
        {/* Important Notice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-tertiary-container/10 border-2 border-tertiary-container/30 rounded-[2rem] p-6 mb-12 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-tertiary-container/20 blur-3xl rounded-full"></div>
          <div className="relative z-10 flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-tertiary-container/20 flex items-center justify-center">
              <Info className="w-6 h-6 text-tertiary-container" />
            </div>
            <div>
              <p className="font-bold text-on-background mb-2">Your Privacy Matters</p>
              <p className="text-on-surface-variant leading-relaxed">
                Only approved items will be added to your resume. Nothing will be changed without your explicit consent.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Suggestions Section */}
        {analysis.suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-surface-container-lowest rounded-[2rem] p-10 shadow-xl mb-12 border border-secondary-container/10 relative overflow-hidden"
          >
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-secondary-container/10 blur-3xl rounded-full"></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-secondary-container/20 flex items-center justify-center">
                  <Lightbulb className="text-secondary-container w-7 h-7" />
                </div>
                <div className="flex-1">
                  <h2 className="font-headline text-3xl font-bold text-on-background">Improvement Suggestions</h2>
                  <p className="text-sm text-on-surface-variant mt-1">
                    Enhance your resume with relevant keywords and improvements
                  </p>
                </div>
              </div>
              
              <div className="space-y-3">
                {analysis.suggestions.map((suggestion, idx) => {
                  const isSelected = selectedSuggestions.includes(suggestion);
                  return (
                    <motion.label
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: 0.4 + idx * 0.05 }}
                      className={`flex items-start gap-4 p-5 rounded-xl cursor-pointer transition-all duration-300 group ${
                        isSelected
                          ? "bg-primary-container/10 border-2 border-primary-container/40 shadow-sm"
                          : "bg-surface-container-low border-2 border-transparent hover:border-primary-container/20 hover:bg-surface-container-lowest"
                      }`}
                    >
                      <div className="relative flex-shrink-0 mt-0.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSuggestion(suggestion)}
                          className="w-6 h-6 text-primary rounded-lg border-2 border-surface-container-high focus:ring-2 focus:ring-primary-container transition-all cursor-pointer"
                        />
                        <AnimatePresence>
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center"
                            >
                              <CheckCheck className="w-3 h-3 text-white" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <span className={`flex-1 leading-relaxed transition-colors ${
                        isSelected ? "text-on-background font-medium" : "text-on-surface-variant"
                      }`}>
                        {suggestion}
                      </span>
                    </motion.label>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* Relevant Projects Info (No consent needed) */}
        {projectCheck.has_relevant_projects && projectCheck.relevant_projects.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-surface-container-lowest rounded-[2rem] p-10 shadow-xl mb-12 border border-primary/10 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary-container/10 blur-3xl rounded-full"></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-primary-container/20 flex items-center justify-center">
                  <CheckCircle2 className="text-primary w-7 h-7" />
                </div>
                <div className="flex-1">
                  <h2 className="font-headline text-3xl font-bold text-on-background">Projects to Enhance</h2>
                  <p className="text-sm text-on-surface-variant mt-1">
                    These will be automatically optimized with job-specific keywords
                  </p>
                </div>
              </div>
              
              <div className="space-y-3">
                {projectCheck.relevant_projects.map((project, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.5 + idx * 0.05 }}
                    className="flex items-center gap-4 p-5 bg-primary-container/10 border-2 border-primary-container/30 rounded-xl"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-on-background font-medium flex-1">{project}</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary-container/20 px-3 py-1 rounded-full">
                      Auto-approved
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Suggested New Projects (Requires consent) */}
        {!projectCheck.has_relevant_projects && projectCheck.suggested_projects.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-surface-container-lowest rounded-[2rem] p-10 shadow-xl mb-12 border border-tertiary-container/10 relative overflow-hidden"
          >
            <div className="absolute bottom-0 right-0 w-40 h-40 bg-tertiary-container/10 blur-3xl rounded-full"></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-tertiary-container/20 flex items-center justify-center">
                  <Rocket className="text-tertiary-container w-7 h-7" />
                </div>
                <div className="flex-1">
                  <h2 className="font-headline text-3xl font-bold text-on-background">Suggested New Projects</h2>
                  <p className="text-sm text-on-surface-variant mt-1">
                    Project ideas aligned with the job description
                  </p>
                </div>
              </div>
              
              <div className="space-y-3">
                {projectCheck.suggested_projects.map((project, idx) => {
                  const isSelected = selectedProjects.includes(project);
                  return (
                    <motion.label
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: 0.5 + idx * 0.05 }}
                      className={`flex items-start gap-4 p-5 rounded-xl cursor-pointer transition-all duration-300 group ${
                        isSelected
                          ? "bg-tertiary-container/10 border-2 border-tertiary-container/40 shadow-sm"
                          : "bg-surface-container-low border-2 border-transparent hover:border-tertiary-container/20 hover:bg-surface-container-lowest"
                      }`}
                    >
                      <div className="relative flex-shrink-0 mt-0.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleProject(project)}
                          className="w-6 h-6 text-tertiary-container rounded-lg border-2 border-surface-container-high focus:ring-2 focus:ring-tertiary-container transition-all cursor-pointer"
                        />
                        <AnimatePresence>
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-tertiary-container rounded-full flex items-center justify-center"
                            >
                              <CheckCheck className="w-3 h-3 text-white" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <span className={`flex-1 leading-relaxed transition-colors ${
                        isSelected ? "text-on-background font-medium" : "text-on-surface-variant"
                      }`}>
                        {project}
                      </span>
                    </motion.label>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* Selection Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className={`rounded-[2rem] p-6 mb-12 border-2 transition-all duration-300 ${
            hasSelections
              ? "bg-primary-container/10 border-primary-container/30"
              : "bg-surface-container-low border-surface-container-high"
          }`}
        >
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
              hasSelections ? "bg-primary-container/20" : "bg-surface-container-high"
            }`}>
              {hasSelections ? (
                <CheckCircle2 className="w-6 h-6 text-primary" />
              ) : (
                <AlertCircle className="w-6 h-6 text-on-surface-variant" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-bold text-on-background">
                {hasSelections ? (
                  <>
                    <span className="text-primary">{totalSelected}</span> improvement{totalSelected !== 1 ? 's' : ''} selected
                  </>
                ) : (
                  "No improvements selected"
                )}
              </p>
              <p className="text-sm text-on-surface-variant mt-1">
                {hasSelections
                  ? "Your resume will be enhanced with the selected improvements"
                  : "Your resume will be optimized with existing content only"
                }
              </p>
            </div>
          </div>
        </motion.div>

        {/* Navigation Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <button
            onClick={() => router.push("/analyze")}
            className="flex-1 py-5 px-8 rounded-xl font-bold text-on-background bg-surface-container-low border-2 border-surface-container-high hover:bg-surface-container-lowest transition-all duration-300 flex items-center justify-center gap-2 group"
          >
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
            Back to Analysis
          </button>
          <button
            onClick={handleGenerate}
            className="flex-1 py-5 px-8 rounded-xl font-bold text-white flash-gradient hover:opacity-90 transition-all duration-300 shadow-xl shadow-primary/25 active:scale-95 flex items-center justify-center gap-2 group"
          >
            Generate My Resume
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </button>
        </motion.div>

        {/* Info Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mt-8 text-center"
        >
          <div className="inline-flex items-center gap-2 text-on-surface-variant">
            <Sparkles className="w-4 h-4" />
            <p className="text-sm">
              Tip: You can uncheck any suggestion you don't want to include
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
