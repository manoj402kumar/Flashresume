"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, GraduationCap, Mail, Lock, Building, Hash,
  Loader2, Download, CheckCircle2, Crown, ArrowRight, Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import StudentVerificationModal from "./StudentVerificationModal";

declare global {
  interface Window { Razorpay: any; }
}

interface DownloadGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: () => void;
  /** Pre-selected plan from homepage — skips plan step if provided */
  initialPlan?: "pay_per_use" | "regular" | "student" | null;
}

type Step = "auth" | "plan" | "processing" | "student_upgrade";
type AuthMode = "login" | "signup" | "student_signup";

const PLANS = [
  {
    id: "pay_per_use",
    name: "Pay Per Use",
    price: 29,
    priceDisplay: "₹29",
    period: "per use",
    description: "30 credits (3 resume downloads)",
    icon: <Download className="w-5 h-5" />,
    badge: null as string | null,
    borderClass: "border-surface-container-high",
    features: ["30 Credits", "LaTeX PDF Quality", "ATS Score Report"],
  },
  {
    id: "regular",
    name: "Regular Plan",
    price: 199,
    priceDisplay: "₹199",
    period: "60 days",
    description: "300 credits for 60 days",
    icon: <Crown className="w-5 h-5 text-amber-400" />,
    badge: "BEST VALUE",
    borderClass: "border-primary",
    features: ["300 Credits", "60-Day Access", "Priority Processing", "Resume History"],
  },
];

export default function DownloadGateModal({
  isOpen,
  onClose,
  onPaymentSuccess,
  initialPlan = null,
}: DownloadGateModalProps) {
  const [step, setStep] = useState<Step>("auth");
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [collegeName, setCollegeName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStudent, setIsStudent] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>(initialPlan || "pay_per_use");
  const [studentPlanVisible, setStudentPlanVisible] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);

  // ── On open: check session and jump to correct step ──────────────────────
  useEffect(() => {
    if (!isOpen) return;

    // Reset transient state
    setError(null);
    setEmail("");
    setPassword("");
    setCollegeName("");
    setRollNumber("");
    setAuthMode("login");
    setSelectedPlan(initialPlan || "pay_per_use");
    setStudentPlanVisible(false);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        const studentStatus = await loadUserProfile(session.user.id);

        if (initialPlan === "student" && !studentStatus) {
          setStep("student_upgrade");
        } else {
          setStep("plan");
        }
      } else {
        setStep("auth");
      }
    });
  }, [isOpen, initialPlan]);

  // Keep user in sync during the session
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string) => {
    const { data } = await supabase
      .from("users")
      .select("is_student, credits_balance")
      .eq("id", userId)
      .single();

    if (data) {
      if (data?.is_student) {
        setIsStudent(true);
        setStudentPlanVisible(true);
      }
      setCredits(data.credits_balance);
    }

    // Check for upsell
    const { count } = await supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("plan_type", "pay_per_use")
      .eq("status", "success");

    if (count && count >= 2) {
      setShowUpsell(true);
    }

    return !!data?.is_student;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (authMode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) {
          setUser(data.user);
          const studentStatus = await loadUserProfile(data.user.id);
          if (selectedPlan === "student" && !studentStatus) {
            setStep("student_upgrade");
          } else {
            setStep("plan");
          }
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${window.location.pathname}${window.location.search}`
          }
        });
        if (error) throw error;
        
        if (data.user?.identities?.length === 0) {
          setError("An account with this email already exists. Try logging in instead.");
          setLoading(false);
          return;
        }
        
        if (data.user) {
          if (!data.session) {
            setError("Account created! Please check your email to verify your account before paying.");
            setLoading(false);
            return;
          }

          if (authMode === "student_signup") {
            await supabase.from("users").update({
              college_name: collegeName,
              roll_number: rollNumber,
              is_student: true,
              student_verified_at: new Date().toISOString(),
            }).eq("id", data.user.id);
            setIsStudent(true);
            setStudentPlanVisible(true);
            setSelectedPlan("student");
          }
          setUser(data.user);
          setStep("plan");
        }
      }
    } catch (err: any) {
      const msg: string = err.message || "";
      if (msg.includes("User already registered")) {
        setError("An account with this email already exists. Try logging in instead.");
      } else {
        setError(msg || "Authentication failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleProceedToPayment = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    // Verify session with the server (clears ghost sessions from localStorage)
    const { data: { user: serverUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !serverUser) {
      await supabase.auth.signOut();
      setUser(null);
      setError("Session expired or invalid. Please log in again.");
      setStep("auth");
      setLoading(false);
      return;
    }

    setStep("processing");

    const planDetails =
      selectedPlan === "student" ? { amount: 99, plan_type: "student" } :
        selectedPlan === "regular" ? { amount: 199, plan_type: "regular" } :
          { amount: 29, plan_type: "pay_per_use" };

    if (planDetails.plan_type === "student") {
      const { data: userData } = await supabase.from("users").select("student_verified").eq("id", serverUser.id).single();
      if (!userData?.student_verified) {
        setShowVerificationModal(true);
        setLoading(false);
        setStep("plan");
        return;
      }
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const orderRes = await fetch(`${apiUrl}/api/payments/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: planDetails.amount, plan_type: planDetails.plan_type, user_id: user.id, email: user.email }),
      });
      if (!orderRes.ok) throw new Error("Failed to create payment order.");
      const orderData = await orderRes.json();

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_placeholder",
        amount: orderData.amount,
        currency: "INR",
        name: "Flashresume",
        description: `${planDetails.plan_type} — AI Resume Download`,
        order_id: orderData.razorpay_order_id,
        prefill: { email: user.email },
        theme: { color: "#6750A4" },
        handler: async (response: any) => {
          const verifyRes = await fetch(`${apiUrl}/api/payments/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              user_id: user.id,
              plan_type: planDetails.plan_type,
              amount: planDetails.amount,
              session_id: new URLSearchParams(window.location.search).get("session_id") || undefined
            }),
          });
          if (!verifyRes.ok) throw new Error("Payment verification failed.");
          onPaymentSuccess();
          onClose();
        },
        modal: {
          ondismiss: () => { setStep("plan"); setLoading(false); },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Payment failed. Please try again.");
      setStep("plan");
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Step indicator: only show if we went through auth step
  const showSteps = step !== "processing";
  const authDone = step === "plan";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-surface rounded-3xl w-full max-w-md shadow-2xl overflow-hidden relative border border-surface-container-high max-h-[92vh] overflow-y-auto"
      >
        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-surface-container-low hover:bg-surface-container-high rounded-full transition-colors z-10">
          <X className="w-5 h-5 text-on-surface-variant" />
        </button>

        {/* Header */}
        <div className="px-8 pt-8 pb-4 border-b border-surface-container-low">
          {showSteps && (
            <div className="flex items-center gap-2 mb-3">
              {(["auth", "plan"] as Step[]).map((s, idx) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step === s ? "bg-primary text-white" :
                      authDone && s === "auth" ? "bg-primary/20 text-primary" :
                        "bg-surface-container-low text-on-surface-variant"
                    }`}>
                    {authDone && s === "auth" ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                  </div>
                  {idx === 0 && <div className="h-px w-10 bg-surface-container-high" />}
                </div>
              ))}
            </div>
          )}
          <h2 className="text-xl font-headline font-bold text-on-background">
            {step === "auth" ? "Sign in to download" : step === "processing" ? "Processing..." : "Choose your plan"}
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">
            {step === "auth" ? "Create an account or log in to continue." :
              step === "processing" ? "Setting up your secure payment..." :
                "One payment, your optimized PDF — instantly."}
          </p>
        </div>

        <div className="p-8">
          <AnimatePresence mode="wait">

            {/* ── AUTH STEP ──────────────────────────────────── */}
            {step === "auth" && (
              <motion.div key="auth" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">

                {/* Student CTA Banner — prominent, top of auth */}
                {authMode !== "student_signup" && (
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    onClick={() => { setAuthMode("student_signup"); setError(null); }}
                    className="cursor-pointer p-4 rounded-2xl bg-gradient-to-r from-tertiary-container/40 to-tertiary/10 border-2 border-tertiary/40 hover:border-tertiary transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-tertiary/20 flex items-center justify-center flex-shrink-0">
                        <GraduationCap className="w-5 h-5 text-tertiary" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-on-background">👉 🎓 Are you a student? Get a special offer</p>
                        <p className="text-xs text-tertiary font-semibold">Sign up with your college details → Claim Offer</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-tertiary ml-auto flex-shrink-0" />
                    </div>
                  </motion.div>
                )}

                {/* Student signup header */}
                {authMode === "student_signup" && (
                  <div className="p-3 rounded-xl bg-tertiary/10 border border-tertiary/30 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-tertiary" />
                    <p className="text-xs font-bold text-tertiary">Student signup — you'll get ₹99/60 days pricing!</p>
                  </div>
                )}

                {/* Google */}
                <button onClick={handleGoogleAuth} disabled={loading}
                  className="w-full bg-surface-container-low border border-surface-container-high text-on-background font-bold py-3 rounded-xl hover:bg-surface-container-high transition-colors flex justify-center items-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continue with Google
                </button>

                <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                  <div className="flex-1 h-px bg-surface-container-high" />
                  <span>or email</span>
                  <div className="flex-1 h-px bg-surface-container-high" />
                </div>

                <form onSubmit={handleAuth} className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                    <input type="email" required placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm" />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                    <input type="password" required placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm" />
                  </div>

                  <AnimatePresence>
                    {authMode === "student_signup" && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
                        <div className="relative">
                          <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                          <input type="text" required placeholder="College Name" value={collegeName} onChange={e => setCollegeName(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm" />
                        </div>
                        <div className="relative">
                          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                          <input type="text" required placeholder="Roll Number / Enrollment ID" value={rollNumber} onChange={e => setRollNumber(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {error && <p className="text-xs text-error bg-error/10 px-3 py-2 rounded-lg">{error}</p>}

                  <button type="submit" disabled={loading}
                    className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex justify-center items-center gap-2">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : authMode === "login" ? "Log in" : "Sign up"}
                  </button>
                </form>

                <p className="text-center text-xs text-on-surface-variant">
                  {authMode === "login" ? "No account? " : "Have an account? "}
                  <button onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setError(null); }}
                    className="text-primary font-bold hover:underline">
                    {authMode === "login" ? "Sign up free" : "Log in"}
                  </button>
                  {authMode === "signup" && (
                    <> · <button onClick={() => { setAuthMode("student_signup"); setError(null); }} className="text-tertiary font-bold hover:underline">Student?</button></>
                  )}
                </p>
              </motion.div>
            )}

            {/* ── PLAN STEP ─────────────────────────────────── */}
            {step === "plan" && (
              <motion.div key="plan" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">

                {/* Logged-in greeting — FIX #5: no hardcoded names */}
                {user && (
                  <p className="text-xs text-on-surface-variant text-center">
                    Logged in as <span className="font-bold text-primary">{user.email}</span>
                  </p>
                )}

                {/* Credits Message */}
                {user && credits !== null && credits < 10 && (
                  <div className="bg-primary/10 border border-primary/20 p-3 rounded-xl mb-4 text-center">
                    <p className="text-sm font-bold text-primary">You have {credits} credits — need 10 to download</p>
                  </div>
                )}

                {/* Upsell Logic Banner */}
                {showUpsell && (
                  <div className="bg-primary/10 border border-primary/20 p-3 rounded-xl mb-4 text-center">
                    <p className="text-xs font-bold text-primary">💡 You've spent ₹58 — upgrade to Regular for ₹199 and save</p>
                  </div>
                )}

                {/* Standard plans */}
                {PLANS.map((plan) => (
                  <div key={plan.id} onClick={() => setSelectedPlan(plan.id)}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedPlan === plan.id ? "border-primary bg-primary/5 shadow-md" : plan.borderClass + " bg-surface-container-lowest hover:border-primary/40"
                      }`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${selectedPlan === plan.id ? "bg-primary/20" : "bg-surface-container-low"}`}>
                          {plan.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-on-background">{plan.name}</h4>
                            {plan.badge && <span className="text-[10px] font-black bg-primary text-white px-2 py-0.5 rounded-full">{plan.badge}</span>}
                          </div>
                          <p className="text-xs text-on-surface-variant">{plan.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-xl text-on-background">{plan.priceDisplay}</p>
                        <p className="text-[10px] text-on-surface-variant">{plan.period}</p>
                      </div>
                    </div>
                    <ul className="space-y-1 mt-2">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />{f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                {/* FIX #1: Student plan — always visible, attention-grabbing ── */}
                <div
                  onClick={() => {
                    if (!user) {
                      setStep("auth");
                      setAuthMode("student_signup");
                      return;
                    }
                    if (!isStudent) {
                      setStep("student_upgrade");
                      return;
                    }
                    setSelectedPlan("student");
                  }}
                  className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all overflow-hidden ${selectedPlan === "student"
                      ? "border-tertiary bg-tertiary-container/30 shadow-md shadow-tertiary/10"
                      : "border-tertiary/50 bg-gradient-to-br from-tertiary-container/20 to-surface-container-lowest hover:border-tertiary"
                    }`}
                >
                  {/* Pulse badge */}
                  <div className="absolute top-3 right-3 flex items-center gap-1 bg-tertiary text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                    </span>
                    EXCLUSIVE
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-tertiary/20 flex items-center justify-center flex-shrink-0">
                      <GraduationCap className="w-5 h-5 text-tertiary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="font-bold text-sm text-on-background">🎓 Student Plan</h4>
                        <span className="text-[10px] font-black bg-tertiary/20 text-tertiary px-2 py-0.5 rounded-full">₹99/60d</span>
                      </div>
                      <p className="text-xs text-on-surface-variant">60-day access · 300 credits</p>
                      {!isStudent && (
                        <p className="text-xs text-tertiary font-semibold mt-1">Sign up with college ID to unlock →</p>
                      )}
                      {isStudent && (
                        <p className="text-xs text-tertiary font-semibold mt-1">✓ You're eligible! Save ₹100</p>
                      )}
                    </div>
                    <div className="text-right self-center">
                      <p className="font-black text-xl text-tertiary">₹99</p>
                      <p className="text-[10px] text-on-surface-variant">/60 days</p>
                    </div>
                  </div>
                </div>

                {error && <p className="text-xs text-error bg-error/10 px-3 py-2 rounded-lg text-center">{error}</p>}

                <button onClick={handleProceedToPayment} disabled={loading}
                  className="w-full flash-gradient text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex justify-center items-center gap-2 shadow-lg shadow-primary/20 mt-1">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Pay & Download <ArrowRight className="w-4 h-4" /></>}
                </button>

                <p className="text-center text-xs text-on-surface-variant">🔒 Secured by Razorpay · SSL encrypted</p>
              </motion.div>
            )}

            {/* ── PROCESSING ─────────────────────────────────── */}
            {step === "processing" && (
              <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
                <p className="text-on-surface-variant text-sm">Setting up secure payment...</p>
              </motion.div>
            )}

            {/* ── STUDENT UPGRADE STEP ─────────────────────── */}
            {step === "student_upgrade" && (
              <motion.div key="student_upgrade" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="bg-tertiary/10 border border-tertiary/20 p-4 rounded-2xl text-center mb-4">
                  <GraduationCap className="w-8 h-8 text-tertiary mx-auto mb-2" />
                  <p className="font-bold text-tertiary">This offer is for students.</p>
                  <p className="text-xs text-on-surface-variant mt-1">Did you sign up as a student? Provide your college details to unlock the ₹99 plan.</p>
                </div>

                <div className="space-y-3">
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                    <input type="text" placeholder="College Name" value={collegeName} onChange={e => setCollegeName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm" />
                  </div>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                    <input type="text" placeholder="Roll Number / Enrollment ID" value={rollNumber} onChange={e => setRollNumber(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm" />
                  </div>
                </div>

                {error && <p className="text-xs text-error bg-error/10 px-3 py-2 rounded-lg text-center">{error}</p>}

                <div className="flex gap-2 pt-2">
                  <button onClick={() => { setStep("plan"); setSelectedPlan("pay_per_use"); setError(null); }} className="flex-1 py-3 font-bold text-on-surface-variant hover:bg-surface-container-low rounded-xl transition-colors">
                    Cancel
                  </button>
                  <button onClick={async () => {
                    if (!collegeName || !rollNumber) {
                      setError("Please fill in both fields");
                      return;
                    }
                    setLoading(true);
                    setError(null);
                    try {
                      await supabase.from("users").update({
                        college_name: collegeName,
                        roll_number: rollNumber,
                        is_student: true,
                        student_verified_at: new Date().toISOString(),
                      }).eq("id", user?.id);
                      setIsStudent(true);
                      setStudentPlanVisible(true);
                      setSelectedPlan("student");
                      setStep("plan");
                    } catch (e: any) {
                      setError(e.message);
                    }
                    setLoading(false);
                  }} disabled={loading} className="flex-1 bg-tertiary text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity flex justify-center items-center gap-2">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify Status"}
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
      <StudentVerificationModal 
        isOpen={showVerificationModal} 
        onClose={() => setShowVerificationModal(false)} 
        onSuccess={() => {
          setShowVerificationModal(false);
          handleProceedToPayment();
        }} 
      />
    </div>
  );
}
