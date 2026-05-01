"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Loader2, Download, Crown, GraduationCap, CheckCircle2, ArrowRight, Building, Mail, Hash } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

declare global {
  interface Window { Razorpay: any; }
}

interface PricingPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialPlan?: string | null;
}

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

type Step = "auth" | "plan" | "student_verify" | "processing";
type AuthMode = "login" | "signup";

const PLANS = [
  {
    id: "pay_per_use",
    name: "One-Time",
    price: 29,
    priceDisplay: "₹29",
    period: "20 Credits",
    description: "2 resume downloads",
    icon: <Download className="w-5 h-5 text-on-surface-variant" />,
    badge: null,
    borderClass: "border-surface-container-high",
    features: ["20 Credits", "Best plan to verify"],
  },
  {
    id: "regular",
    name: "Most Popular",
    price: 199,
    priceDisplay: "₹199",
    period: "/2 Months",
    description: "300 Credits (30 Resumes)",
    icon: <Crown className="w-5 h-5 text-amber-400" />,
    badge: "BEST VALUE",
    borderClass: "border-primary",
    features: ["300 Credits", "Valid for 2 Months", "All Premium Features"],
  },
];

export default function PricingPopup({ isOpen, onClose, onSuccess, initialPlan }: PricingPopupProps) {
  const [step, setStep] = useState<Step>("auth");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [user, setUser] = useState<User | null>(null);

  // Auth Form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Student Verify Form
  const [studentMethod, setStudentMethod] = useState<"details" | "email">("email");
  const [collegeName, setCollegeName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [studentEmail, setStudentEmail] = useState("");

  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>("regular");
  const [isStudent, setIsStudent] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (initialPlan) setSelectedPlan(initialPlan);
      checkUserSession();
    }
  }, [isOpen, initialPlan]);

  const applyStudentStatus = (uData: any) => {
    if (uData?.is_student && uData?.student_verified_at) {
      const verifiedAt = new Date(uData.student_verified_at);
      const daysSince = (new Date().getTime() - verifiedAt.getTime()) / (1000 * 3600 * 24);
      if (daysSince <= 365) {
        setIsStudent(true);
      } else {
        setIsStudent(false);
      }
    } else {
      setIsStudent(false);
    }
  };

  const checkUserSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
      const { data } = await supabase.from("users").select("is_student, student_verified_at").eq("id", session.user.id).single();
      applyStudentStatus(data);
      setStep("plan");
    } else {
      setStep("auth");
    }
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
          const { data: uData } = await supabase.from("users").select("is_student, student_verified_at").eq("id", data.user.id).single();
          applyStudentStatus(uData);
          setStep("plan");
        }
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) {
          if (!data.session) {
            setError("Check your email to verify account.");
            setLoading(false);
            return;
          }
          setUser(data.user);
          setStep("plan");
        }
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/result`
        }
      });
      if (error) throw error;
      // Note: This will redirect to Google
    } catch (err: any) {
      setError(err.message || "Google login failed");
      setLoading(false);
    }
  };

  const verifyStudent = async () => {
    setLoading(true);
    setError(null);
    try {
      if (studentMethod === "email") {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiUrl}/api/payments/verify-student`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: studentEmail })
        });
        const data = await res.json();
        if (!data.verified) throw new Error("Personal emails are not accepted. Please use your institutional email.");
      } else {
        if (collegeName.trim().length < 3 || rollNumber.trim().length < 3) {
          throw new Error("Please provide valid college details.");
        }
      }

      await supabase.from("users").update({
        is_student: true,
        college_name: collegeName,
        roll_number: rollNumber,
        student_verified_at: new Date().toISOString()
      }).eq("id", user?.id);

      setIsStudent(true);
      setSelectedPlan("student");
      // Go directly to payment after verification
      handleProceedToPayment("student");
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handleProceedToPayment = async (overridePlan?: string) => {
    if (!user) return;
    const planToBuy = overridePlan || selectedPlan;

    if (planToBuy === "student" && !isStudent) {
      setStep("student_verify");
      return;
    }

    setStep("processing");
    setLoading(true);
    setError(null);

    const planDetails =
      planToBuy === "student" ? { amount: 99, plan_type: "student" } :
        planToBuy === "regular" ? { amount: 199, plan_type: "regular" } :
          { amount: 29, plan_type: "pay_per_use" };

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
        description: `Purchase ${planDetails.plan_type} plan`,
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
            }),
          });
          if (!verifyRes.ok) throw new Error("Payment verification failed.");
          onSuccess();
        },
        modal: {
          ondismiss: () => { setStep("plan"); setLoading(false); },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      setError(err.message || "Payment failed.");
      setStep("plan");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`bg-surface rounded-3xl w-full ${step === "plan" ? "max-w-3xl" : "max-w-md"} shadow-2xl overflow-hidden relative border border-surface-container-high max-h-[95vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`}
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-surface-container-low hover:bg-surface-container-high rounded-full transition-colors z-10">
          <X className="w-5 h-5 text-on-surface-variant" />
        </button>

        <div className="px-6 pt-6 pb-3 border-b border-surface-container-low text-center">
          <h2 className="text-2xl font-headline font-bold text-on-background">
            {step === "auth" ? "Login / Signup" : step === "processing" ? "Processing..." : step === "student_verify" ? "Student Verification" : "Invest in Your Career"}
          </h2>
          <p className="text-sm text-on-surface-variant mt-1 max-w-lg mx-auto">
            {step === "auth" ? "Access your account to download." : step === "processing" ? "Securely setting up Razorpay..." : step === "student_verify" ? "Verify to unlock the ₹99 plan." : "Increase the probability of getting shortlisted"}
          </p>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">

            {/* AUTH STEP */}
            {step === "auth" && (
              <motion.div key="auth" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <form onSubmit={handleAuth} className="space-y-4">
                  <input type="email" required placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm" />
                  <input type="password" required placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm" />

                  {error && <p className="text-xs text-error bg-error/10 px-3 py-2 rounded-lg">{error}</p>}

                  <button type="submit" disabled={loading} className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : authMode === "login" ? "Log In" : "Sign Up"}
                  </button>
                </form>

                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-surface-container-high"></div>
                  <span className="flex-shrink-0 mx-4 text-on-surface-variant text-xs">Or continue with</span>
                  <div className="flex-grow border-t border-surface-container-high"></div>
                </div>

                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full bg-surface-container-lowest border border-surface-container-high text-on-background font-bold py-3 rounded-xl hover:bg-surface-container-low transition-colors flex justify-center items-center gap-3 shadow-sm"
                >
                  <GoogleIcon />
                  Google
                </button>

                <p className="text-center text-xs text-on-surface-variant">
                  {authMode === "login" ? "Don't have an account? " : "Already have an account? "}
                  <button onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setError(null); }} className="text-primary font-bold hover:underline">
                    {authMode === "login" ? "Sign up" : "Log in"}
                  </button>
                </p>
              </motion.div>
            )}

            {/* PLAN STEP */}
            {step === "plan" && (
              <motion.div key="plan" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {PLANS.map((plan) => (
                    <div key={plan.id} onClick={() => setSelectedPlan(plan.id)}
                      className={`relative p-5 rounded-3xl border-2 flex flex-col h-full cursor-pointer transition-all duration-300 ${selectedPlan === plan.id ? "border-primary bg-primary/5 shadow-lg scale-105 z-10" : plan.borderClass + " bg-surface-container-lowest hover:border-primary/40 hover:shadow-md"}`}>
                      {plan.badge && <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-black bg-primary text-white px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm tracking-wider">{plan.badge}</div>}
                      <div className="flex flex-col items-center text-center mb-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${selectedPlan === plan.id ? "bg-primary/20" : "bg-surface-container-low"}`}>
                          {plan.icon}
                        </div>
                        <h4 className="font-bold text-lg mb-0.5">{plan.name}</h4>
                        <p className="text-[11px] text-on-surface-variant mb-2">{plan.description}</p>
                        <div className="flex flex-col mb-1">
                          <p className="font-black text-3xl">{plan.priceDisplay}</p>
                          <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">{plan.period}</p>
                        </div>
                      </div>

                      <div className="flex-1 flex flex-col justify-start w-full pt-4 border-t border-surface-container-high">
                        <ul className="space-y-2 text-sm">
                          {plan.features.map((feat, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-on-background">
                              <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                              <span className="text-left font-medium text-[13px]">{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}

                  <div onClick={() => setSelectedPlan("student")}
                    className={`relative p-5 rounded-3xl border-2 flex flex-col h-full cursor-pointer transition-all duration-300 ${selectedPlan === "student" ? "border-tertiary bg-tertiary-container/30 shadow-lg scale-105 z-10" : "border-tertiary/50 bg-gradient-to-br from-tertiary-container/20 to-surface-container-lowest hover:border-tertiary hover:shadow-md"}`}>
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-black px-3 py-0.5 rounded-full shadow-md shadow-orange-500/30 whitespace-nowrap tracking-wider border border-orange-400/50 z-20">
                      STUDENT OFFER
                    </div>
                    <div className="flex flex-col items-center text-center mb-4">
                      <div className="w-10 h-10 rounded-xl bg-tertiary/20 flex items-center justify-center mb-2">
                        <GraduationCap className="w-5 h-5 text-tertiary" />
                      </div>
                      <h4 className="font-bold text-lg mb-0.5">Student Plan</h4>
                      <p className="text-[11px] text-on-surface-variant mb-2">400 Credits (40 Resumes)</p>
                      <div className="flex flex-col mb-1">
                        <p className="font-black text-3xl text-tertiary">₹99</p>
                        <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">/3 months</p>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-start w-full pt-4 border-t border-surface-container-high">
                      <ul className="space-y-2 text-sm mb-4">
                        <li className="flex items-start gap-2 text-on-background">
                          <CheckCircle2 className="w-4 h-4 text-tertiary flex-shrink-0 mt-0.5" />
                          <span className="text-left font-medium text-[13px]">400 Credits</span>
                        </li>
                        <li className="flex items-start gap-2 text-on-background">
                          <CheckCircle2 className="w-4 h-4 text-tertiary flex-shrink-0 mt-0.5" />
                          <span className="text-left font-medium text-[13px]">Valid for 3 Months</span>
                        </li>
                        <li className="flex items-start gap-2 text-on-background">
                          <CheckCircle2 className="w-4 h-4 text-tertiary flex-shrink-0 mt-0.5" />
                          <span className="text-left font-medium text-[13px]">All Premium Features</span>
                        </li>
                      </ul>
                      <div className="mt-auto">
                        {isStudent ? <p className="text-[11px] text-tertiary font-bold text-center bg-tertiary/10 py-1.5 rounded-lg">✓ Verified Student</p> : <p className="text-[11px] text-tertiary font-bold text-center bg-tertiary/10 py-1.5 rounded-lg">Requires Verification →</p>}
                      </div>
                    </div>
                  </div>
                </div>

                {error && <p className="text-xs font-semibold text-error text-center mt-3 bg-error/10 py-2 rounded-lg">{error}</p>}

                <div className="flex justify-center mt-5">
                  <button onClick={() => handleProceedToPayment()} disabled={loading}
                    className="w-full max-w-sm bg-primary text-white font-bold py-3.5 rounded-2xl hover:opacity-90 transition-opacity flex justify-center items-center gap-2 shadow-lg shadow-primary/20">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Pay & Continue <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </motion.div>
            )}

            {/* STUDENT VERIFY STEP */}
            {step === "student_verify" && (
              <motion.div key="student_verify" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                <div className="flex bg-surface-container-low rounded-xl p-1 gap-1">
                  <button onClick={() => setStudentMethod("email")} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${studentMethod === "email" ? "bg-surface-container-lowest text-on-background shadow-sm" : "text-on-surface-variant hover:text-on-background"}`}>
                    <Mail className="w-4 h-4" /> Verify with clg mail
                  </button>
                  <button onClick={() => setStudentMethod("details")} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${studentMethod === "details" ? "bg-surface-container-lowest text-on-background shadow-sm" : "text-on-surface-variant hover:text-on-background"}`}>
                    <Building className="w-4 h-4" /> Verify with details
                  </button>
                </div>

                {studentMethod === "email" ? (
                  <div className="space-y-2">
                    <input type="email" placeholder="Student Email (.edu or .ac.in)" value={studentEmail} 
                      onChange={e => {
                        const val = e.target.value;
                        setStudentEmail(val);
                        const lowerVal = val.toLowerCase();
                        if (lowerVal.includes('@')) {
                          if (lowerVal.endsWith('@gmail.com') || lowerVal.endsWith('@yahoo.com') || lowerVal.endsWith('@outlook.com') || lowerVal.endsWith('@hotmail.com')) {
                            setError("Personal emails are not accepted. Please use your institutional email.");
                          } else {
                            setError(null);
                          }
                        } else {
                          setError(null);
                        }
                      }}
                      className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl outline-none text-sm focus:ring-2 focus:ring-tertiary" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input type="text" placeholder="College Name" value={collegeName} onChange={e => setCollegeName(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl outline-none text-sm" />
                    <input type="text" placeholder="Enrolled Roll Number" value={rollNumber} onChange={e => setRollNumber(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl outline-none text-sm" />
                  </div>
                )}

                {error && <p className="text-xs text-error text-center bg-error/10 py-2 rounded">{error}</p>}

                <div className="flex gap-2">
                  <button onClick={() => { setStep("plan"); setError(null); }} className="flex-1 py-3 font-bold text-on-surface-variant hover:bg-surface-container-low rounded-xl transition-colors">Back</button>
                  <button onClick={verifyStudent} disabled={loading} className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/30 font-bold py-3 rounded-xl hover:opacity-90 transition-opacity flex justify-center items-center">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Claim student offer"}
                  </button>
                </div>
              </motion.div>
            )}

            {/* PROCESSING STEP */}
            {step === "processing" && (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="text-on-surface-variant text-sm font-bold">Setting up secure payment...</p>
              </div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
