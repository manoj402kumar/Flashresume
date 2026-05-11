"use client";

import { motion, useInView, AnimatePresence } from "motion/react";
import { useRef, useState, useEffect } from "react";
import {
  Upload,
  Sparkles,
  FileCheck2,
  ChevronRight,
  Check,
  Zap,
  Target,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

const STEPS = [
  { id: 0, label: "Upload", icon: Upload, color: "text-tertiary" },
  { id: 1, label: "Optimize", icon: Sparkles, color: "text-tertiary" },
  { id: 2, label: "Download", icon: FileCheck2, color: "text-tertiary" },
];

// ─── Step 0: Upload ────────────────────────────────────────────────────────────
function StepUpload({ active }: { active: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.5 }}
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4 sm:p-6"
    >
      <motion.div
        animate={active ? { borderColor: ["#6750A4", "#9c83d4", "#6750A4"] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
        className="w-full max-w-xs border-2 border-dashed border-primary/50 rounded-3xl p-6 sm:p-10 flex flex-col items-center gap-3 bg-primary/5"
      >
        <motion.div
          animate={active ? { y: [0, -8, 0] } : {}}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="w-12 h-12 sm:w-16 sm:h-16 bg-primary/10 rounded-2xl flex items-center justify-center"
        >
          <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
        </motion.div>
        <p className="text-sm font-bold text-on-surface-variant text-center">Drop your resume here</p>
        <p className="text-xs text-on-surface-variant/60 text-center">PDF, DOCX, or paste plain text</p>
      </motion.div>
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.4 }}
            className="flex items-center gap-3 bg-surface-container-low border border-primary/20 rounded-2xl px-4 py-2.5 shadow-lg"
          >
            <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <FileCheck2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-on-background">resume_2024.pdf</p>
              <p className="text-xs text-primary font-medium">Uploaded ✓</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Step 1: AI Processing ─────────────────────────────────────────────────────
const BEFORE_BULLETS = [
  "Responsible for managing projects",
  "Worked with team on web apps",
  "Did various coding tasks",
];
const AFTER_BULLETS = [
  "Led 3 projects → 40% faster delivery",
  "Built React/Node.js apps for 50K+ users",
  "Cut deploy time by 65% via CI/CD",
];

function StepProcessing({ active }: { active: boolean }) {
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (!active) { setRevealed(0); return; }
    const timers = AFTER_BULLETS.map((_, i) =>
      setTimeout(() => setRevealed(i + 1), 800 + i * 700)
    );
    return () => timers.forEach(clearTimeout);
  }, [active]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.5 }}
      className="absolute inset-0 flex gap-2 p-3 sm:gap-3 sm:p-5"
    >
      {/* Before */}
      <div className="flex-1 bg-error/5 border border-error/20 rounded-2xl p-2.5 sm:p-4 flex flex-col gap-2">
        <div className="flex items-center gap-1.5 mb-0.5">
          <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 text-error flex-shrink-0" />
          <span className="text-[9px] sm:text-xs font-black text-error uppercase tracking-widest">Before</span>
        </div>
        {BEFORE_BULLETS.map((b, i) => (
          <motion.div
            key={i}
            animate={active && revealed > i ? { opacity: 0.3, x: -3 } : { opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + i * 0.7, duration: 0.4 }}
            className="flex items-start gap-1.5"
          >
            <span className="mt-1.5 w-1 h-1 rounded-full bg-error/50 flex-shrink-0" />
            <p className="text-[10px] sm:text-xs text-on-surface-variant leading-snug">{b}</p>
          </motion.div>
        ))}
      </div>

      {/* Divider arrow */}
      <div className="flex flex-col items-center justify-center gap-1.5 px-0.5">
        <motion.div
          animate={active ? { scale: [1, 1.3, 1], rotate: [0, 5, -5, 0] } : {}}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="w-6 h-6 sm:w-8 sm:h-8 bg-primary/10 rounded-full flex items-center justify-center"
        >
          <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
        </motion.div>
        <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
      </div>

      {/* After */}
      <div className="flex-1 bg-primary/5 border border-primary/20 rounded-2xl p-2.5 sm:p-4 flex flex-col gap-2">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-primary flex-shrink-0" />
          <span className="text-[9px] sm:text-xs font-black text-primary uppercase tracking-widest">After AI</span>
        </div>
        {AFTER_BULLETS.map((b, i) => (
          <AnimatePresence key={i}>
            {revealed > i && (
              <motion.div
                initial={{ opacity: 0, x: 10, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: 0.35 }}
                className="flex items-start gap-1.5"
              >
                <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-[10px] sm:text-xs text-on-background font-medium leading-snug">{b}</p>
              </motion.div>
            )}
          </AnimatePresence>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Step 2: ATS Result ────────────────────────────────────────────────────────
const KEYWORDS = [
  { word: "React.js", matched: true },
  { word: "CI/CD", matched: true },
  { word: "Node.js", matched: true },
  { word: "Docker", matched: false },
  { word: "REST API", matched: true },
  { word: "Agile", matched: false },
  { word: "TypeScript", matched: true },
  { word: "K8s", matched: false },
];

function StepResult({ active }: { active: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.5 }}
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4 sm:p-6"
    >
      {/* Score + Bar row */}
      <div className="flex items-center gap-4 sm:gap-6 w-full max-w-sm">
        {/* Dial */}
        <motion.div
          initial={{ scale: 0 }}
          animate={active ? { scale: 1 } : { scale: 0 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 120 }}
          className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-full bg-gradient-to-br from-primary to-secondary-container flex items-center justify-center shadow-xl shadow-primary/30"
        >
          <div className="text-center">
            <motion.p
              initial={{ opacity: 0 }}
              animate={active ? { opacity: 1 } : { opacity: 0 }}
              transition={{ delay: 0.6 }}
              className="text-xl sm:text-2xl font-black text-white leading-none"
            >
              89%
            </motion.p>
            <p className="text-[9px] text-white/80 font-bold">ATS Score</p>
          </div>
        </motion.div>

        {/* Bar + label */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span className="text-xs font-bold text-on-background truncate">Shortlist Probability</span>
          </div>
          <div className="w-full h-2.5 bg-surface-container-high rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={active ? { width: "89%" } : { width: 0 }}
              transition={{ delay: 0.8, duration: 1, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, #6750A4, #9c83d4)" }}
            />
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={active ? { opacity: 1 } : { opacity: 0 }}
            transition={{ delay: 1.1 }}
            className="flex items-center gap-1 text-primary text-xs font-bold"
          >
            <TrendingUp className="w-3 h-3" />
            +55 pts — Interview Likely
          </motion.div>
        </div>
      </div>

      {/* Keywords */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
        transition={{ delay: 1.0, duration: 0.5 }}
        className="w-full max-w-sm"
      >
        <p className="text-[10px] font-bold text-on-surface-variant mb-2 uppercase tracking-widest">Keyword Coverage</p>
        <div className="flex flex-wrap gap-1 sm:gap-1.5">
          {KEYWORDS.map((kw, i) => (
            <motion.span
              key={kw.word}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={active ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
              transition={{ delay: 1.1 + i * 0.07 }}
              className={`text-[9px] sm:text-[10px] font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full border ${kw.matched
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-error/10 border-error/20 text-error line-through"
                }`}
            >
              {kw.matched && <CheckCircle2 className="inline w-2 h-2 sm:w-2.5 sm:h-2.5 mr-0.5 mb-0.5" />}
              {kw.word}
            </motion.span>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Section ──────────────────────────────────────────────────────────────
export default function LiveDemoSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, margin: "-100px" });
  const [activeStep, setActiveStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  useEffect(() => {
    if (!inView || !autoPlay) return;
    const durations = [3000, 5000, 5000];
    const timer = setTimeout(() => {
      setActiveStep((s) => (s + 1) % 3);
    }, durations[activeStep]);
    return () => clearTimeout(timer);
  }, [activeStep, inView, autoPlay]);

  useEffect(() => {
    if (inView) { setActiveStep(0); setAutoPlay(true); }
  }, [inView]);

  const handleStepClick = (i: number) => {
    setActiveStep(i);
    setAutoPlay(false);
  };

  return (
    <section ref={ref} className="py-20 sm:py-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-10 sm:mb-16"
        >
          <h2 className="font-headline text-3xl sm:text-4xl md:text-5xl font-bold text-on-background mb-4 leading-tight text-center">
            Three steps. Zero effort.
          </h2>
          <p className="text-on-surface-variant text-base sm:text-lg sm:whitespace-nowrap text-center">
            Eliminate the headache of updating your resume manually everytime for every JD.
          </p>
        </motion.div>

        {/* Minimalistic Centered Layout */}
        <div className="flex flex-col items-center gap-8 max-w-4xl mx-auto">
          {/* Demo Viewport */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative w-full"
          >
            {/* Browser chrome */}
            <div className="bg-surface-container-lowest rounded-[1.5rem] sm:rounded-[2rem] border border-surface-container-high shadow-2xl shadow-primary/10 overflow-hidden">
              {/* Title bar */}
              <div className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-3 sm:py-4 border-b border-surface-container-low bg-surface-container-low/50">
                <div className="w-2.5 h-2.5 rounded-full bg-error/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-secondary-container/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-primary/60" />
                <div className="ml-2 sm:ml-3 flex-1 h-5 sm:h-6 bg-surface-container-high rounded-lg flex items-center px-2 sm:px-3 min-w-0">
                  <span className="text-[9px] sm:text-[10px] text-on-surface-variant font-mono truncate">flashresume.app</span>
                </div>
              </div>

              {/* Content area */}
              <div className="relative h-60 sm:h-72 bg-surface overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary-container/5 pointer-events-none" />
                <AnimatePresence mode="wait">
                  <div key={activeStep} className="absolute inset-0">
                    {activeStep === 0 && <StepUpload active={true} />}
                    {activeStep === 1 && <StepProcessing active={true} />}
                    {activeStep === 2 && <StepResult active={true} />}
                  </div>
                </AnimatePresence>
              </div>

              {/* Status bar */}
              <div className="flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 border-t border-surface-container-low bg-surface-container-low/30">
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-primary flex-shrink-0"
                />
                <span className="text-[10px] sm:text-xs text-on-surface-variant font-mono truncate">
                  {activeStep === 0 && "Waiting for upload..."}
                  {activeStep === 1 && "AI engine processing..."}
                  {activeStep === 2 && "Optimization complete ✓"}
                </span>
              </div>
            </div>


          </motion.div>

          {/* Minimal Step Indicator */}
          <div className="h-8 flex justify-center items-center mt-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className={`text-base sm:text-lg font-bold ${STEPS[activeStep].color}`}
              >
                Step {activeStep + 1}: {STEPS[activeStep].label}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
