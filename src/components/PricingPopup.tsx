"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Loader2, Download, Crown, GraduationCap, CheckCircle2, ArrowRight, Building, Mail, Hash, Eye, EyeOff } from "lucide-react";
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
  directPay?: boolean; // skip plan selection, go straight to payment
  forcePlanSelect?: boolean; // always show plan cards (e.g. Buy More Credits)
  prefetchedUser?: User | null; // pre-loaded user to skip session fetch
  prefetchedCredits?: number; // pre-loaded credit balance
}

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

type Step = "initializing" | "auth" | "plan" | "student_verify" | "processing";
type AuthMode = "login" | "signup" | "forgot_password" | "verify_otp" | "reset_password";

const PLANS = [
  {
    id: "pay_per_use",
    name: "One-Time",
    price: 29,
    priceDisplay: "₹29",
    period: "/10 Days",
    description: "2 resume downloads",
    icon: <Download className="w-5 h-5 text-on-surface-variant" />,
    badge: null,
    borderClass: "border-surface-container-high",
    features: ["20 Credits", "Valid for 10 Days"],
  },
  {
    id: "regular",
    name: "Most Popular",
    price: 199,
    priceDisplay: "₹199",
    period: "/2 Months",
    description: "300 Credits (30 Resumes)",
    icon: <Crown className="w-5 h-5 text-amber-400" />,
    badge: "Standard Plan",
    borderClass: "border-primary",
    features: ["300 Credits", "Valid for 2 Months", "All Premium Features"],
  },
];

export default function PricingPopup({ isOpen, onClose, onSuccess, initialPlan, directPay = false, forcePlanSelect = false, prefetchedUser, prefetchedCredits }: PricingPopupProps) {
  const [step, setStep] = useState<Step>("initializing");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [user, setUser] = useState<User | null>(null);

  // Auth Form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Forgot Password Flow State (Isolated to prevent cross-contamination)
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtpValue, setResetOtpValue] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  // Student Verify Form
  const [studentMethod, setStudentMethod] = useState<"details" | "email">("details");
  const [collegeName, setCollegeName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  // OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);

  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>(initialPlan || "pay_per_use");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setAuthMode("login");
      setResetSuccessMessage(null);
      setStep("initializing"); // Show loading spinner while checking session
      if (initialPlan) setSelectedPlan(initialPlan);
      checkUserSession();
    }
  }, [isOpen, initialPlan]);


  const checkUserSession = async () => {
    // Fast path: use pre-loaded user data if provided (avoids 2 extra network calls)
    if (prefetchedUser) {
      setUser(prefetchedUser);
      const credits = prefetchedCredits ?? 0;
      if (directPay && initialPlan) {
        setStep("processing");
        setTimeout(() => handleProceedToPayment(initialPlan, false, prefetchedUser), 100);
      } else if (!forcePlanSelect && credits >= 10) {
        onSuccess();
      } else {
        setStep("plan");
      }
      return;
    }
    // Standard path: fetch session from Supabase
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const sessionUser = session.user;
      setUser(sessionUser);
      const { data } = await supabase.from("users").select("credits_balance").eq("id", sessionUser.id).single();
      if (directPay && initialPlan) {
        setStep("processing");
        setTimeout(() => handleProceedToPayment(initialPlan, false, sessionUser), 100);
      } else if (!forcePlanSelect && data && data.credits_balance >= 10) {
        onSuccess();
      } else {
        setStep("plan");
      }
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
          const loggedInUser = data.user;
          setUser(loggedInUser);
          const { data: uData } = await supabase.from("users").select("credits_balance").eq("id", loggedInUser.id).single();
          if (directPay && initialPlan) {
            setStep("processing");
            setTimeout(() => handleProceedToPayment(initialPlan, false, loggedInUser), 100);
          } else if (uData && uData.credits_balance >= 10) {
            onSuccess();
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
      const msg: string = err.message || "";
      if (msg.includes("Invalid login credentials") || msg.includes("invalid_credentials")) {
        // Check if the email exists in our users table to give a specific message
        try {
          const { data: existingUser } = await supabase
            .from("users")
            .select("id")
            .eq("email", email.trim().toLowerCase())
            .maybeSingle();
          if (existingUser) {
            setError("Incorrect password. Please try again or reset your password.");
          } else {
            setError("No account found with this email. Please sign up to get started.");
          }
        } catch {
          setError("Incorrect email or password. Please try again.");
        }
      } else if (msg.includes("Email not confirmed")) {
        setError("Please verify your email first. Check your inbox for the confirmation link.");
      } else if (msg.includes("User already registered")) {
        setError("An account with this email already exists. Try logging in instead.");
      } else if (msg.includes("Password should be")) {
        setError("Password must be at least 6 characters.");
      } else {
        setError(msg || "Authentication failed. Please try again.");
      }
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
          redirectTo: `${window.location.origin}${window.location.pathname}${window.location.search}`
        }
      });
      if (error) throw error;
      // Note: This will redirect to Google
    } catch (err: any) {
      setError(err.message || "Google login failed");
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setLoading(true); setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim());
      if (error) throw error;
      setAuthMode("verify_otp");
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetOtpValue.length !== 6) { setError("Please enter a valid 6-digit code."); return; }
    setLoading(true); setError(null);
    try {
      const { error } = await supabase.auth.verifyOtp({ email: resetEmail.trim(), token: resetOtpValue, type: 'recovery' });
      if (error) throw error;
      setAuthMode("reset_password");
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetPassword !== resetConfirmPassword) { setError("Passwords do not match."); return; }
    if (resetPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true); setError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: resetPassword });
      if (error) throw error;
      await supabase.auth.signOut(); // Security: sign out to clear recovery session
      setAuthMode("login");
      setResetSuccessMessage("Password successfully reset! Please log in with your new password.");
      setResetEmail(""); setResetOtpValue(""); setResetPassword(""); setResetConfirmPassword("");
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const sendOtp = async () => {
    if (!studentEmail.trim()) { setError("Please enter your email."); return; }
    setLoading(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/payments/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: studentEmail.trim().toLowerCase() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to send OTP.");
      setOtpSent(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (otpValue.length !== 6) { setError("Enter the 6-digit code."); return; }
    setLoading(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/payments/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: studentEmail.trim().toLowerCase(), otp: otpValue })
      });
      const data = await res.json();
      if (!res.ok || !data.verified) throw new Error(data.detail || "Invalid or expired OTP.");

      // Guard: user must be set before writing to DB
      const activeUser = user;
      if (!activeUser?.id) throw new Error("Session expired. Please close and re-open the popup.");

      // OTP verified — mark student status in DB
      const { error: dbError } = await supabase.from("users").update({
        is_student: true,
        student_verified_at: new Date().toISOString()
      }).eq("id", activeUser.id);
      if (dbError) console.warn("Failed to save student status:", dbError.message);

      setSelectedPlan("student");
      handleProceedToPayment("student", true, activeUser);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyStudent = async () => {
    setLoading(true);
    setError(null);
    try {
      if (collegeName.trim().length < 3 || rollNumber.trim().length < 3) {
        throw new Error("Please provide valid college details.");
      }
      await supabase.from("users").update({
        is_student: true,
        college_name: collegeName,
        roll_number: rollNumber,
        student_verified_at: new Date().toISOString()
      }).eq("id", user?.id);
      setSelectedPlan("student");
      handleProceedToPayment("student", true);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handleProceedToPayment = async (overridePlan?: string, alreadyVerified = false, forceUser?: User | null) => {
    const activeUser = forceUser ?? user;
    if (!activeUser) return;
    const planToBuy = overridePlan || selectedPlan;

    if (planToBuy === "student" && !alreadyVerified) {
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
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const orderRes = await fetch(`${apiUrl}/api/payments/create-order`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ plan_type: planDetails.plan_type, user_id: activeUser.id, email: activeUser.email }),
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
        prefill: { email: activeUser.email },
        theme: { color: "#6750A4" },
        handler: async (response: any) => {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const verifyRes = await fetch(`${apiUrl}/api/payments/verify`, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {})
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            if (!verifyRes.ok) throw new Error("Payment verification failed on the server.");
            onSuccess();
          } catch (err: any) {
            setError(err.message || "Payment verification failed.");
            setStep("plan");
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => { setStep("plan"); setLoading(false); },
        },
      };

      // Wait for window.Razorpay to be available (handles first-load race condition)
      const openRazorpay = () => {
        if (typeof window.Razorpay !== "undefined") {
          const rzp = new window.Razorpay(options);
          rzp.open();
        } else {
          // Poll every 100ms, give up after 8 seconds
          let attempts = 0;
          const poll = setInterval(() => {
            attempts++;
            if (typeof window.Razorpay !== "undefined") {
              clearInterval(poll);
              const rzp = new window.Razorpay(options);
              rzp.open();
            } else if (attempts > 80) {
              clearInterval(poll);
              setError("Payment gateway failed to load. Please refresh the page and try again.");
              setStep("plan");
              setLoading(false);
            }
          }, 100);
        }
      };
      openRazorpay();
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
        {/* Header */}
        <div className="px-6 pt-16 pb-2 border-b border-surface-container-low text-center">
          <h2 className="text-2xl font-headline font-bold text-on-background">
            {step === "initializing" ? "Loading..." : step === "auth" ? "Login / Signup" : step === "processing" ? "Processing..." : step === "student_verify" ? "Student Verification" : "Invest in Yourself"}
          </h2>
          <p className="text-sm text-on-surface-variant mt-1 max-w-lg mx-auto">
            {step === "initializing" ? "Please wait a moment." : step === "auth" ? "Access your account to download." : step === "processing" ? "Securely setting up Razorpay..." : step === "student_verify" ? "Verify to unlock the ₹99 plan." : "Returns >>> Investment(paying for servers)"}
          </p>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">

            {/* INITIALIZING STEP */}
            {step === "initializing" && (
              <motion.div key="initializing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-12 flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              </motion.div>
            )}

            {/* AUTH STEP */}
            {step === "auth" && (
              <motion.div key="auth" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                {(authMode === "login" || authMode === "signup") && (
                  <>
                    {resetSuccessMessage && authMode === "login" && (
                      <p className="text-xs text-green-500 bg-green-500/10 px-3 py-2 rounded-lg text-center mb-2">
                        {resetSuccessMessage}
                      </p>
                    )}
                    <form onSubmit={handleAuth} className="space-y-4">
                      <input type="email" required placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
                        className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm" />
                      <div className="space-y-1">
                        <div className="relative">
                          <input type={showPassword ? "text" : "password"} required placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
                            className="w-full px-4 pr-10 py-3 bg-surface-container-low border border-surface-container-high rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm" />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-on-surface-variant focus:outline-none"
                          >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                        {authMode === "login" && (
                          <div className="flex justify-end">
                            <button type="button" onClick={() => { setAuthMode("forgot_password"); setError(null); setResetSuccessMessage(null); }} className="text-xs text-primary font-bold hover:underline">
                              Forgot password?
                            </button>
                          </div>
                        )}
                      </div>

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
                  </>
                )}

                {authMode === "forgot_password" && (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <p className="text-sm text-on-surface-variant mb-2">Enter your email address and we will send you a 6-digit code to reset your password.</p>
                    <input type="email" required placeholder="Email address" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm" />
                    {error && <p className="text-xs text-error bg-error/10 px-3 py-2 rounded-lg">{error}</p>}
                    <button type="submit" disabled={loading} className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Send Reset Code"}
                    </button>
                    <button type="button" onClick={() => setAuthMode("login")} className="w-full text-xs text-on-surface-variant font-bold hover:underline mt-2">Back to login</button>
                  </form>
                )}

                {authMode === "verify_otp" && (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <p className="text-sm text-on-surface-variant mb-2">Enter the 6-digit code sent to <span className="font-bold text-on-background">{resetEmail}</span></p>
                    <div className="flex justify-between gap-2">
                      {[0, 1, 2, 3, 4, 5].map((index) => (
                        <input key={index} id={`reset-otp-${index}`} type="text" maxLength={1} inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code"
                          value={resetOtpValue[index] || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val && !/^\d$/.test(val)) return;
                            const newVal = resetOtpValue.substring(0, index) + val + resetOtpValue.substring(index + 1);
                            setResetOtpValue(newVal);
                            if (val && index < 5) document.getElementById(`reset-otp-${index + 1}`)?.focus();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Backspace" && !resetOtpValue[index] && index > 0) {
                              document.getElementById(`reset-otp-${index - 1}`)?.focus();
                            }
                          }}
                          onPaste={(e) => {
                            e.preventDefault();
                            const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                            setResetOtpValue(pasted.padEnd(6, " ").slice(0, 6).trimEnd());
                            if (pasted.length > 0) document.getElementById(`reset-otp-${Math.min(pasted.length, 5)}`)?.focus();
                          }}
                          className="w-full aspect-square text-center text-lg font-bold bg-surface-container-low border border-surface-container-high rounded-xl outline-none focus:ring-2 focus:ring-primary"
                        />
                      ))}
                    </div>
                    {error && <p className="text-xs text-error bg-error/10 px-3 py-2 rounded-lg">{error}</p>}
                    <button type="submit" disabled={loading} className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Verify Code"}
                    </button>
                  </form>
                )}

                {authMode === "reset_password" && (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <p className="text-sm text-on-surface-variant mb-2">Create a new password for your account.</p>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"} required placeholder="New Password" value={resetPassword} onChange={e => setResetPassword(e.target.value)}
                        className="w-full px-4 pr-10 py-3 bg-surface-container-low border border-surface-container-high rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm" />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-on-surface-variant focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"} required placeholder="Confirm New Password" value={resetConfirmPassword} onChange={e => setResetConfirmPassword(e.target.value)}
                        className="w-full px-4 pr-10 py-3 bg-surface-container-low border border-surface-container-high rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm" />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-on-surface-variant focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {error && <p className="text-xs text-error bg-error/10 px-3 py-2 rounded-lg">{error}</p>}
                    <button type="submit" disabled={loading} className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Update Password"}
                    </button>
                  </form>
                )}
              </motion.div>
            )}

            {/* PLAN STEP */}
            {step === "plan" && (
              <motion.div key="plan" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="flex flex-col md:grid md:grid-cols-3 gap-3 md:gap-4 pt-2 pb-3 px-1">
                  {PLANS.map((plan) => {
                    const isSelected = selectedPlan === plan.id;
                    return (
                      <React.Fragment key={plan.id}>
                        {/* Card */}
                        <div onClick={() => setSelectedPlan(plan.id)}
                          className={`relative w-full md:w-auto flex flex-col p-4 md:p-5 rounded-2xl md:rounded-3xl border-2 cursor-pointer transition-all duration-300 ${isSelected ? "border-transparent bg-gradient-to-b from-[#006859] to-[#12f8d7] shadow-xl md:scale-105 text-white" : plan.borderClass + " bg-surface-container-lowest text-on-background hover:border-primary/40 hover:shadow-md"}`}>

                          {/* Selection indicator top-right */}
                          <div className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${isSelected ? "border-white bg-white scale-110" : "border-on-surface-variant/30"}`}>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-[#006859]" />}
                          </div>

                          {plan.badge && <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-black px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm tracking-wider ${isSelected ? "bg-white text-[#006859]" : "bg-primary text-white"}`}>{plan.badge}</div>}

                          <div className="flex flex-row md:flex-col items-center md:text-center gap-3 md:gap-0 mb-3 md:mb-4 pr-10 md:pr-4">
                            <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center md:mb-2 transition-colors ${isSelected ? "bg-white/20" : "bg-surface-container-low"}`}>
                              {isSelected ? <div className="text-white opacity-90">{plan.icon}</div> : plan.icon}
                            </div>
                            <div className="flex-1 text-left md:text-center">
                              <h4 className="font-bold text-base mb-0 md:mb-0.5">{plan.name}</h4>
                              <p className={`text-[11px] md:mb-2 ${isSelected ? "text-white/90" : "text-on-surface-variant"}`}>{plan.description}</p>
                            </div>
                            <div className="flex flex-col text-right md:text-center md:mb-1">
                              <p className="font-black text-xl md:text-3xl">{plan.priceDisplay}</p>
                              <p className={`text-[10px] md:text-[11px] font-medium mt-0.5 ${isSelected ? "text-white/90" : "text-on-surface-variant"}`}>{plan.period}</p>
                            </div>
                          </div>

                          <div className={`flex-1 flex flex-col justify-start w-full pt-3 border-t ${isSelected ? "border-white/20" : "border-surface-container-high"}`}>
                            <ul className="space-y-2 text-sm">
                              {plan.features.map((feat, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <CheckCircle2 className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isSelected ? "text-white" : "text-primary"}`} />
                                  <span className={`text-left font-medium text-[12px] ${isSelected ? "text-white" : "text-on-background"}`}>{feat}</span>
                                </li>
                              ))}
                            </ul>
                            {isSelected && (
                              <button
                                onClick={() => handleProceedToPayment()}
                                disabled={loading}
                                className="md:hidden w-full mt-4 bg-white text-[#006859] font-bold py-3 rounded-xl transition-all shadow-md flex justify-center items-center gap-2 active:scale-95"
                              >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
                              </button>
                            )}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}

                  {/* Student card */}
                  <div onClick={() => setSelectedPlan("student")}
                    className={`relative w-full md:w-auto flex flex-col p-4 md:p-5 rounded-2xl md:rounded-3xl border-2 cursor-pointer transition-all duration-300 ${selectedPlan === "student" ? "border-transparent bg-gradient-to-b from-[#006859] to-[#12f8d7] shadow-xl md:scale-105 text-white" : "border-tertiary/50 bg-gradient-to-br from-tertiary-container/20 to-surface-container-lowest hover:border-tertiary hover:shadow-md"}`}>

                    {/* Selection indicator top-right */}
                    <div className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 z-10 ${selectedPlan === "student" ? "border-white bg-white scale-110" : "border-on-surface-variant/30"}`}>
                      {selectedPlan === "student" && <CheckCircle2 className="w-4 h-4 text-[#006859]" />}
                    </div>

                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 text-[10px] font-black px-3 py-0.5 rounded-full shadow-md whitespace-nowrap tracking-wider border z-20 bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-orange-500/30 border-orange-400/50">
                      STUDENT OFFER
                    </div>

                    <div className="flex flex-row md:flex-col items-center md:text-center gap-3 md:gap-0 mb-3 md:mb-4 pr-10 md:pr-4">
                      <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center md:mb-2 transition-colors ${selectedPlan === "student" ? "bg-white/20 text-white" : "bg-tertiary/20"}`}>
                        <GraduationCap className={`w-5 h-5 ${selectedPlan === "student" ? "text-white opacity-90" : "text-tertiary"}`} />
                      </div>
                      <div className="flex-1 text-left md:text-center">
                        <h4 className="font-bold text-base mb-0 md:mb-0.5">Student Plan</h4>
                        <p className={`text-[11px] md:mb-2 ${selectedPlan === "student" ? "text-white/90" : "text-on-surface-variant"}`}>400 Credits (40 Resumes)</p>
                      </div>
                      <div className="flex flex-col text-right md:text-center md:mb-1">
                        <div className="flex items-end justify-end md:justify-center gap-1">
                          <p className={`font-black text-xl md:text-3xl ${selectedPlan === "student" ? "text-white" : "text-tertiary"}`}>₹99</p>
                          <p className={`text-[10px] md:text-sm line-through mb-0.5 md:mb-1 ${selectedPlan === "student" ? "text-white/60" : "text-on-surface-variant opacity-60"}`}>₹199</p>
                        </div>
                        <p className={`text-[10px] md:text-[11px] font-medium mt-0.5 ${selectedPlan === "student" ? "text-white/90" : "text-on-surface-variant"}`}>/3 months</p>
                      </div>
                    </div>

                    <div className={`flex-1 flex flex-col justify-start w-full pt-3 border-t ${selectedPlan === "student" ? "border-white/20" : "border-surface-container-high"}`}>
                      <ul className="space-y-2 text-sm mb-3">
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className={`w-4 h-4 flex-shrink-0 mt-0.5 ${selectedPlan === "student" ? "text-white" : "text-tertiary"}`} />
                          <span className={`text-left font-medium text-[12px] ${selectedPlan === "student" ? "text-white" : "text-on-background"}`}>400 Credits</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className={`w-4 h-4 flex-shrink-0 mt-0.5 ${selectedPlan === "student" ? "text-white" : "text-tertiary"}`} />
                          <span className={`text-left font-medium text-[12px] ${selectedPlan === "student" ? "text-white" : "text-on-background"}`}>Valid for 3 Months</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className={`w-4 h-4 flex-shrink-0 mt-0.5 ${selectedPlan === "student" ? "text-white" : "text-tertiary"}`} />
                          <span className={`text-left font-medium text-[12px] ${selectedPlan === "student" ? "text-white" : "text-on-background"}`}>All Premium Features</span>
                        </li>
                      </ul>
                      <p className={`text-[11px] font-bold text-center py-1.5 rounded-lg ${selectedPlan === "student" ? "bg-white/20 text-white" : "bg-tertiary/10 text-tertiary"}`}>
                        Requires Verification →
                      </p>
                      {selectedPlan === "student" && (
                        <button
                          onClick={() => handleProceedToPayment()}
                          disabled={loading}
                          className="md:hidden w-full mt-4 bg-white text-[#006859] font-bold py-3 rounded-xl transition-all shadow-md flex justify-center items-center gap-2 active:scale-95"
                        >
                          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {error && <p className="text-xs font-semibold text-error text-center mt-3 bg-error/10 py-2 rounded-lg">{error}</p>}

                {/* Desktop-only Pay & Continue button */}
                <div className="hidden md:flex justify-center mt-5">
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

                {/* Method toggle with OR divider */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStudentMethod("details")}
                    className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 border-2 ${studentMethod === "details" ? "border-orange-400 bg-orange-50 text-orange-600" : "border-surface-container-high bg-surface-container-low text-on-surface-variant hover:border-orange-300"}`}
                  >
                    <Building className="w-4 h-4 shrink-0" /> College Details
                  </button>
                  <span className="text-xs font-black text-on-surface-variant/50 shrink-0">OR</span>
                  <button
                    onClick={() => setStudentMethod("email")}
                    className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 border-2 ${studentMethod === "email" ? "border-orange-400 bg-orange-50 text-orange-600" : "border-surface-container-high bg-surface-container-low text-on-surface-variant hover:border-orange-300"}`}
                  >
                    <Mail className="w-4 h-4 shrink-0" /> College Email
                  </button>
                </div>

                {studentMethod === "email" ? (
                  <div className="space-y-4">
                    <input
                      type="email"
                      placeholder="Enter your college email"
                      value={studentEmail}
                      onChange={e => { setStudentEmail(e.target.value); setOtpSent(false); setOtpValue(""); setError(null); }}
                      disabled={otpSent}
                      className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl outline-none text-sm focus:ring-2 focus:ring-orange-400 disabled:opacity-50 transition-all"
                    />
                    {otpSent && (
                      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                        <p className="text-xs text-on-surface-variant text-center">
                          Enter the 6-digit code sent to <strong className="text-on-background">{studentEmail}</strong>
                        </p>
                        {/* Professional 6-box OTP input */}
                        <div className="flex justify-center gap-2">
                          {[0, 1, 2, 3, 4, 5].map((index) => (
                            <input
                              key={index}
                              id={`student-otp-${index}`}
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={1}
                              autoComplete="one-time-code"
                              value={otpValue[index] || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val && !/^\d$/.test(val)) return;
                                const newVal = otpValue.substring(0, index) + val + otpValue.substring(index + 1);
                                setOtpValue(newVal);
                                setError(null);
                                if (val && index < 5) document.getElementById(`student-otp-${index + 1}`)?.focus();
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Backspace" && !otpValue[index] && index > 0) {
                                  document.getElementById(`student-otp-${index - 1}`)?.focus();
                                }
                              }}
                              onPaste={(e) => {
                                e.preventDefault();
                                const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                                setOtpValue(pasted);
                                if (pasted.length > 0) document.getElementById(`student-otp-${Math.min(pasted.length, 5)}`)?.focus();
                              }}
                              className={`w-11 h-12 text-center text-lg font-black rounded-xl border-2 outline-none transition-all duration-200
                                ${otpValue[index]
                                  ? "border-orange-400 bg-orange-50 text-orange-600 scale-105 shadow-sm shadow-orange-200"
                                  : "border-surface-container-high bg-surface-container-low text-on-background focus:border-orange-400 focus:bg-orange-50/50"
                                }`}
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => { setOtpSent(false); setOtpValue(""); }}
                          className="text-xs text-on-surface-variant hover:text-orange-500 underline w-full text-center transition-colors"
                        >Change email / Resend</button>
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input type="text" placeholder="College Name" value={collegeName} onChange={e => setCollegeName(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl outline-none text-sm focus:ring-2 focus:ring-orange-400 transition-all" />
                    <input type="text" placeholder="Enrolled Roll Number" value={rollNumber} onChange={e => setRollNumber(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl outline-none text-sm focus:ring-2 focus:ring-orange-400 transition-all" />
                  </div>
                )}

                {error && <p className="text-xs text-error text-center bg-error/10 py-2 rounded-lg">{error}</p>}

                <div className="flex flex-col-reverse sm:flex-row gap-2">
                  <button onClick={() => { setStep("plan"); setError(null); setOtpSent(false); setOtpValue(""); }} className="sm:flex-1 py-3 font-bold text-on-surface-variant hover:bg-surface-container-low rounded-xl transition-colors text-center">Back</button>
                  <button
                    onClick={studentMethod === "email" ? (otpSent ? verifyOtp : sendOtp) : verifyStudent}
                    disabled={loading || (studentMethod === "email" && otpSent && otpValue.length !== 6)}
                    className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/30 font-bold py-3 px-4 rounded-xl hover:opacity-90 transition-opacity flex justify-center items-center text-sm sm:text-base leading-tight"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : studentMethod === "email" ? (otpSent ? "Claim Student Offer →" : "Send OTP") : "Claim Student Offer →"}
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
      </motion.div >
    </div >
  );
}
