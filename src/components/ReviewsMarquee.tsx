"use client";

import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { motion } from "motion/react";

interface Review {
  rating: number;
  suggestion: string;
  created_at: string;
  users?: { email?: string };
}

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${i < rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`}
        />
      ))}
    </span>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const email = review.users?.email || "";

  let displayEmail: string | null = null;
  if (email) {
    const isInternal =
      email === "flashresume.in@gmail.com" || email.endsWith("@flashresume.in");
    if (isInternal) {
      displayEmail = "s**@gmail.com";
    } else {
      // Standard masking: show first 2 chars + *** + @domain
      displayEmail = email.replace(/^(.{2}).*(@.*)$/, "$1***$2");
    }
  }

  return (
    <div className="shrink-0 w-72 bg-surface-container-low border border-surface-container-highest rounded-2xl px-5 py-4 flex flex-col gap-2 shadow-sm">
      <StarRow rating={review.rating} />
      <p className="text-sm text-on-surface-variant italic leading-relaxed line-clamp-3">
        &ldquo;{review.suggestion}&rdquo;
      </p>
      {displayEmail && (
        <p className="text-xs text-on-surface-variant/60 font-medium mt-1">
          — {displayEmail}
        </p>
      )}
    </div>
  );
}

export default function ReviewsMarquee() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/public-reviews")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setReviews(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || reviews.length === 0) return null;

  // Duplicate for seamless loop
  const loopedReviews = [...reviews, ...reviews, ...reviews];

  const durationSecs = Math.max(25, reviews.length * 4);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="mt-12 relative overflow-hidden"
      aria-label="User reviews marquee"
    >
      {/* Fade edges */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-l from-background to-transparent" />

      <div
        ref={trackRef}
        className="flex gap-4"
        style={{
          animation: `marquee-scroll ${durationSecs}s linear infinite`,
          width: "max-content",
        }}
      >
        {loopedReviews.map((r, i) => (
          <ReviewCard key={i} review={r} />
        ))}
      </div>

      <style>{`
        @keyframes marquee-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(calc(-100% / 3)); }
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }
      `}</style>
    </motion.div>
  );
}
