"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  Zap, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  Wand2,
  FileText,
  Brain,
  Rocket
} from "lucide-react";
import { generateResume } from "@/lib/api";

export default function GeneratePage() {
  const router = useRouter();
  const [status, setStatus] = useState("Preparing your resume...");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);

  useEffect(() => {
    if (progress === 100 || error) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [progress, error]);

  const steps = [
    { icon: FileText, label: "Analyzing content", color: "text-primary" },
    { icon: Brain, label: "AI optimization", color: "text-secondary-container" },
    { icon: Wand2, label: "Applying improvements", color: "text-tertiary-container" },
    { icon: Rocket, label: "Finalizing resume", color: "text-primary" },
  ];

  useEffect(() => {
    const generate = async () => {
      try {
        // Load all required data from localStorage
        const resumeText = localStorage.getItem("resume_text");
        const jobDescription = localStorage.getItem("job_description");
        const analysisData = localStorage.getItem("analysis");
        const approvedProjectData = localStorage.getItem("approved_project");

        // Validation — job_description is optional (no-JD mode), only resumeText and analysis are required
        if (!resumeText || analysisData === null) {
          router.push("/");
          return;
        }

        const analysis = JSON.parse(analysisData);
        const approvedProject = approvedProjectData 
          ? JSON.parse(approvedProjectData) 
          : null;
        const preferredModel = localStorage.getItem("preferred_model") || undefined;

        // Step 1: Analyzing content
        setCurrentStep(0);
        setProgress(10);
        setStatus("Analyzing your resume content...");
        await new Promise((resolve) => setTimeout(resolve, 800));
        
        setProgress(25);
        setStatus("Sending to AI engine...");
        await new Promise((resolve) => setTimeout(resolve, 400));

        // Step 2: AI optimization
        setCurrentStep(1);
        setProgress(35);
        setStatus("AI is optimizing your resume...");
        
        // Call the generation API
        const noAiChanges = localStorage.getItem("no_ai_changes") === "true";
        const generatedResume = await generateResume({
          resume_text: resumeText,
          job_description: jobDescription || "",
          ats_score_before: analysis.ats_score,
          approved_project: approvedProject ? `${approvedProject.title} | Tech Stack: ${approvedProject.tech_stack} | Description: ${approvedProject.description}` : undefined,
          missing_keywords: analysis.missing_skills || [],
          preferred_model: preferredModel,
          no_ai_changes: noAiChanges,
        });

        // Step 3: Applying improvements
        setCurrentStep(2);
        setProgress(70);
        setStatus("Applying approved improvements...");
        await new Promise((resolve) => setTimeout(resolve, 600));

        setProgress(85);
        setStatus("Enhancing keywords and formatting...");
        await new Promise((resolve) => setTimeout(resolve, 400));

        // Step 4: Finalizing
        setCurrentStep(3);
        setProgress(95);
        setStatus("Validating resume structure...");

        setProgress(100);
        setStatus("Done! Your resume is ready!");

        // Navigate to result page
        await new Promise((resolve) => setTimeout(resolve, 800));
        if ((generatedResume as any).session_id) {
          router.push(`/result?session_id=${(generatedResume as any).session_id}`);
        } else {
          // Fallback if session_id is missing for some reason
          localStorage.setItem("generated_resume", JSON.stringify(generatedResume));
          router.push("/result");
        }
      } catch (err: any) {
        setError(err.message || "Failed to generate resume. Please try again.");
        setStatus("");
        setProgress(0);
      }
    };

    generate();
  }, [router]);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4 font-sans">
      <div className="max-w-2xl w-full">
        <AnimatePresence mode="wait">
          {!error ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5 }}
            >
              {/* Main Loading Card */}
              <div className="bg-surface-container-lowest rounded-[3rem] shadow-2xl shadow-primary/10 p-12 border border-primary/5 relative overflow-hidden">
                {/* Decorative blur orbs */}
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary-container/20 blur-3xl rounded-full animate-pulse"></div>
                <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-secondary-container/10 blur-3xl rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
                
                <div className="relative z-10">
                  {/* Animated Icon */}
                  <div className="flex justify-center mb-8">
                    <div className="relative">
                      {/* Outer spinning ring */}
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        className="w-32 h-32 rounded-full border-4 border-transparent border-t-primary border-r-primary"
                      />
                      {/* Middle spinning ring */}
                      <motion.div
                        animate={{ rotate: -360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-2 rounded-full border-4 border-transparent border-b-secondary-container border-l-secondary-container"
                      />
                      {/* Center icon */}
                      <motion.div
                        animate={{ 
                          scale: [1, 1.2, 1],
                          rotate: [0, 180, 360]
                        }}
                        transition={{ 
                          duration: 2, 
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <Sparkles className="w-12 h-12 text-primary" />
                      </motion.div>
                    </div>
                  </div>

                  {/* Status Text */}
                  <motion.div
                    key={status}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-center mb-8"
                  >
                    <h2 className="font-headline text-3xl md:text-4xl font-bold text-on-background mb-3">
                      Generating Your Resume
                    </h2>
                    <p className="text-lg text-on-surface-variant flex items-center justify-center gap-2">
                      <Zap className="w-5 h-5 text-primary animate-pulse" />
                      {status}
                    </p>
                  </motion.div>

                  {/* Progress Bar */}
                  <div className="mb-6">
                    <div className="w-full h-4 bg-surface-container-high rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="h-full flash-gradient rounded-full relative"
                      >
                        {/* Shimmer effect */}
                        <motion.div
                          animate={{ x: ['-100%', '200%'] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                        />
                      </motion.div>
                    </div>
                    <div className="flex justify-between items-center mt-3">
                      <p className="text-sm font-bold text-primary">{progress}% complete</p>
                      <p className="text-xs text-on-surface-variant">
                        {timeLeft > 0 ? `Estimated time remaining: ${timeLeft}s` : "Wrapping up..."}
                      </p>
                    </div>
                  </div>

                  {/* Step Indicators */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                    {steps.map((step, idx) => {
                      const StepIcon = step.icon;
                      const isActive = idx === currentStep;
                      const isComplete = idx < currentStep;
                      
                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: idx * 0.1 }}
                          className={`relative p-4 rounded-2xl border-2 transition-all duration-500 ${
                            isActive
                              ? "bg-primary-container/10 border-primary-container/40 shadow-lg"
                              : isComplete
                              ? "bg-primary-container/5 border-primary/20"
                              : "bg-surface-container-low border-surface-container-high"
                          }`}
                        >
                          {/* Completion badge */}
                          <AnimatePresence>
                            {isComplete && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg"
                              >
                                <CheckCircle2 className="w-4 h-4 text-white" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                          
                          <div className="flex flex-col items-center text-center">
                            <motion.div
                              animate={isActive ? { 
                                scale: [1, 1.2, 1],
                                rotate: [0, 10, -10, 0]
                              } : {}}
                              transition={{ duration: 1, repeat: isActive ? Infinity : 0 }}
                              className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${
                                isActive ? "bg-primary-container/20" : "bg-surface-container-high"
                              }`}
                            >
                              <StepIcon className={`w-5 h-5 ${
                                isActive ? step.color : isComplete ? "text-primary" : "text-on-surface-variant"
                              }`} />
                            </motion.div>
                            <p className={`text-xs font-medium ${
                              isActive ? "text-on-background" : isComplete ? "text-primary" : "text-on-surface-variant"
                            }`}>
                              {step.label}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Info Box */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                    className="mt-8 p-5 bg-tertiary-container/10 border border-tertiary-container/20 rounded-2xl"
                  >
                    <div className="flex items-start gap-3">
                      <Brain className="w-5 h-5 text-tertiary-container flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-on-surface-variant leading-relaxed">
                        Our AI is analyzing your resume and applying optimizations to maximize your ATS score.
                      </p>
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5 }}
            >
              {/* Error Card */}
              <div className="bg-surface-container-lowest rounded-[3rem] shadow-2xl shadow-error/10 p-12 border border-error/10 relative overflow-hidden">
                {/* Decorative blur orb */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-error/10 blur-3xl rounded-full"></div>
                
                <div className="relative z-10 text-center">
                  {/* Error Icon */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", duration: 0.6 }}
                    className="flex justify-center mb-6"
                  >
                    <div className="w-24 h-24 rounded-full bg-error/10 flex items-center justify-center">
                      <AlertCircle className="w-12 h-12 text-error" />
                    </div>
                  </motion.div>

                  <h2 className="font-headline text-3xl md:text-4xl font-bold text-on-background mb-4">
                    Generation Failed
                  </h2>
                  <p className="text-lg text-on-surface-variant mb-8 max-w-md mx-auto">
                    {error}
                  </p>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                    <button
                      onClick={() => window.location.reload()}
                      className="flex-1 py-4 px-6 rounded-xl font-bold text-white flash-gradient hover:opacity-90 transition-all duration-300 shadow-xl shadow-primary/25 active:scale-95 flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-5 h-5" />
                      Try Again
                    </button>
                    <button
                      onClick={() => router.push("/")}
                      className="flex-1 py-4 px-6 rounded-xl font-bold text-on-background bg-surface-container-low border-2 border-surface-container-high hover:bg-surface-container-lowest transition-all duration-300 flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="w-5 h-5" />
                      Back to Preview
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
