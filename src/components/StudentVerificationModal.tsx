"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, GraduationCap, Mail, Building, Hash, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface StudentVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function StudentVerificationModal({ isOpen, onClose, onSuccess }: StudentVerificationModalProps) {
  const [method, setMethod] = useState<"details" | "email">("details");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form states
  const [collegeName, setCollegeName] = useState("");
  const [enrollmentNumber, setEnrollmentNumber] = useState("");
  const [studentEmail, setStudentEmail] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (method === "email") {
        if (!studentEmail.endsWith(".edu") && !studentEmail.endsWith(".ac.in")) {
          throw new Error("Please use a valid .edu or .ac.in email address.");
        }
      } else {
        if (collegeName.trim().length < 3 || enrollmentNumber.trim().length < 3) {
          throw new Error("Please provide valid college details.");
        }
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Authentication failed. Please log in again.");

      const payload = method === "details" ? {
        user_id: user.id,
        method: "details",
        college_name: collegeName,
        enrollment_number: enrollmentNumber,
        status: "approved" // Auto-approve per spec
      } : {
        user_id: user.id,
        method: "email",
        student_email: studentEmail,
        status: "approved"
      };

      const { error: insertError } = await supabase.from("student_verifications").insert(payload);
      if (insertError) throw new Error("Verification submission failed. Please try again.");

      const { error: updateError } = await supabase.from("users").update({ student_verified: true }).eq("id", user.id);
      if (updateError) throw new Error("Failed to update user profile.");

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        setSuccess(false);
        setCollegeName("");
        setEnrollmentNumber("");
        setStudentEmail("");
      }, 1500);

    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          onClick={loading || success ? undefined : onClose}
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg bg-surface-container-lowest rounded-3xl shadow-2xl overflow-hidden border border-primary/10"
        >
          <button
            onClick={onClose}
            disabled={loading || success}
            className="absolute top-4 right-4 p-2 text-on-surface-variant hover:text-on-background rounded-full hover:bg-surface-container-low transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 text-primary">
              <GraduationCap className="w-8 h-8" />
            </div>

            <h2 className="font-headline text-3xl font-bold text-on-background mb-2">Student Verification</h2>
            <p className="text-on-surface-variant text-sm mb-8">
              Verify your student status to unlock the exclusive ₹99 special offer.
            </p>

            {success ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }}
                className="py-12 flex flex-col items-center text-center"
              >
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <h3 className="font-bold text-xl mb-2">Verification Successful!</h3>
                <p className="text-on-surface-variant text-sm">Redirecting to checkout...</p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex bg-surface-container-low rounded-xl p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setMethod("details")}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                      method === "details" ? "bg-surface-container-lowest text-on-background shadow-sm" : "text-on-surface-variant hover:text-on-background"
                    }`}
                  >
                    <Building className="w-4 h-4" />
                    College Details
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod("email")}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                      method === "email" ? "bg-surface-container-lowest text-on-background shadow-sm" : "text-on-surface-variant hover:text-on-background"
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                    Student Email
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {method === "details" ? (
                    <motion.div
                      key="details"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-on-background">College / University Name</label>
                        <div className="relative">
                          <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
                          <input
                            type="text"
                            required
                            value={collegeName}
                            onChange={(e) => setCollegeName(e.target.value)}
                            placeholder="e.g. Indian Institute of Technology"
                            className="w-full bg-surface-container-low border border-transparent focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-10 pr-4 text-sm outline-none transition-all"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-on-background">Enrollment / Roll Number</label>
                        <div className="relative">
                          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
                          <input
                            type="text"
                            required
                            value={enrollmentNumber}
                            onChange={(e) => setEnrollmentNumber(e.target.value)}
                            placeholder="e.g. 21BCE0000"
                            className="w-full bg-surface-container-low border border-transparent focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-10 pr-4 text-sm outline-none transition-all"
                          />
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="email"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-on-background">Student Email Address</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
                          <input
                            type="email"
                            required
                            value={studentEmail}
                            onChange={(e) => setStudentEmail(e.target.value)}
                            placeholder="e.g. you@university.edu"
                            className="w-full bg-surface-container-low border border-transparent focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-10 pr-4 text-sm outline-none transition-all"
                          />
                        </div>
                        <p className="text-xs text-on-surface-variant">Must end with .edu or .ac.in</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {error && (
                  <div className="p-3 bg-error/10 text-error text-sm rounded-lg border border-error/20">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flash-gradient text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 mt-4"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify & Continue to Payment"
                  )}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
