"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "motion/react";
import {
  Copy, Check, LogIn, LogOut, Zap, Users, IndianRupee,
  TrendingUp, Clock, CheckCircle2, AlertCircle, Search,
  ExternalLink, Mail, Phone, ArrowRight, Loader2, Wallet, Gift,
} from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://flashresume.in";
const COMMISSION_RATE = 30;

// ─── helpers ──────────────────────────────────────────────────────────────

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

function formatINR(amount: number) {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  return `${m}m ago`;
}

// ─── types ────────────────────────────────────────────────────────────────

interface AffiliateData {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  affiliate_code: string;
  status: string;
  earnings_balance: number;
  total_earned: number;
  upi_id: string | null;
  conversions: Conversion[];
  payouts: Payout[];
}

interface Conversion {
  plan_type: string;
  plan_amount: number;
  commission_amount: number;
  status: string;
  created_at: string;
}

interface Payout {
  amount: number;
  upi_id: string;
  status: string;
  requested_at: string;
  processed_at: string | null;
}

interface PublicAffiliate {
  name: string;
  email: string;
  avatar_url: string | null;
  affiliate_code: string;
  total_earned: number;
  created_at: string;
}

// ─── sub-components ───────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color = "#006859" }: {
  icon: any; label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#e8f5f3] p-5 flex items-start gap-4 shadow-sm">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-xs text-[#595c5d] font-semibold uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-2xl font-black text-[#1a1a1a] leading-none">{value}</p>
        {sub && <p className="text-xs text-[#595c5d] mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function AvatarFallback({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div
      className="flex items-center justify-center rounded-full font-black text-white flex-shrink-0"
      style={{ width: size, height: size, background: "linear-gradient(135deg,#006859,#12f8d7)", fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────

export default function AffiliatePage() {
  const [session, setSession] = useState<any>(null);
  const [affiliateData, setAffiliateData] = useState<AffiliateData | null>(null);
  const [publicAffiliates, setPublicAffiliates] = useState<PublicAffiliate[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [copied, setCopied] = useState(false);
  const [upiValue, setUpiValue] = useState("");
  const [upiSaving, setUpiSaving] = useState(false);
  const [upiSaved, setUpiSaved] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutResult, setPayoutResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState(SITE_URL);

  // Load session + public list on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    fetchPublicList();
    return () => listener.subscription.unsubscribe();
  }, []);

  // When session changes, load affiliate data or trigger registration
  useEffect(() => {
    if (!session) { setLoading(false); return; }
    loadAffiliateData(session.access_token, session.user);
  }, [session]);

  async function fetchPublicList() {
    try {
      const res = await fetch(`${API_URL}/api/affiliate/public-list`);
      const data = await res.json();
      setPublicAffiliates(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  }

  async function loadAffiliateData(token: string, user: any) {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/affiliate/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 404) {
        // Not yet registered — auto-register
        await registerAffiliate(token, user);
      } else if (res.ok) {
        const data = await res.json();
        setAffiliateData(data);
        setUpiValue(data.upi_id || "");
      }
    } catch (e) {
      setError("Failed to load your affiliate data. Please refresh.");
    } finally {
      setLoading(false);
    }
  }

  async function registerAffiliate(token: string, user: any) {
    setRegistering(true);
    try {
      const res = await fetch(`${API_URL}/api/affiliate/register`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Creator",
          email: user.email,
          avatar_url: user.user_metadata?.avatar_url || null,
        }),
      });
      if (res.ok) {
        // Now fetch full data
        const meRes = await fetch(`${API_URL}/api/affiliate/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (meRes.ok) {
          const data = await meRes.json();
          setAffiliateData(data);
          setUpiValue(data.upi_id || "");
          fetchPublicList(); // refresh wall
        }
      }
    } catch (e) {
      setError("Registration failed. Please try again.");
    } finally {
      setRegistering(false);
    }
  }

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/affiliate` },
    });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setAffiliateData(null);
    setPayoutResult(null);
  }

  function copyLink() {
    if (!affiliateData) return;
    navigator.clipboard.writeText(`${origin}/?ref=${affiliateData.affiliate_code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function saveUpi() {
    if (!session || !upiValue.includes("@")) return;
    setUpiSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/affiliate/update-upi`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ upi_id: upiValue }),
      });
      if (res.ok) {
        setUpiSaved(true);
        setTimeout(() => setUpiSaved(false), 2500);
        if (affiliateData) setAffiliateData({ ...affiliateData, upi_id: upiValue });
      }
    } catch { /* ignore */ }
    setUpiSaving(false);
  }

  async function requestPayout() {
    if (!session) return;
    setPayoutLoading(true);
    setPayoutResult(null);
    try {
      const res = await fetch(`${API_URL}/api/affiliate/request-payout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setPayoutResult({ ok: true, message: data.message });
        if (affiliateData) setAffiliateData({ ...affiliateData, earnings_balance: 0 });
      } else {
        setPayoutResult({ ok: false, message: data.detail || "Payout request failed." });
      }
    } catch {
      setPayoutResult({ ok: false, message: "Network error. Please try again." });
    }
    setPayoutLoading(false);
  }

  const affiliateLink = affiliateData ? `${origin}/?ref=${affiliateData.affiliate_code}` : "";
  const balance = affiliateData?.earnings_balance ?? 0;
  const canWithdraw = balance >= 300 && !!affiliateData?.upi_id;

  const filteredAffiliates = publicAffiliates.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.email.toLowerCase().includes(search.toLowerCase())
  );

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f5f9f8] font-sans">

      {/* ── Top nav ── */}
      <header className="bg-white border-b border-[#e0efec] sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#006859] to-[#12f8d7] flex items-center justify-center">
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <span className="font-black text-lg text-[#1a1a1a] tracking-tight">FlashResume</span>
          </a>
          <div className="flex items-center gap-3">
            <a href="tel:+919701910239"
              className="hidden sm:flex items-center gap-1.5 text-xs text-[#006859] font-semibold hover:underline">
              <Phone className="w-3.5 h-3.5" /> +91 9701910239
            </a>
            <a href="mailto:flashresume.in@gmail.com"
              className="hidden sm:flex items-center gap-1.5 text-xs text-[#006859] font-semibold hover:underline">
              <Mail className="w-3.5 h-3.5" /> flashresume.in@gmail.com
            </a>
            {session ? (
              <button onClick={handleLogout}
                className="flex items-center gap-1.5 text-xs text-[#595c5d] hover:text-[#1a1a1a] font-semibold transition-colors">
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </button>
            ) : (
              <button onClick={handleGoogleLogin}
                className="flex items-center gap-1.5 text-xs bg-[#006859] text-white px-3.5 py-2 rounded-xl font-bold hover:bg-[#005245] transition-colors">
                <LogIn className="w-3.5 h-3.5" /> Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-12 space-y-16">

        {/* ── Hero ── */}
        <section className="text-center space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 bg-[#006859]/10 text-[#006859] text-xs font-black px-4 py-2 rounded-full mb-5 uppercase tracking-wider">
              <Gift className="w-3.5 h-3.5" /> Affiliate Program
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-[#1a1a1a] leading-tight mb-4">
              Earn <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#006859] to-[#12f8d7]">Money 💰</span><br />
              With Flashresume
            </h1>
            <p className="text-[#595c5d] text-lg max-w-xl mx-auto">
              Share your unique link. When someone pays through it for the first time, you earn {COMMISSION_RATE}%.
              Payouts directly to your UPI — processed within 24 hours.
            </p>
          </motion.div>

          {/* How it works */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto mt-8">
            {[
              { step: "01", title: "Sign in with Google", desc: "Get your unique affiliate link instantly — no approval needed." },
              { step: "02", title: "Share your link", desc: "Share on LinkedIn, YouTube, WhatsApp, Instagram — anywhere you have an audience." },
              { step: "03", title: "Get paid", desc: "Earn 30% on every first purchase. Withdraw to UPI within 24 hours." },
            ].map(({ step, title, desc }) => (
              <div key={step} className="bg-white rounded-2xl border border-[#e0efec] p-5 text-left shadow-sm">
                <div className="text-3xl font-black text-[#12f8d7] mb-3">{step}</div>
                <h3 className="font-bold text-[#1a1a1a] mb-1.5">{title}</h3>
                <p className="text-sm text-[#595c5d]">{desc}</p>
              </div>
            ))}
          </motion.div>

          {/* Commission table */}
          <div className="inline-flex flex-wrap justify-center gap-3 mt-2">
            {[
              { plan: "Student", amount: 99, commission: 30 },
              { plan: "Standard", amount: 599, commission: 180 },
              { plan: "Pay-per-use", amount: 29, commission: 9 },
            ].map(({ plan, amount, commission }) => (
              <div key={plan} className="flex items-center gap-2 bg-white border border-[#e0efec] rounded-xl px-4 py-2.5 text-sm shadow-sm">
                <span className="text-[#595c5d]">{plan} (₹{amount})</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#006859]" />
                <span className="font-black text-[#006859]">+₹{commission}</span>
              </div>
            ))}
          </div>

          {/* CTA if not logged in */}
          {!session && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <button onClick={handleGoogleLogin}
                className="mt-4 inline-flex items-center gap-3 bg-gradient-to-r from-[#006859] to-[#0d9e84] text-white font-bold px-8 py-4 rounded-2xl text-base shadow-xl shadow-[#006859]/25 hover:scale-[1.02] hover:shadow-2xl hover:shadow-[#006859]/30 transition-all duration-200">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Join with Google — It&apos;s Free
              </button>
              <p className="text-xs text-[#595c5d] mt-3">No approval needed · Instant access · Free forever</p>
            </motion.div>
          )}
        </section>

        {/* ── Dashboard (logged in) ── */}
        {session && (
          <section className="space-y-6">
            {loading || registering ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-[#006859]" />
                <span className="ml-3 text-[#595c5d] font-medium">
                  {registering ? "Setting up your affiliate account…" : "Loading your dashboard…"}
                </span>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-red-700 text-sm font-medium">{error}</p>
              </div>
            ) : affiliateData ? (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

                {/* Welcome bar */}
                <div className="flex items-center gap-3 bg-gradient-to-r from-[#006859] to-[#0d9e84] rounded-2xl px-6 py-4 shadow-lg shadow-[#006859]/20">
                  {affiliateData.avatar_url ? (
                    <img src={affiliateData.avatar_url} alt={affiliateData.name}
                      className="w-10 h-10 rounded-full border-2 border-white/30 flex-shrink-0" />
                  ) : (
                    <AvatarFallback name={affiliateData.name} size={40} />
                  )}
                  <div>
                    <p className="text-white font-bold">Welcome back, {affiliateData.name.split(" ")[0]}!</p>
                    <p className="text-white/70 text-xs">Code: <span className="font-mono font-bold text-[#12f8d7]">{affiliateData.affiliate_code}</span></p>
                  </div>
                  <div className="ml-auto text-right hidden sm:block">
                    <p className="text-white/70 text-xs">Total Earned</p>
                    <p className="text-white font-black text-xl">{formatINR(affiliateData.total_earned)}</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <StatCard icon={Wallet} label="Pending Balance" value={formatINR(balance)}
                    sub={balance < 300 ? `₹${(300 - balance).toFixed(0)} more to withdraw` : "Ready to withdraw!"} />
                  <StatCard icon={TrendingUp} label="Total Earned" value={formatINR(affiliateData.total_earned)}
                    sub={`${affiliateData.conversions.length} conversion${affiliateData.conversions.length !== 1 ? "s" : ""}`} color="#0d9e84" />
                  <StatCard icon={Users} label="Payouts Made" value={`${affiliateData.payouts.filter(p => p.status === "processed").length}`}
                    sub="Successfully processed" color="#7c3aed" />
                </div>

                {/* Affiliate link */}
                <div className="bg-white rounded-2xl border border-[#e0efec] p-6 shadow-sm">
                  <h3 className="font-bold text-[#1a1a1a] mb-1">Your Affiliate Link</h3>
                  <p className="text-xs text-[#595c5d] mb-4">Share this link. When someone pays for the first time through it, you earn 30%.</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-[#f5f9f8] border border-[#e0efec] rounded-xl px-4 py-3 font-mono text-sm text-[#1a1a1a] overflow-hidden text-ellipsis whitespace-nowrap">
                      {affiliateLink}
                    </div>
                    <button onClick={copyLink}
                      className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${copied
                        ? "bg-emerald-500 text-white"
                        : "bg-[#006859] text-white hover:bg-[#005245]"
                        }`}>
                      {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy</>}
                    </button>
                  </div>
                </div>

                {/* UPI & Payout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* UPI setup */}
                  <div className="bg-white rounded-2xl border border-[#e0efec] p-6 shadow-sm">
                    <h3 className="font-bold text-[#1a1a1a] mb-1">Payout UPI ID</h3>
                    <p className="text-xs text-[#595c5d] mb-4">Required before you can request a withdrawal.</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="yourname@upi"
                        value={upiValue}
                        onChange={e => setUpiValue(e.target.value)}
                        className="flex-1 bg-[#f5f9f8] border border-[#e0efec] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#006859] transition-colors"
                      />
                      <button onClick={saveUpi} disabled={upiSaving || !upiValue.includes("@")}
                        className="px-4 py-2.5 rounded-xl font-bold text-sm bg-[#006859] text-white disabled:opacity-40 hover:bg-[#005245] transition-all flex items-center gap-1.5">
                        {upiSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : upiSaved ? <><Check className="w-4 h-4" /> Saved</> : "Save"}
                      </button>
                    </div>
                  </div>

                  {/* Withdraw */}
                  <div className="bg-white rounded-2xl border border-[#e0efec] p-6 shadow-sm">
                    <h3 className="font-bold text-[#1a1a1a] mb-1">Request Withdrawal</h3>
                    <p className="text-xs text-[#595c5d] mb-4">Minimum ₹300. Credited to your UPI within 24 hours.</p>

                    <AnimatePresence mode="wait">
                      {payoutResult ? (
                        <motion.div key="result" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                          className={`flex items-start gap-3 p-4 rounded-xl text-sm ${payoutResult.ok ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
                          {payoutResult.ok
                            ? <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                            : <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />}
                          <p className={payoutResult.ok ? "text-emerald-700 font-medium" : "text-red-700 font-medium"}>
                            {payoutResult.message}
                          </p>
                        </motion.div>
                      ) : (
                        <motion.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <button onClick={requestPayout} disabled={!canWithdraw || payoutLoading}
                            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${canWithdraw
                              ? "bg-gradient-to-r from-[#006859] to-[#0d9e84] text-white hover:shadow-lg hover:shadow-[#006859]/30 hover:scale-[1.01]"
                              : "bg-[#f5f9f8] text-[#595c5d] border border-[#e0efec] cursor-not-allowed"
                              }`}>
                            {payoutLoading
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <><IndianRupee className="w-4 h-4" /> Withdraw {balance >= 300 ? formatINR(balance) : "(min ₹300)"}</>
                            }
                          </button>
                          {!affiliateData?.upi_id && (
                            <p className="text-xs text-amber-600 mt-2 text-center">⚠ Save your UPI ID above first</p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Conversions */}
                {affiliateData.conversions.length > 0 && (
                  <div className="bg-white rounded-2xl border border-[#e0efec] p-6 shadow-sm">
                    <h3 className="font-bold text-[#1a1a1a] mb-4">Conversion History</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#f0f0f0]">
                            <th className="text-left text-xs text-[#595c5d] font-semibold pb-3 uppercase tracking-wider">Plan</th>
                            <th className="text-left text-xs text-[#595c5d] font-semibold pb-3 uppercase tracking-wider">Amount</th>
                            <th className="text-left text-xs text-[#595c5d] font-semibold pb-3 uppercase tracking-wider">Commission</th>
                            <th className="text-left text-xs text-[#595c5d] font-semibold pb-3 uppercase tracking-wider">Status</th>
                            <th className="text-left text-xs text-[#595c5d] font-semibold pb-3 uppercase tracking-wider">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f8f8f8]">
                          {affiliateData.conversions.map((c, i) => (
                            <tr key={i}>
                              <td className="py-3 capitalize font-medium text-[#1a1a1a]">{c.plan_type.replace("_", " ")}</td>
                              <td className="py-3 text-[#595c5d]">₹{c.plan_amount}</td>
                              <td className="py-3 font-bold text-[#006859]">+₹{c.commission_amount}</td>
                              <td className="py-3">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${c.status === "paid_out" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                                  {c.status === "paid_out" ? "Paid out" : "Credited"}
                                </span>
                              </td>
                              <td className="py-3 text-[#595c5d] text-xs">{timeAgo(c.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Payouts */}
                {affiliateData.payouts.length > 0 && (
                  <div className="bg-white rounded-2xl border border-[#e0efec] p-6 shadow-sm">
                    <h3 className="font-bold text-[#1a1a1a] mb-4">Payout History</h3>
                    <div className="space-y-3">
                      {affiliateData.payouts.map((p, i) => (
                        <div key={i} className="flex items-center justify-between py-3 border-b border-[#f8f8f8] last:border-0">
                          <div>
                            <p className="font-bold text-[#1a1a1a]">{formatINR(p.amount)}</p>
                            <p className="text-xs text-[#595c5d] font-mono">{p.upi_id}</p>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${p.status === "processed" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                              {p.status === "processed" ? "✓ Processed" : "⏳ Pending"}
                            </span>
                            <p className="text-xs text-[#595c5d] mt-1">{timeAgo(p.requested_at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </motion.div>
            ) : null}
          </section>
        )}

        {/* ── Public Affiliates Wall ── */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-black text-[#1a1a1a]">
                Active Creators <span className="text-[#006859]">({publicAffiliates.length})</span>
              </h2>
              <p className="text-sm text-[#595c5d] mt-1">Real creators already earning with FlashResume</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#595c5d]" />
              <input
                type="text"
                placeholder="Search by name or email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2.5 bg-white border border-[#e0efec] rounded-xl text-sm outline-none focus:border-[#006859] transition-colors w-full sm:w-64"
              />
            </div>
          </div>

          {filteredAffiliates.length === 0 ? (
            <div className="text-center py-12 text-[#595c5d]">
              {publicAffiliates.length === 0 ? "Be the first creator to join!" : "No creators match your search."}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredAffiliates.map((a, i) => (
                <motion.div key={a.affiliate_code}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="bg-white rounded-2xl border border-[#e0efec] p-5 flex flex-col items-center text-center gap-3 shadow-sm hover:shadow-md hover:border-[#006859]/30 transition-all duration-200">
                  {a.avatar_url ? (
                    <img src={a.avatar_url} alt={a.name} className="w-12 h-12 rounded-full border-2 border-[#e0efec]" />
                  ) : (
                    <AvatarFallback name={a.name} size={48} />
                  )}
                  <div>
                    <p className="font-bold text-[#1a1a1a] text-sm leading-tight">{a.name}</p>
                    <p className="text-xs text-[#595c5d] mt-0.5 truncate max-w-[150px]">{a.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-[#006859]/8 text-[#006859] text-xs font-black px-3 py-1 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified Affiliate
                  </div>
                  <div className="text-xs text-[#595c5d]">Joined {timeAgo(a.created_at)}</div>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* ── Contact / trust footer ── */}
        <section className="bg-gradient-to-br from-[#006859] to-[#0d9e84] rounded-3xl p-8 md:p-12 text-center shadow-2xl shadow-[#006859]/20">
          <h2 className="text-2xl md:text-3xl font-black text-white mb-3">Questions? We&apos;re here.</h2>
          <p className="text-white/80 text-base mb-6 max-w-md mx-auto">
            Reach out and we&apos;ll get back to you within a few hours. We pay every valid payout within 24 hours, no exceptions.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="mailto:flashresume.in@gmail.com"
              className="flex items-center gap-2 bg-white text-[#006859] font-bold px-6 py-3 rounded-xl hover:shadow-lg transition-all text-sm">
              <Mail className="w-4 h-4" /> flashresume.in@gmail.com
            </a>
            <a href="/"
              className="flex items-center gap-2 border-2 border-white/40 text-white font-bold px-6 py-3 rounded-xl hover:bg-white/10 transition-all text-sm">
              <ExternalLink className="w-4 h-4" /> Visit FlashResume
            </a>
          </div>
        </section>

      </main>

      <footer className="text-center text-xs text-[#595c5d] py-6 border-t border-[#e0efec] mt-8">
        © {new Date().getFullYear()} FlashResume · Affiliate Program · Payouts within 24 hours
      </footer>
    </div>
  );
}
