"use client";

import { motion } from "motion/react";
import { X, ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import Image from "next/image";

const AFTER_TEMPLATES = [
  {
    id: "classic-a4",
    name: "Template1",
    badge: "Most Popular",
    badgeColor: "from-[#006859] to-[#12f8d7]",
    image: "/classic-a4.png",
  },
  {
    id: "modern-letter",
    name: "Template2",
    badge: "Editor's Pick",
    badgeColor: "from-violet-600 to-indigo-500",
    image: "/modern-letter.png",
  },
];

export default function TemplatesCarousel() {
  const [activeAfter, setActiveAfter] = useState(0);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  const active = AFTER_TEMPLATES[activeAfter];

  return (
    <>
      <section className="py-16 sm:py-24 overflow-hidden relative">
        {/* Subtle background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#006859]/6 blur-[120px] rounded-full" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">

          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-10 sm:mb-16 text-center"
          >
            <span className="font-sans text-xs font-bold uppercase tracking-widest text-primary mb-3 block">
              Designed to get you hired
            </span>
            <h2 className="font-headline text-4xl md:text-5xl font-bold text-on-background leading-tight">
              Top 1% Resumes
            </h2>
            <p className="text-on-surface-variant mt-3 text-base sm:text-lg max-w-xl mx-auto">
              Flashresume makes yours in 60 seconds.
            </p>
          </motion.div>

          {/* Before vs After Layout */}
          <div className="flex flex-col lg:flex-row items-stretch justify-center gap-4 sm:gap-6 lg:gap-0 max-w-5xl mx-auto">

            {/* ── BEFORE card ─────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex flex-col min-w-0"
            >
              {/* Label */}
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="flex items-center gap-1.5 bg-[#7f1d1d]/10 border border-[#7f1d1d]/30 text-[#991b1b] text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full">
                  <X className="w-3 h-3" strokeWidth={3} />
                  Before Flashresume
                </div>
              </div>

              {/* Card */}
              <div
                className="relative flex-1 bg-surface-container-lowest rounded-2xl sm:rounded-[1.75rem] border-2 border-[#7f1d1d]/25 shadow-[0_8px_40px_rgba(127,29,29,0.12)] overflow-hidden cursor-zoom-in group"
                onClick={() => setLightbox({ src: "/before_resume.png", alt: "Before Flashresume" })}
              >
                {/* Noise/red glow overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#7f1d1d]/5 to-transparent pointer-events-none z-10" />

                {/* Pain-point labels */}
                <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
                  {["Cluttered layout", "No ATS structure", "Poor formatting"].map((t) => (
                    <span key={t} className="flex items-center gap-1 bg-[#7f1d1d] text-white text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md backdrop-blur-sm">
                      <X className="w-2.5 h-2.5 flex-shrink-0" strokeWidth={3} />
                      {t}
                    </span>
                  ))}
                </div>

                {/* Zoom hint */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <span className="text-[10px] font-bold text-white bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full">Click to enlarge</span>
                </div>

                {/* Resume image */}
                <div className="relative w-full aspect-[1/1.414]">
                  <Image
                    src="/before_resume.png"
                    alt="Resume before Flashresume"
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 1024px) 100vw, 40vw"
                  />
                  {/* Faded red overlay hint */}
                  <div className="absolute inset-0 bg-[#7f1d1d]/4" />

                  {/* ── REJECTED Stamp ── */}
                  <div
                    className="absolute bottom-5 right-4 pointer-events-none z-30"
                    style={{ transform: "rotate(-18deg)" }}
                  >
                    <div
                      style={{
                        border: "3px solid rgba(127,29,29,0.65)",
                        boxShadow: "inset 0 0 0 1.5px rgba(127,29,29,0.65)",
                        padding: "5px 12px",
                        borderRadius: "5px",
                        mixBlendMode: "multiply",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "'Georgia', 'Times New Roman', serif",
                          fontWeight: 900,
                          fontSize: "clamp(14px, 3.5vw, 22px)",
                          letterSpacing: "0.18em",
                          color: "rgba(127,29,29,0.80)",
                          textTransform: "uppercase",
                          lineHeight: 1,
                          display: "block",
                          mixBlendMode: "multiply",
                          userSelect: "none",
                        }}
                      >
                        REJECTED
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* ── Center Divider / Arrow ────────────────────────────── */}
            <div className="flex lg:flex-col items-center justify-center lg:px-4 xl:px-6 shrink-0 gap-3 lg:gap-4">
              {/* Desktop vertical line — top */}
              <div className="hidden lg:block w-px flex-1 bg-gradient-to-b from-transparent via-surface-container-highest to-transparent" />
              {/* Mobile horizontal line — left */}
              <div className="block lg:hidden h-px flex-1 bg-gradient-to-r from-transparent via-surface-container-highest to-transparent" />

              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flash-gradient flex items-center justify-center shadow-lg shadow-[#006859]/30 shrink-0 rotate-90 lg:rotate-0"
              >
                <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 text-white" strokeWidth={2.5} />
              </motion.div>

              {/* Desktop vertical line — bottom */}
              <div className="hidden lg:block w-px flex-1 bg-gradient-to-b from-transparent via-surface-container-highest to-transparent" />
              {/* Mobile horizontal line — right */}
              <div className="block lg:hidden h-px flex-1 bg-gradient-to-r from-transparent via-surface-container-highest to-transparent" />
            </div>

            {/* ── AFTER card ──────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex flex-col min-w-0"
            >
              {/* Label */}
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="flex items-center gap-1.5 bg-[#006859]/12 border border-[#006859]/30 text-[#006859] text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full">
                  <Sparkles className="w-3 h-3" />
                  After Flashresume
                </div>
              </div>

              {/* Card */}
              <div
                className="relative flex-1 bg-surface-container-lowest rounded-2xl sm:rounded-[1.75rem] border-2 border-[#006859]/25 shadow-[0_8px_40px_rgba(0,104,89,0.12)] overflow-hidden cursor-zoom-in group"
                onClick={() => setLightbox({ src: active.image, alt: `After Flashresume – ${active.name}` })}
              >
                {/* Green glow overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#006859]/4 to-transparent pointer-events-none z-10" />

                {/* Quality labels */}
                <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
                  {["ATS optimized", "Recruiter-ready", "Professional layout"].map((t) => (
                    <span key={t} className="flex items-center gap-1 bg-[#006859]/90 text-white text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm backdrop-blur-sm">
                      <CheckCircle2 className="w-2.5 h-2.5 flex-shrink-0" />
                      {t}
                    </span>
                  ))}
                </div>


                {/* Zoom hint */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <span className="text-[10px] font-bold text-white bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full">Click to enlarge</span>
                </div>

                {/* Resume image */}
                <div className="relative w-full aspect-[1/1.414]">
                  {AFTER_TEMPLATES.map((tmpl, i) => (
                    <motion.div
                      key={tmpl.id}
                      className="absolute inset-0"
                      initial={false}
                      animate={{ opacity: i === activeAfter ? 1 : 0 }}
                      transition={{ duration: 0.4 }}
                    >
                      <Image
                        src={tmpl.image}
                        alt={tmpl.name}
                        fill
                        className="object-cover object-top"
                        sizes="(max-width: 1024px) 100vw, 40vw"
                      />
                    </motion.div>
                  ))}

                  {/* ── ACCEPTED Stamp ── */}
                  <div
                    className="absolute bottom-5 right-4 pointer-events-none z-30"
                    style={{ transform: "rotate(-18deg)" }}
                  >
                    <div
                      style={{
                        border: "3px solid rgba(0,104,89,0.50)",
                        boxShadow: "inset 0 0 0 1.5px rgba(0,104,89,0.50)",
                        padding: "5px 12px",
                        borderRadius: "5px",
                        mixBlendMode: "multiply",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "'Georgia', 'Times New Roman', serif",
                          fontWeight: 900,
                          fontSize: "clamp(14px, 3.5vw, 22px)",
                          letterSpacing: "0.18em",
                          color: "rgba(0,104,89,0.60)",
                          textTransform: "uppercase",
                          lineHeight: 1,
                          display: "block",
                          mixBlendMode: "multiply",
                          userSelect: "none",
                        }}
                      >
                        ACCEPTED
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Template switcher tabs */}
              <div className="flex gap-2 mt-3 px-1">
                {AFTER_TEMPLATES.map((tmpl, i) => (
                  <button
                    key={tmpl.id}
                    onClick={() => setActiveAfter(i)}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-200 border ${i === activeAfter
                      ? "bg-[#006859] text-white border-[#006859] shadow-md shadow-[#006859]/20"
                      : "bg-surface-container-low text-on-surface-variant border-surface-container-high hover:bg-surface-container-high"
                      }`}
                  >
                    {tmpl.name}
                  </button>
                ))}
              </div>
            </motion.div>

          </div>



        </div>
      </section>

      {/* Lightbox */}
      {lightbox && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative max-w-xl w-full max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={lightbox.src}
              alt={lightbox.alt}
              width={800}
              height={1131}
              className="w-full h-auto object-top"
              style={{ maxHeight: "90vh", objectFit: "contain" }}
            />
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-3 right-3 w-9 h-9 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </>
  );
}
