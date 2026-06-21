"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "motion/react";
import { User, BarChart3, ChevronLeft, Loader2 } from "lucide-react";
import { ProfileTab, ApplicationTracker } from "@/components/ProfileModal";

export default function ProfilePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"profile" | "tracker">("profile");
  const [userId, setUserId] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [credits, setCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        setUserEmail(session.user.email || "");

        // Fetch credits
        const { data: bucketData } = await supabase
          .from("credit_buckets")
          .select("*")
          .eq("user_id", session.user.id)
          .in("status", ["active", "queued", "fallback"])
          .gt("remaining_credits", 0);

        if (bucketData && bucketData.length > 0) {
          setCredits(bucketData.reduce((acc, b) => acc + b.remaining_credits, 0));
        } else {
          const { data: oldData } = await supabase.from("users").select("credits_balance").eq("id", session.user.id).single();
          setCredits(oldData?.credits_balance || 0);
        }
      }
      setLoading(false);
    }
    loadUser();
  }, []);

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="flex-shrink-0 bg-surface border-b border-surface-container-low shadow-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (window.history.length > 2) {
                  router.back();
                } else {
                  window.close();
                  setTimeout(() => router.push('/'), 100);
                }
              }}
              className="w-10 h-10 rounded-xl bg-surface-container-low hover:bg-surface-container-high flex items-center justify-center text-on-background transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#006859] to-[#12f8d7] flex items-center justify-center shadow-lg shadow-[#006859]/20">
                <User className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-headline text-lg font-bold text-on-background leading-tight">My Profile</h1>
                <p className="text-xs text-on-surface-variant">Account details & job tracker</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="bg-surface rounded-3xl shadow-xl border border-surface-container-low overflow-hidden">
          
          {/* Tabs */}
          <div className="flex gap-2 px-6 pt-6 pb-4 border-b border-surface-container-low bg-surface-container-lowest">
            <button
              onClick={() => setActiveTab("profile")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === "profile" 
                  ? "bg-[#006859] text-white shadow-md shadow-[#006859]/20" 
                  : "text-on-surface-variant hover:bg-surface-container-low"
              }`}
            >
              <User className="w-4 h-4" /> Profile Details
            </button>
            <button
              onClick={() => setActiveTab("tracker")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === "tracker" 
                  ? "bg-[#006859] text-white shadow-md shadow-[#006859]/20" 
                  : "text-on-surface-variant hover:bg-surface-container-low"
              }`}
            >
              <BarChart3 className="w-4 h-4" /> Application Tracker
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6 md:p-8">
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {activeTab === "profile" ? (
                  <motion.div 
                    key="profile" 
                    initial={{ opacity: 0, x: -12 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    exit={{ opacity: 0, x: 12 }} 
                    transition={{ duration: 0.18 }}
                    className="max-w-2xl"
                  >
                    <ProfileTab userEmail={userEmail} credits={credits} />
                  </motion.div>
                ) : (
                  <motion.div 
                    key="tracker" 
                    initial={{ opacity: 0, x: 12 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    exit={{ opacity: 0, x: -12 }} 
                    transition={{ duration: 0.18 }}
                  >
                    <ApplicationTracker userId={userId} />
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
