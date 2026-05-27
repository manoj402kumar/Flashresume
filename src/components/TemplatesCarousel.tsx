"use client";

import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, Sparkles, ExternalLink } from "lucide-react";
import { useRef, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const TEMPLATES = [
  {
    id: "classic-a4",
    name: "Classic Professional",
    format: "US Letter",
    badge: "Most Popular",
    badgeColor: "from-[#006859] to-[#12f8d7]",
    description: "Clean, ATS-optimized layout trusted by recruiters worldwide.",
    tags: ["ATS-Friendly", "US Letter", "Clean Layout"],
    accentColor: "#006859",
    image: "/classic-a4.png", // <--- PLACE YOUR IMAGE IN public/classic-a4.png
  },
  {
    id: "modern-letter",
    name: "Modern Executive",
    format: "A4",
    badge: "Editor's Pick",
    badgeColor: "from-violet-600 to-indigo-500",
    description: "Premium design with bold typography for standout applications.",
    tags: ["A4 Format", "Bold Design", "Modern"],
    accentColor: "#7c3aed",
    image: "/modern-letter.png", // <--- PLACE YOUR IMAGE IN public/modern-letter.png
  },
];

// (ResumePreviewCard removed in favor of next/image)

export default function TemplatesCarousel() {
  const router = useRouter();
  const [activeIdx, setActiveIdx] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = useCallback((dir: 1 | -1) => {
    setActiveIdx((prev) => (prev + dir + TEMPLATES.length) % TEMPLATES.length);
    setIsAutoPlaying(false);
    // Resume auto-play after 4s of inactivity
    if (autoRef.current) clearInterval(autoRef.current);
    autoRef.current = setInterval(() => {
      setActiveIdx((p) => (p + 1) % TEMPLATES.length);
    }, 3500);
  }, []);

  useEffect(() => {
    autoRef.current = setInterval(() => {
      setActiveIdx((p) => (p + 1) % TEMPLATES.length);
    }, 3500);
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, []);

  const active = TEMPLATES[activeIdx];

  return (
    <section className="py-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">

        {/* Section Header — matches Use Cases pattern */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <span className="font-sans text-xs font-bold uppercase tracking-widest text-primary mb-3 block">
            Designed to get you hired
          </span>
          <h2 className="font-headline text-4xl md:text-5xl font-bold text-on-background leading-tight">
            The 1% Resumes
          </h2>
        </motion.div>

        {/* Carousel */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="relative max-w-5xl mx-auto flex items-center justify-center overflow-visible"
        >
          {/* Main card layout - centered with wide bounds for peek effect */}
          <div className="relative w-full px-10 sm:px-20 flex items-center justify-center">
            
            {/* Previous button */}
            <button
              onClick={() => go(-1)}
              aria-label="Previous template"
              className="absolute left-0 sm:left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-[#006859] hover:bg-[#005145] active:scale-95 flex items-center justify-center shadow-lg shadow-[#006859]/30 transition-all duration-200"
            >
              <ChevronLeft className="w-5 h-5 text-white font-black" strokeWidth={3} />
            </button>

            {/* Next button */}
            <button
              onClick={() => go(1)}
              aria-label="Next template"
              className="absolute right-0 sm:right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-[#006859] hover:bg-[#005145] active:scale-95 flex items-center justify-center shadow-lg shadow-[#006859]/30 transition-all duration-200"
            >
              <ChevronRight className="w-5 h-5 text-white font-black" strokeWidth={3} />
            </button>

            {/* Preview side (Center Card Size) */}
            <div className="relative w-full max-w-[280px] sm:max-w-[400px] md:max-w-[500px] aspect-[1/1.414] mx-auto z-10">
              {TEMPLATES.map((tmpl, i) => (
                <motion.div
                  key={tmpl.id}
                  initial={false}
                  animate={{
                    opacity: i === activeIdx ? 1 : 0.4,
                    scale: i === activeIdx ? 1 : 0.85,
                    x: i === activeIdx ? "0%" : i < activeIdx ? "-85%" : "85%",
                    zIndex: i === activeIdx ? 20 : 0
                  }}
                  transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                  className="absolute inset-0"
                  style={{ pointerEvents: i === activeIdx ? "auto" : "none" }}
                >
                  {/* Resume card */}
                  <div className="h-full bg-surface-container-lowest rounded-[2rem] border border-surface-container-high shadow-[0_20px_60px_rgba(0,104,89,0.10)] p-4 flex flex-col relative overflow-hidden">
                    {/* Glow halos */}
                    <div
                      className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-[80px] -z-0 pointer-events-none opacity-20"
                      style={{ background: tmpl.accentColor }}
                    />
                    {/* Badge */}
                    <div className="flex justify-between items-start mb-3 relative z-10">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-gradient-to-r ${tmpl.badgeColor} text-white shadow-sm`}>
                        <Sparkles className="w-2.5 h-2.5" />
                        {tmpl.badge}
                      </span>
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest bg-surface-container-low px-2.5 py-1 rounded-full border border-surface-container-high">
                        {tmpl.format}
                      </span>
                    </div>
                    {/* Resume preview image */}
                    <div className="flex-1 relative z-10 w-full h-full rounded-xl overflow-hidden shadow-sm bg-white border border-surface-container-highest">
                      <Image
                        src={tmpl.image}
                        alt={tmpl.name}
                        fill
                        className="object-cover object-top"
                        sizes="(max-width: 1024px) 100vw, 50vw"
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

          </div>
        </motion.div>
      </div>
    </section>
  );
}
