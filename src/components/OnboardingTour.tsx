"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Sparkles,
  MousePointerClick,
  UploadCloud,
  ClipboardList,
  Zap,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

// ─── Step definitions ─────────────────────────────────────────────────────────
interface TourStep {
  targetId: string | string[] | null;  // string[] → union bounding box
  icon: React.ReactNode;
  badge: string;
  title: string;
  description: React.ReactNode;
  tip?: string;
}

const STEPS: TourStep[] = [
  {
    targetId: null,
    icon: <Sparkles className="w-6 h-6 text-[#12f8d7]" />,
    badge: "Welcome",
    title: "Build your perfect resume in 60 seconds",
    description:
      "Flashresume is India's #1 AI-powered resume builder. Let us walk you through the three simple steps to get your recruiter-ready resume — right now.",
  },
  {
    targetId: "tour-step-1-choose-option",
    icon: <MousePointerClick className="w-6 h-6 text-[#12f8d7]" />,
    badge: "Step 1 of 3",
    title: "Choose your mode",
    description: (
      <div className="flex flex-col gap-1.5 mt-1 text-[13px] tracking-tight">
        <div className="whitespace-nowrap"><span className="text-white/80 font-medium">1. JD Optimize:</span> for a specific job description</div>
        <div className="whitespace-nowrap"><span className="text-white/80 font-medium">2. Self Edit:</span> to edit manually</div>
        <div className="whitespace-nowrap"><span className="text-white/80 font-medium">3. First Resume:</span> If you don't have old resume.</div>
      </div>
    ),
    tip: "💡 Most users pick JD Optimize: it tailors your resume to beat ATS filters.",
  },
  {
    // Both upload area + JD area highlighted together as one rectangle
    targetId: ["tour-step-2-upload-resume", "tour-step-3-jd"],
    icon: <UploadCloud className="w-6 h-6 text-[#12f8d7]" />,
    badge: "Step 2 of 3",
    title: "Fill in what's required",
    description:
      "Based on the mode you picked, upload your resume and/or paste the job description. The form shows only what's needed for your chosen option.",
    tip: "💡 JD Optimize needs both your resume and the job description for best results.",
  },
  {
    targetId: "tour-step-cta",
    icon: <Zap className="w-6 h-6 text-[#12f8d7]" />,
    badge: "Step 3 of 3",
    title: "Hit the button — you're done!",
    description:
      "Click the action button below. Our AI will analyze your inputs and return a fully optimized, ATS-ready resume in seconds.",
  },
  {
    targetId: null,
    icon: <CheckCircle2 className="w-6 h-6 text-[#12f8d7]" />,
    badge: "You're all set!",
    title: "You're ready to get hired 🎉",
    description:
      "Choose your mode, fill in your details, and let Flashresume do the rest. Good luck!",
  },
];

// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = "flashresume_tour_done";
const PAD = 8;   // padding around highlighted element
const DESKTOP_CARD_W = 360;  // card width on desktop (fits in right margin)
const MOBILE_BOTTOM = 14;   // px from bottom on mobile

interface HighlightBox {
  top: number;
  left: number;
  width: number;
  height: number;
  boxShadow: string;
}

// card is either centred, right-anchored (desktop), or bottom-sheet (mobile)
type CardLayout =
  | { mode: "center" }
  | { mode: "right"; top: number; left: number }
  | { mode: "bottom-sheet" };

// ─── Component ────────────────────────────────────────────────────────────────
export default function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [highlight, setHighlight] = useState<HighlightBox | null>(null);
  const [cardLayout, setCardLayout] = useState<CardLayout>({ mode: "center" });

  // ── show once ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => setActive(true), 900);
      return () => clearTimeout(t);
    }
  }, []);

  // ── compute spotlight + card position ────────────────────────────────────
  const compute = useCallback(() => {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const isMobile = vw < 768;

    const current = STEPS[step];
    if (!current?.targetId) {
      setHighlight({
        top: vh / 2, left: vw / 2, width: 0, height: 0,
        boxShadow: "0 0 0 0px rgba(18,248,215,0), 0 0 0 0px rgba(18,248,215,0), 0 0 0 20000px rgba(0,0,0,0.80)"
      });
      setCardLayout({ mode: "center" });
      return;
    }

    // Resolve IDs — may be a single string or an array
    const ids = Array.isArray(current.targetId) ? current.targetId : [current.targetId];
    const firstEl = document.getElementById(ids[0]);
    if (!firstEl) {
      setHighlight({
        top: vh / 2, left: vw / 2, width: 0, height: 0,
        boxShadow: "0 0 0 0px rgba(18,248,215,0), 0 0 0 0px rgba(18,248,215,0), 0 0 0 20000px rgba(0,0,0,0.80)"
      });
      setCardLayout({ mode: "center" });
      return;
    }

    // Scroll first element into view, then measure after scroll settles
    firstEl.scrollIntoView({ behavior: "smooth", block: "center" });

    setTimeout(() => {
      // Compute union bounding box across all target elements
      const rects = ids
        .map(id => document.getElementById(id)?.getBoundingClientRect())
        .filter((r): r is DOMRect => !!r);

      if (rects.length === 0) {
        setHighlight({
          top: vh / 2, left: vw / 2, width: 0, height: 0,
          boxShadow: "0 0 0 0px rgba(18,248,215,0), 0 0 0 0px rgba(18,248,215,0), 0 0 0 20000px rgba(0,0,0,0.80)"
        });
        setCardLayout({ mode: "center" });
        return;
      }

      const uTop = Math.min(...rects.map(r => r.top));
      const uBottom = Math.max(...rects.map(r => r.bottom));
      const uLeft = Math.min(...rects.map(r => r.left));
      const uRight = Math.max(...rects.map(r => r.right));

      // ── Spotlight + Overlay coordinates ─────────────────────────────────
      const sTop = uTop - PAD;
      const sBottom = uBottom + PAD;
      const sLeft = uLeft - PAD;
      const sRight = uRight + PAD;

      setHighlight({
        top: sTop,
        left: sLeft,
        width: sRight - sLeft,
        height: sBottom - sTop,
        boxShadow: "0 0 0 2.5px rgba(18,248,215,1), 0 0 22px 4px rgba(18,248,215,0.28), 0 0 0 20000px rgba(0,0,0,0.80)"
      });

      // ── card layout ──────────────────────────────────────────────────────
      if (isMobile) {
        setCardLayout({ mode: "bottom-sheet" });
      } else {
        const CARD_H_EST = 360;
        const CARD_GAP = 16;
        const elCenterY = (uTop + uBottom) / 2;
        const idealTop = elCenterY - CARD_H_EST / 2;
        const top = Math.max(12, Math.min(idealTop, vh - CARD_H_EST - 12));
        const left = Math.min(sRight + CARD_GAP, vw - DESKTOP_CARD_W - 12);
        setCardLayout({ mode: "right", top, left });
      }
    }, 300);
  }, [step]);

  useEffect(() => { if (active) compute(); }, [step, active, compute]);

  useEffect(() => {
    if (!active) return;
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => { window.removeEventListener("resize", compute); window.removeEventListener("scroll", compute, true); };
  }, [active, compute]);

  // ── nav ───────────────────────────────────────────────────────────────────
  const handleNext = () => step < STEPS.length - 1 ? setStep(s => s + 1) : finish();
  const handlePrev = () => { if (step > 0) setStep(s => s - 1); };
  const finish = () => { localStorage.setItem(STORAGE_KEY, "true"); setActive(false); };

  if (!active) return null;

  const current = STEPS[step];
  const isCentred = cardLayout.mode === "center";
  const DARK = "rgba(0,0,0,0.80)";

  return (
    <AnimatePresence>
      {active && (
        <>
          {/* ── Spotlight + Overlay ──────────────────────────────────────── */}
          <AnimatePresence>
            {highlight && (
              <motion.div key="highlight-ring"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, ...highlight }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="fixed pointer-events-none z-[9002]"
                style={{ borderRadius: 0 }}
              />
            )}
          </AnimatePresence>

          {/* ── Click blocker ────────────────────────────────────────────── */}
          {active && <div className="fixed inset-0 z-[9001]" onClick={e => e.stopPropagation()} />}

          {/* ── Tour card ────────────────────────────────────────────────── */}
          <AnimatePresence>
            {isCentred && (
              <motion.div
                key="centered-wrapper"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9010] flex items-center justify-center pointer-events-none px-4"
              >
                <motion.div layoutId="tour-card-flyer" className="pointer-events-auto w-full max-w-[400px]">
                  <TourCard current={current} step={step} total={STEPS.length}
                    isFirst={step === 0} isLast={step === STEPS.length - 1}
                    onNext={handleNext} onPrev={handlePrev} onSkip={finish} />
                </motion.div>
              </motion.div>
            )}

            {!isCentred && (
              <motion.div
                key="anchored-wrapper"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9010] pointer-events-none"
              >
                <motion.div
                  layoutId="tour-card-flyer"
                  className="pointer-events-auto absolute"
                  initial={false}
                  animate={
                    cardLayout.mode === "right"
                      ? { top: cardLayout.top, left: cardLayout.left, width: DESKTOP_CARD_W }
                      : { top: "auto", bottom: MOBILE_BOTTOM, left: 12, right: 12, width: "auto" }
                  }
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <TourCard current={current} step={step} total={STEPS.length}
                    isFirst={step === 0} isLast={step === STEPS.length - 1}
                    onNext={handleNext} onPrev={handlePrev} onSkip={finish}
                    compact={cardLayout.mode === "bottom-sheet"} />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Card UI ──────────────────────────────────────────────────────────────────
interface TourCardProps {
  current: TourStep;
  step: number;
  total: number;
  isFirst: boolean;
  isLast: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  compact?: boolean;   // mobile: tighter layout
}

function TourCard({ current, step, total, isFirst, isLast, onNext, onPrev, onSkip, compact }: TourCardProps) {
  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-white/10"
      style={{
        background: "linear-gradient(145deg, #0f1c1a 0%, #0a1410 100%)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.60), 0 0 0 1px rgba(18,248,215,0.08)",
      }}
    >
      {/* Teal top stripe */}
      <div className="h-[3px] w-full bg-gradient-to-r from-[#006859] via-[#12f8d7] to-[#006859]" />

      {/* ✕ dismiss */}
      <button onClick={onSkip} aria-label="Skip tour"
        className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/8 hover:bg-white/16
                   flex items-center justify-center transition-colors group z-10">
        <X className="w-3.5 h-3.5 text-white/50 group-hover:text-white transition-colors" />
      </button>

      <div className={compact ? "p-4" : "p-5"}>

        {/* Icon + badge */}
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-xl bg-[#006859]/20 border border-[#12f8d7]/20
                          flex items-center justify-center flex-shrink-0">
            {current.icon}
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest text-[#12f8d7]/80
                           bg-[#12f8d7]/10 px-2.5 py-0.5 rounded-full border border-[#12f8d7]/15">
            {current.badge}
          </span>
        </div>

        {/* Title */}
        <h3 className={`text-white font-extrabold leading-snug mb-1.5 ${compact ? "text-base" : "text-[17px]"}`}>
          {current.title}
        </h3>

        {/* Description */}
        <div className={`text-white/58 leading-relaxed mb-3 ${compact ? "text-xs" : "text-sm"}`}>
          {current.description}
        </div>

        {/* Tip */}
        {current.tip && (
          <div className="bg-[#006859]/15 border border-[#006859]/25 rounded-xl px-3 py-2 mb-3.5">
            <p className="text-[#12f8d7]/85 text-[11px] font-semibold leading-relaxed">
              {current.tip}
            </p>
          </div>
        )}

        {/* Progress pills */}
        <div className="flex items-center gap-1.5 mb-3.5">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? "w-5 bg-[#12f8d7]"
                : i < step ? "w-1.5 bg-[#12f8d7]/40"
                  : "w-1.5 bg-white/15"
                }`}
            />
          ))}
        </div>

        {/* Nav buttons */}
        <div className="flex items-center gap-2">
          {!isFirst && (
            <button onClick={onPrev}
              className="flex items-center gap-1 px-3 py-2.5 rounded-xl bg-white/8 hover:bg-white/16
                         text-white/70 hover:text-white text-sm font-bold transition-all active:scale-95">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}
          <button onClick={onNext}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl
                       font-bold text-sm text-white transition-all active:scale-[0.97]"
            style={{
              background: "linear-gradient(135deg,#006859 0%,#12f8d7 100%)",
              boxShadow: "0 6px 18px rgba(18,248,215,0.20)",
            }}>
            {isLast
              ? <><CheckCircle2 className="w-4 h-4" /> Let's Go!</>
              : <>{step === 0 ? "Start Tour" : "Next"} <ChevronRight className="w-4 h-4" /></>
            }
          </button>
        </div>

        {/* Skip */}
        {!isLast && (
          <button onClick={onSkip}
            className="w-full mt-2 text-center text-[11px] text-white/30 hover:text-white/55 transition-colors font-medium">
            Skip tour
          </button>
        )}
      </div>
    </div>
  );
}
