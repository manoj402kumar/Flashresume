"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { User as UserIcon, Calendar, Zap, CreditCard, Loader2, Share2, Copy, CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";

interface AccountSectionProps {
  onTopUpClick: () => void;
}

export default function AccountSection({ onTopUpClick }: AccountSectionProps) {
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [plan, setPlan] = useState<string>("Free");
  const [validUntil, setValidUntil] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralStats, setReferralStats] = useState({ count: 0, earned: 0 });
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAccountData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoading(false);
        return;
      }
      setUser(session.user);

      // Fetch user data (credits + referral code)
      const { data: userData } = await supabase
        .from("users")
        .select("credits_balance, referral_code")
        .eq("id", session.user.id)
        .single();

      setCredits(userData?.credits_balance ?? 0);
      setReferralCode(userData?.referral_code ?? null);

      // Fetch referral rewards stats (safe — returns empty array if table missing)
      try {
        const { data: rewardData } = await supabase
          .from("referral_rewards")
          .select("credits_awarded")
          .eq("referrer_id", session.user.id);

        if (rewardData) {
          const earned = rewardData.reduce((acc, curr) => acc + (curr.credits_awarded || 0), 0);
          setReferralStats({ count: rewardData.length, earned });
        }
      } catch {
        // referral_rewards table may not exist yet — silently ignore
      }

      // Fetch active subscription
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subData) {
        setPlan(subData.plan_type === "regular" ? "Pro Monthly" :
          subData.plan_type === "student" ? "Student Plan" :
            subData.plan_type === "pay_per_use" ? "Pay Per Use" : "Free");
        setValidUntil(subData.expires_at);
      }

      setLoading(false);
    }

    loadAccountData();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Listen for realtime credit updates scoped only to this user
    const subscription = supabase
      .channel(`account_credits_${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
        filter: `id=eq.${user.id}`
      }, (payload) => {
        setCredits(payload.new.credits_balance);
        if (payload.new.referral_code) setReferralCode(payload.new.referral_code);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const referralLink = referralCode
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://flashresume.com'}/?ref=${referralCode}`
    : null;

  const handleCopyLink = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <section id="account-section" className="bg-surface py-20 border-t border-surface-container-low">
      <div className="max-w-4xl mx-auto px-6">
        <div className="mb-10">
          <h2 className="font-headline text-3xl md:text-4xl font-bold text-on-background mb-2">Your Account</h2>
          <p className="text-on-surface-variant text-lg">Manage your credits and subscription.</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-container-low rounded-[2rem] p-8 md:p-10 border border-primary/10 shadow-xl shadow-primary/5"
        >
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                  <UserIcon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Email</p>
                  <p className="text-lg font-bold text-on-background break-all">{user.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Current Plan</p>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-bold text-on-background">{plan}</p>
                    {plan !== "Free" && (
                      <span className="bg-green-500/20 text-green-600 px-2 py-0.5 rounded-full text-xs font-bold uppercase">Active</span>
                    )}
                  </div>
                </div>
              </div>

              {validUntil && plan !== "Free" && (
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Valid Until</p>
                    <p className="text-lg font-bold text-on-background">
                      {new Date(validUntil).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-surface-container-lowest rounded-2xl p-6 border border-primary/10 flex flex-col items-center justify-center text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[100px] -z-10" />

              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
                <Zap className="w-8 h-8" />
              </div>
              <p className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Available Credits</p>
              <div className="text-5xl font-black text-on-background mb-6">
                {credits !== null ? credits : "..."}
              </div>

              <button
                onClick={onTopUpClick}
                className="w-full flash-gradient text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
              >
                Buy More Credits
              </button>
            </div>
          </div>


        </motion.div>
      </div>
    </section>
  );
}
