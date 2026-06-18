"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";
import { generateResume } from "@/lib/api";

const TIPS = [
  "Tailoring skills to each job description can boost your ATS score by up to 40%.",
  "Quantified achievements (e.g., 'Reduced load time by 30%') stand out to recruiters.",
  "Using the exact keywords from the job posting helps you pass automated filters.",
  "A clean, one-page resume is preferred by 95% of hiring managers.",
  "Action verbs like 'Developed', 'Implemented', and 'Optimized' carry more weight.",
];

export default function GeneratePage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [tipIndex, setTipIndex] = useState(0);
  const [tipVisible, setTipVisible] = useState(true);
  const tipTimer = useRef<NodeJS.Timeout | null>(null);

  // Countdown
  useEffect(() => {
    if (progress === 100 || error) return;
    const t = setInterval(() => setTimeLeft((p) => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [progress, error]);

  // Tips rotation
  useEffect(() => {
    tipTimer.current = setInterval(() => {
      setTipVisible(false);
      setTimeout(() => { setTipIndex((p) => (p + 1) % TIPS.length); setTipVisible(true); }, 350);
    }, 5000);
    return () => { if (tipTimer.current) clearInterval(tipTimer.current); };
  }, []);

  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const generate = async () => {
      try {
        const resumeText = localStorage.getItem("resume_text");
        const jobDescription = localStorage.getItem("job_description");
        const analysisData = localStorage.getItem("analysis");
        const approvedProjectData = localStorage.getItem("approved_project");
        const extractedLinksData = localStorage.getItem("extracted_links");

        if (!resumeText || analysisData === null) { router.push("/"); return; }

        const analysis = JSON.parse(analysisData);
        const approvedProject = approvedProjectData ? JSON.parse(approvedProjectData) : null;
        const preferredModel = localStorage.getItem("preferred_model") || undefined;
        // Parse extracted links — null-safe, falls back to undefined if not present
        const extractedLinks = extractedLinksData ? JSON.parse(extractedLinksData) : undefined;

        setProgress(10);
        await new Promise((r) => setTimeout(r, 800));
        setProgress(25);
        await new Promise((r) => setTimeout(r, 400));
        setProgress(35);

        const noAiChanges = localStorage.getItem("no_ai_changes") === "true";
        const generatedResume = await generateResume({
          resume_text: resumeText,
          job_description: jobDescription || "",
          ats_score_before: analysis.ats_score,
          approved_project: approvedProject
            ? `${approvedProject.title} | Tech Stack: ${approvedProject.tech_stack} | Description: ${approvedProject.description}`
            : undefined,
          missing_keywords: analysis.updated_missing_skills || analysis.missing_skills || [],
          selected_projects: analysis.selected_projects || [],
          preferred_model: preferredModel,
          no_ai_changes: noAiChanges,
          extracted_links: extractedLinks ?? null,
        });

        setProgress(70);
        await new Promise((r) => setTimeout(r, 600));
        setProgress(85);
        await new Promise((r) => setTimeout(r, 400));
        setProgress(100);
        await new Promise((r) => setTimeout(r, 800));

        if ((generatedResume as any).session_id) {
          router.push(`/result?session_id=${(generatedResume as any).session_id}`);
        } else {
          localStorage.setItem("generated_resume", JSON.stringify(generatedResume));
          router.push("/result");
        }
      } catch (err: any) {
        setError(err.message || "Failed to generate resume. Please try again.");
        setProgress(0);
      }
    };
    generate();
  }, [router]);

  const RADIUS = 46;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const strokeDashoffset = CIRCUMFERENCE * (1 - timeLeft / 60);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10 font-sans"
      style={{ background: "linear-gradient(160deg, #030706 0%, #08110f 50%, #0d1d1a 100%)" }}
    >
      {/* Skill Constellation Particle Network */}
      <ParticleNetwork progress={progress} />

      <div className="relative z-10 w-full max-w-[340px]">
        <AnimatePresence mode="wait">
          {!error ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              {/* ── WHITE PAPER CARD ── */}
              <div
                className="relative overflow-hidden"
                style={{
                  background: "#ffffff",
                  borderRadius: "12px",
                  boxShadow:
                    "0 2px 4px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.12), 0 32px 64px rgba(0,0,0,0.2)",
                  /* subtle paper edge shadow */
                  border: "1px solid rgba(0,0,0,0.06)",
                }}
              >
                {/* ── SCANNER BEAM ── */}
                <motion.div
                  animate={{ y: ["0%", "100%", "0%"] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute left-0 right-0 pointer-events-none"
                  style={{ top: 0, height: "38%", zIndex: 20 }}
                >
                  {/* Glowing line at top of beam */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: "3px",
                      background: "linear-gradient(90deg, transparent 0%, #12f8d7 20%, #006859 50%, #12f8d7 80%, transparent 100%)",
                      boxShadow: "0 0 12px 4px rgba(18,248,215,0.6), 0 0 32px 8px rgba(0,104,89,0.3)",
                    }}
                  />
                  {/* Gradient wash below line */}
                  <div
                    style={{
                      position: "absolute",
                      top: "3px",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: "linear-gradient(180deg, rgba(18,248,215,0.06) 0%, transparent 100%)",
                    }}
                  />
                </motion.div>

                {/* Faint horizontal ruled lines (paper texture) */}
                <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
                  {Array.from({ length: 18 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        position: "absolute",
                        left: 24,
                        right: 24,
                        top: `${60 + i * 26}px`,
                        height: "1px",
                        background: "rgba(0,0,0,0.05)",
                      }}
                    />
                  ))}
                  {/* Left margin line */}
                  <div
                    style={{
                      position: "absolute",
                      left: 52,
                      top: 52,
                      bottom: 52,
                      width: "1px",
                      background: "rgba(220,100,100,0.18)",
                    }}
                  />
                </div>

                {/* ── CARD CONTENT (above scanner z-index) ── */}
                <div className="relative px-7 pt-9 pb-8" style={{ zIndex: 30 }}>
                  {/* Brand label */}
                  <p
                    className="text-center text-[10px] font-bold tracking-[0.18em] uppercase mb-1"
                    style={{ color: "#006859" }}
                  >
                    FlashResume.IN
                  </p>

                  {/* Headline */}
                  <h1
                    className="text-center font-bold mb-1 leading-snug"
                    style={{ fontSize: "1.2rem", color: "#1a1a1a" }}
                  >
                    Your resume is getting
                  </h1>

                  {/* Countdown Ring */}
                  <div
                    className="relative mx-auto flex items-center justify-center my-5"
                    style={{ width: 116, height: 116 }}
                  >
                    <svg
                      width="116"
                      height="116"
                      className="absolute inset-0"
                      style={{ transform: "rotate(-90deg)" }}
                    >
                      <circle cx="58" cy="58" r={RADIUS} fill="none" stroke="#e8f5f3" strokeWidth="6" />
                      <motion.circle
                        cx="58" cy="58" r={RADIUS}
                        fill="none"
                        stroke="url(#scanGrad)"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={CIRCUMFERENCE}
                        animate={{ strokeDashoffset }}
                        transition={{ duration: 1, ease: "linear" }}
                      />
                      <defs>
                        <linearGradient id="scanGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#006859" />
                          <stop offset="100%" stopColor="#12f8d7" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div
                      className="relative flex flex-col items-center justify-center rounded-full"
                      style={{
                        width: 86,
                        height: 86,
                        background: "#f7fffe",
                        border: "2px solid #e0f5f0",
                      }}
                    >
                      <motion.span
                        key={timeLeft}
                        initial={{ scale: 0.75, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.25 }}
                        className="font-bold tabular-nums"
                        style={{ fontSize: "2.4rem", lineHeight: 1, color: "#006859" }}
                      >
                        {timeLeft}
                      </motion.span>
                      <span
                        className="text-[9px] font-semibold tracking-widest uppercase"
                        style={{ color: "#0a9e83", marginTop: 1 }}
                      >
                        seconds
                      </span>
                    </div>
                  </div>

                  {/* Sub-tagline */}
                  <h2
                    className="text-center font-semibold mb-5"
                    style={{ fontSize: "1.05rem", color: "#2c2f30" }}
                  >
                    cooked… grab a coffee ☕
                  </h2>

                  {/* Divider */}
                  <div style={{ height: 1, background: "#e5e7e7", marginBottom: 16 }} />

                  {/* Progress bar */}
                  <div className="mb-4">
                    <div
                      className="w-full rounded-full overflow-hidden"
                      style={{ height: 5, background: "#e8f5f3" }}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="h-full rounded-full relative"
                        style={{ background: "linear-gradient(90deg, #006859, #12f8d7)" }}
                      >
                        <motion.div
                          animate={{ x: ["-100%", "200%"] }}
                          transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
                          className="absolute inset-0"
                          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)" }}
                        />
                      </motion.div>
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-[11px] font-semibold" style={{ color: "#006859" }}>
                        {progress}% complete
                      </span>
                      <span className="text-[11px]" style={{ color: "#9aa0a0" }}>
                        {progress < 100 ? "Scanning…" : "Almost done!"}
                      </span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: "#e5e7e7", marginBottom: 14 }} />

                  {/* Tips */}
                  <div style={{ minHeight: 68 }} className="flex flex-col items-center justify-center">
                    <p
                      className="text-[9px] font-bold tracking-[0.16em] uppercase text-center mb-1.5"
                      style={{ color: "#006859" }}
                    >
                      💡 Did you know?
                    </p>
                    <AnimatePresence mode="wait">
                      {tipVisible && (
                        <motion.p
                          key={tipIndex}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.32 }}
                          className="text-center text-xs leading-relaxed"
                          style={{ color: "#595c5d" }}
                        >
                          {TIPS[tipIndex]}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Tip dots */}
                  <div className="flex justify-center gap-1.5 mt-3">
                    {TIPS.map((_, i) => (
                      <div
                        key={i}
                        className="rounded-full transition-all duration-300"
                        style={{
                          width: i === tipIndex ? 14 : 5,
                          height: 5,
                          background: i === tipIndex ? "#006859" : "#d0dede",
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom footnote */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="text-center text-[11px] mt-4"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                Powered by FlashResume.in · Do not close this tab
              </motion.p>
            </motion.div>
          ) : (
            /* ── ERROR CARD ── */
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5 }}
            >
              <div
                className="p-10 text-center"
                style={{
                  background: "#fff",
                  borderRadius: 12,
                  boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
                  border: "1px solid rgba(179,27,37,0.15)",
                }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", duration: 0.6 }}
                  className="flex justify-center mb-5"
                >
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(179,27,37,0.08)" }}
                  >
                    <AlertCircle className="w-10 h-10" style={{ color: "#b31b25" }} />
                  </div>
                </motion.div>
                <h2 className="text-2xl font-bold mb-3" style={{ color: "#1a1a1a" }}>
                  Generation Failed
                </h2>
                <p className="text-sm mb-7 leading-relaxed" style={{ color: "#595c5d" }}>
                  {error}
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="w-full py-3.5 px-6 rounded-xl font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all"
                    style={{ background: "linear-gradient(135deg, #006859, #12f8d7)" }}
                  >
                    <RefreshCw className="w-4 h-4" /> Try Again
                  </button>
                  <button
                    onClick={() => router.push("/")}
                    className="w-full py-3.5 px-6 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-80 active:scale-95 transition-all"
                    style={{ background: "#f5f6f7", color: "#2c2f30", border: "1px solid #e0e2e3" }}
                  >
                    <ArrowLeft className="w-4 h-4" /> Back to Home
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ParticleNetwork({ progress }: { progress: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(progress);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;

      constructor() {
        this.x = Math.random() * canvas!.width;
        this.y = Math.random() * canvas!.height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.radius = Math.random() * 1.5 + 1.0; // Slightly larger base radius for visibility
      }

      update() {
        const intensity = progressRef.current / 100;
        const centerX = canvas!.width / 2;
        const centerY = canvas!.height / 2;
        
        const dx = centerX - this.x;
        const dy = centerY - this.y;
        
        // Scale the pull: gentle drift initially, strong pull at 85%, massive vacuum at 100%
        let pullFactor = Math.pow(intensity, 3) * 0.00002;
        if (intensity >= 0.99) {
          pullFactor = 0.0015; // Massive vacuum effect
        } else if (intensity >= 0.85) {
          pullFactor = 0.00015; // Noticeable acceleration
        }
        
        this.vx += dx * pullFactor;
        this.vy += dy * pullFactor;

        // Higher friction to keep motion smooth and slow
        this.vx *= 0.98;
        this.vy *= 0.98;

        // Gentle random walk
        this.vx += (Math.random() - 0.5) * 0.04;
        this.vy += (Math.random() - 0.5) * 0.04;

        // Tighter speed limit normally, uncapped for the final vacuum merge
        let maxSpeed = 0.6 + intensity * 1.0;
        if (intensity >= 0.99) maxSpeed = 30; // Very fast merge
        else if (intensity >= 0.85) maxSpeed = 6;
        
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > maxSpeed) {
          this.vx = (this.vx / speed) * maxSpeed;
          this.vy = (this.vy / speed) * maxSpeed;
        }

        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0) this.x = canvas!.width;
        if (this.x > canvas!.width) this.x = 0;
        if (this.y < 0) this.y = canvas!.height;
        if (this.y > canvas!.height) this.y = 0;
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(18, 248, 215, 0.9)";
        ctx.fill();
      }
    }

    let particles: Particle[] = [];

    const initParticles = () => {
      particles = [];
      // Higher density for mobile screens (8000 vs 12000), minimum 50 particles
      const density = window.innerWidth < 768 ? 8000 : 12000;
      const count = Math.max(50, Math.floor((canvas!.width * canvas!.height) / density));
      for (let i = 0; i < count; i++) {
        particles.push(new Particle());
      }
    };

    const draw = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);

      const intensity = progressRef.current / 100;
      // Lines reach further and are more opaque
      const connectionDistance = 90 + intensity * 80; 

      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();

        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < connectionDistance) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            
            // Increased base opacity for better visibility
            const maxOpacity = 0.3 + (intensity * 0.5); 
            const opacity = maxOpacity * (1 - distance / connectionDistance);
            
            ctx.strokeStyle = `rgba(18, 248, 215, ${opacity})`;
            ctx.lineWidth = 0.8 + intensity * 1.2;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    window.addEventListener("resize", resize);
    resize();
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
