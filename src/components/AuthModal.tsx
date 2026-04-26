"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, GraduationCap, Mail, Lock, Building, Hash, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type AuthMode = "login" | "signup" | "student_signup";

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [collegeName, setCollegeName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onSuccess?.();
        onClose();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;

        // If student flow, update user metadata or table directly
        if (mode === "student_signup" && data.user) {
          const { error: profileError } = await supabase
            .from("users")
            .update({
              college_name: collegeName,
              roll_number: rollNumber,
              is_student: true,
              student_verified_at: new Date().toISOString(),
            })
            .eq("id", data.user.id);
            
          if (profileError) {
             console.error("Failed to update student profile:", profileError);
             // We won't throw here to avoid blocking auth, but log it.
          }
        }
        
        // Supabase requires email verification by default, so we inform the user
        setError("Check your email for the confirmation link!");
        // We do not close the modal immediately so they see the message.
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
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
              {mode === "login" ? "Welcome back" : mode === "student_signup" ? "🎓 Student Access" : "Create an account"}
            </h2>
            <p className="text-sm text-on-surface-variant">
              {mode === "login"
                ? "Enter your details to access your resumes."
                : mode === "student_signup"
                ? "Sign up with your college details to unlock ₹79/month pricing."
                : "Join Flashresume to optimize your career."}
            </p>
          </div>

          {/* FIX #4: Prominent student CTA visible on login AND signup */}
          {mode !== "student_signup" && (
            <motion.div
              whileHover={{ scale: 1.01 }}
              onClick={() => setMode("student_signup")}
              className="mb-5 cursor-pointer p-3.5 rounded-2xl bg-gradient-to-r from-tertiary-container/40 to-tertiary/10 border-2 border-tertiary/40 hover:border-tertiary transition-all flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-xl bg-tertiary/20 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-5 h-5 text-tertiary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-on-background">🎓 Student? Get ₹79/mo instead of ₹149</p>
                <p className="text-xs text-tertiary font-semibold">Sign up with college details → Claim offer</p>
              </div>
              <span className="text-[10px] font-black bg-tertiary text-white px-2 py-1 rounded-full">EXCLUSIVE</span>
            </motion.div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant/50" />
                <input
                  type="email"
                  required
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant/50" />
                <input
                  type="password"
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                />
              </div>

              <AnimatePresence>
                {mode === "student_signup" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 overflow-hidden"
                  >
                    <div className="relative">
                      <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant/50" />
                      <input
                        type="text"
                        required
                        placeholder="College Name"
                        value={collegeName}
                        onChange={(e) => setCollegeName(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                      />
                    </div>
                    <div className="relative">
                      <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant/50" />
                      <input
                        type="text"
                        required
                        placeholder="Roll Number / Enrollment ID"
                        value={rollNumber}
                        onChange={(e) => setRollNumber(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {error && (
              <div className={`p-3 rounded-lg text-sm text-center ${error.includes("Check your email") ? "bg-green-500/10 text-green-600" : "bg-error/10 text-error"}`}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex justify-center items-center"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : mode === "login" ? (
                "Log in"
              ) : (
                "Sign up"
              )}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-sm text-on-surface-variant">
            <div className="w-full h-px bg-surface-container-high"></div>
            <span className="px-4 bg-surface">OR</span>
            <div className="w-full h-px bg-surface-container-high"></div>
          </div>

          <div className="mt-6">
            <button
              onClick={handleGoogleAuth}
              disabled={loading}
              className="w-full bg-surface-container-low border border-surface-container-high text-on-background font-bold py-3.5 rounded-xl hover:bg-surface-container-high transition-colors flex justify-center items-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </button>
          </div>

          {/* Student CTA only shown on plain signup — replaced by header banner above */}

          <div className="mt-8 text-center text-sm text-on-surface-variant">
            {mode === "login" ? (
              <p>
                Don't have an account?{" "}
                <button onClick={() => setMode("signup")} className="text-primary font-bold hover:underline">
                  Sign up
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{" "}
                <button onClick={() => setMode("login")} className="text-primary font-bold hover:underline">
                  Log in
                </button>
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
