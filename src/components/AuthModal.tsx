"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, GraduationCap, Loader2, Star, Quote } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const SCRATCH_REVIEW = {
  quote: "I could not find a tool like Flashresume anywhere on the entire internet. It's simply unmatched.",
  author: "Priya S.",
  role: "Final Year B.Tech Student",
  avatar: "PS",
  avatarColor: "from-violet-600 to-purple-400",
};

function ReviewBanner({ review }: { review: typeof SCRATCH_REVIEW }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0e1a17] to-[#111827] px-4 py-4 mt-6 shadow-xl"
    >
      <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#12f8d7]/50 to-transparent" />
      <Quote className="absolute top-3 right-3 w-8 h-8 text-[#12f8d7]/10" />
      <div className="flex gap-0.5 mb-2.5">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
        ))}
      </div>
      <p className="text-[13px] sm:text-sm leading-relaxed text-white/80 font-medium mb-3 pr-4">
        &ldquo;{review.quote}&rdquo;
      </p>
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${review.avatarColor} flex items-center justify-center text-[11px] font-black text-white flex-shrink-0 shadow-md`}>
          {review.avatar}
        </div>
        <div>
          <p className="text-[12px] font-bold text-white leading-tight">{review.author}</p>
          <p className="text-[10px] text-white/40 leading-tight">{review.role}</p>
        </div>
        <div className="ml-auto">
          <span className="text-[9px] font-bold tracking-widest text-[#12f8d7]/60 uppercase">Verified User</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googlePulse, setGooglePulse] = useState(false);
  const googleBtnRef = useRef<HTMLButtonElement>(null);

  if (!isOpen) return null;

  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      setError(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || "Failed to authenticate with Google");
      setLoading(false);
    }
  };

  const handleStudentCTA = () => {
    // Pulse the Google button as a visual cue — they sign in with Google first
    setGooglePulse(true);
    googleBtnRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setGooglePulse(false), 1200);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-surface rounded-3xl w-full max-w-md shadow-2xl overflow-hidden relative border border-surface-container-high"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-surface-container-low hover:bg-surface-container-high rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5 text-on-surface-variant" />
        </button>

        <div className="p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-headline font-bold text-on-background mb-2">
              Welcome to Flashresume
            </h2>
            <p className="text-sm text-on-surface-variant">
              Sign in to access your resumes and downloads.
            </p>
          </div>

          {/* Student CTA */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            onClick={handleStudentCTA}
            className="mb-5 cursor-pointer p-3.5 rounded-2xl bg-gradient-to-r from-tertiary-container/40 to-tertiary/10 border-2 border-tertiary/40 hover:border-tertiary transition-all flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-xl bg-tertiary/20 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-5 h-5 text-tertiary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-on-background">🎓 Student? Get ₹99/mo instead of ₹199</p>
              <p className="text-xs text-tertiary font-semibold">Sign in with Google → Claim student offer</p>
            </div>
            <span className="text-[10px] font-black bg-tertiary text-white px-2 py-1 rounded-full">EXCLUSIVE</span>
          </motion.div>

          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm text-center bg-error/10 text-error">
              {error}
            </div>
          )}

          {/* Google Sign-In — sole auth method */}
          <motion.button
            ref={googleBtnRef}
            id="google-signin-btn"
            onClick={handleGoogleAuth}
            disabled={loading}
            animate={googlePulse ? { scale: [1, 1.04, 1], boxShadow: ["0 0 0px #6750A4", "0 0 18px #6750A4", "0 0 0px #6750A4"] } : {}}
            transition={{ duration: 0.6 }}
            className="w-full bg-surface-container-low border-2 border-primary/40 hover:border-primary text-on-background font-bold py-3.5 rounded-xl hover:bg-surface-container-high transition-colors flex justify-center items-center gap-3 shadow-sm"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </>
            )}
          </motion.button>

          <ReviewBanner review={SCRATCH_REVIEW} />

          <p className="mt-5 text-center text-xs text-on-surface-variant">
            By continuing, you agree to our{" "}
            <a href="/terms" className="text-primary hover:underline font-medium">Terms of Service</a>{" "}
            and{" "}
            <a href="/privacy" className="text-primary hover:underline font-medium">Privacy Policy</a>.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
