"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  LayoutDashboard, Users, IndianRupee, Download,
  Cpu, Filter, Star, Zap, ExternalLink, Menu, X,
  Server, Clock, Send, Loader2,
} from "lucide-react";
import KPICards from "./components/KPICards";
import LLMPanel from "./components/LLMPanel";
import DownloadChart from "./components/DownloadChart";
import RevenuePanel from "./components/RevenuePanel";
import FunnelChart from "./components/FunnelChart";
import FeedbackPanel from "./components/FeedbackPanel";
import AffiliatePanel from "./components/AffiliatePanel";
// supabase import removed — Realtime channel replaced with lightweight backend poll

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const NAV_ITEMS = [
  { id: "overview",   label: "Overview",       icon: LayoutDashboard },
  { id: "revenue",    label: "Revenue",        icon: IndianRupee },
  { id: "downloads",  label: "Downloads",      icon: Download },
  { id: "llm",        label: "LLM Usage",      icon: Cpu },
  { id: "funnel",     label: "Conversion",     icon: Filter },
  { id: "feedback",   label: "Feedback",       icon: Star },
  { id: "cold-email", label: "Cold Emails",    icon: Send },
  { id: "affiliates", label: "Affiliates",     icon: Users },
];

function Sidebar({
  active,
  onSelect,
  open,
  onClose,
}: {
  active: string;
  onSelect: (id: string) => void;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-64 z-40 flex flex-col transition-transform duration-300
          bg-[#0b1e19] text-white
          ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        {/* Logo */}
        <div className="px-6 pt-7 pb-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#006859] to-[#12f8d7] flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white fill-white" />
                </div>
                <span className="font-headline font-extrabold text-lg tracking-tight text-white">
                  Flashresume
                </span>
              </div>
              <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1 ml-9">
                Admin Dashboard
              </div>
            </div>
            <button onClick={onClose} className="md:hidden text-white/50 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { onSelect(item.id); onClose(); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-left ${
                  isActive
                    ? "bg-gradient-to-r from-[#006859] to-[#0d9e84] text-white shadow-lg shadow-[#006859]/30"
                    : "text-white/50 hover:text-white hover:bg-white/8"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#12f8d7]" : ""}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer links */}
        <div className="px-6 py-5 border-t border-white/10 space-y-3">
          <a
            href="/"
            target="_blank"
            className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors font-medium"
          >
            <ExternalLink className="w-3.5 h-3.5" /> View Live App
          </a>
          <a
            href={`${API_URL}/docs`}
            target="_blank"
            className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors font-medium"
          >
            <Server className="w-3.5 h-3.5" /> API Docs (FastAPI)
          </a>
        </div>
      </aside>
    </>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="font-headline text-2xl font-bold text-[#2c2f30]">{title}</h2>
      {subtitle && <p className="text-sm text-[#595c5d] mt-1">{subtitle}</p>}
    </div>
  );
}

export default function AdminPage() {
  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [stats, setStats] = useState({ revenue: 0, downloads: 0, subscribers: 0, totalLogins: 0, totalVisitors: 0, failedPayments: 0, peakConcurrentUsers: 0, peakTimestamp: null as string | null, highRiskUsers: 0 });
  const [uptime, setUptime] = useState("—");
  const [time, setTime] = useState("");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Cold Email Campaign state
  // Today's email stats — sourced from Brevo API (source of truth), resets each day
  const [emailStats, setEmailStats] = useState<{
    today_sent: number; delivered: number; bounces: number; source: string;
  } | null>(null);


  // Live clock
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Poll backend /api/presence/count every 30s for Live Users + Peak cards.
  // This endpoint reads only from in-memory ACTIVE_SESSIONS + peak_record — zero Supabase egress.
  // Replaces the old Supabase Realtime channel which was generating massive egress.
  useEffect(() => {
    const fetchPresence = async () => {
      try {
        const res = await fetch(`${API_URL}/api/presence/count`);
        const json = await res.json();
        setOnlineUsers(json.live ?? 0);
        setStats(prev => ({
          ...prev,
          peakConcurrentUsers: json.peak ?? prev.peakConcurrentUsers,
          peakTimestamp: json.peak_timestamp ?? prev.peakTimestamp,
        }));
      } catch { /* ignore — backend may be cold-starting */ }
    };
    fetchPresence();
    const id = setInterval(fetchPresence, 30000); // every 30 seconds
    return () => clearInterval(id);
  }, []);



  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`/api/admin-proxy/stats`);
        const json = await res.json();
        const sec = json.uptime_seconds ?? 0;
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        setUptime(`${h}h ${m}m`);
        setStats({
          revenue: json.total_revenue ?? 0,
          downloads: json.total_downloads ?? 0,
          subscribers: json.active_subs ?? 0,
          totalLogins: json.total_logins ?? 0,
          totalVisitors: json.total_visitors ?? 0,
          failedPayments: json.failed_payments ?? 0,
          peakConcurrentUsers: json.peak_concurrent_users ?? 0,
          peakTimestamp: json.peak_timestamp ?? null,
          highRiskUsers: json.high_risk_users ?? 0,
        });
      } catch { /* offline */ }
    };
    // Load once on page mount — stats (revenue, downloads etc.) don't need
    // real-time auto-refresh. Reload the page when you need fresh numbers.
    // This eliminates 7 Supabase queries firing every 15 seconds.
    fetchStats();
  }, []);

  // Fetch today's accurate sent count from Brevo API (source of truth)
  const fetchTodaySent = async () => {
    try {
      const res = await fetch("/api/admin-proxy/cold-email-today");
      const json = await res.json();
      setEmailStats({
        today_sent: json.today_sent ?? 0,
        delivered:  json.delivered  ?? 0,
        bounces:    json.bounces    ?? 0,
        source:     json.source     ?? "unknown",
      });
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchTodaySent();
  }, []);

  // Intersection observer for active section highlight
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveSection(e.target.id);
        });
      },
      { threshold: 0.35 }
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const setRef = (id: string) => (el: HTMLElement | null) => {
    sectionRefs.current[id] = el;
  };


  return (
    <div className="min-h-screen bg-[#f5f6f7] font-sans flex">
      <Sidebar
        active={activeSection}
        onSelect={scrollTo}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-[#eff1f2] px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl hover:bg-[#eff1f2] text-[#595c5d]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-headline font-bold text-[#2c2f30] text-base leading-tight">
                Admin Dashboard
              </h1>
              <p className="text-xs text-[#595c5d] font-medium">
                Server uptime: {uptime}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#006859] bg-[#12f8d7]/15 px-3 py-1.5 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#006859] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#006859]" />
              </span>
              Live
            </div>
            <div className="flex items-center gap-1.5 text-xs font-mono text-[#595c5d] bg-[#eff1f2] px-3 py-1.5 rounded-full">
              <Clock className="w-3.5 h-3.5" />
              {time}
            </div>
          </div>
        </header>

        {/* Page body */}
        <main className="flex-1 px-6 py-8 space-y-14 max-w-7xl w-full mx-auto">

          {/* -- Overview ------------------------------------------- */}
          <section id="overview" ref={setRef("overview")}>
            <SectionTitle
              title="Overview"
              subtitle="Platform health at a glance"
            />
            <KPICards onlineUsers={onlineUsers} stats={stats} />
          </section>

          {/* -- Revenue -------------------------------------------- */}
          <section id="revenue" ref={setRef("revenue")}>
            <RevenuePanel />
          </section>

          {/* -- Downloads ------------------------------------------- */}
          <section id="downloads" ref={setRef("downloads")}>
            <DownloadChart />
          </section>

          {/* -- LLM Usage ------------------------------------------ */}
          <section id="llm" ref={setRef("llm")}>
            <LLMPanel />
          </section>

          {/* -- Conversion Funnel ----------------------------------- */}
          <section id="funnel" ref={setRef("funnel")}>
            <FunnelChart />
          </section>

          {/* -- Feedback ------------------------------------------- */}
          <section id="feedback" ref={setRef("feedback")}>
            <FeedbackPanel totalDownloads={stats.downloads} />
          </section>

          {/* -- Cold Email Campaign --------------------------------- */}
          <section id="cold-email" ref={setRef("cold-email")}>
            <SectionTitle
              title="Cold Email Campaign"
              subtitle="Daily cold emails sent to free users via automated Vercel CRON jobs."
            />
            <div className="bg-white rounded-2xl border border-[#eff1f2] p-8 max-w-xl">

              {/* Today's Sent Counter — DB-backed, resets each day */}
              <div className="flex items-center justify-between mb-6 p-4 rounded-xl bg-[#f8fffe] border border-[#006859]/15">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-xs font-bold text-[#595c5d] uppercase tracking-wider">Emails Sent Today</p>
                    {emailStats && (
                      <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${
                        emailStats.source === "brevo_api"
                          ? "bg-[#006859]/10 text-[#006859]"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {emailStats.source === "brevo_api" ? "✓ Brevo" : "DB fallback"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    {emailStats === null ? (
                      <Loader2 className="w-5 h-5 animate-spin text-[#006859]" />
                    ) : (
                      <span className="text-3xl font-black text-[#006859]">{emailStats.today_sent.toLocaleString()}</span>
                    )}
                  </div>
                  {emailStats && emailStats.source === "brevo_api" && (
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-emerald-600 font-bold">✓ {emailStats.delivered.toLocaleString()} delivered</span>
                      {emailStats.bounces > 0 && (
                        <span className="text-[10px] text-red-400 font-bold">✗ {emailStats.bounces} bounced</span>
                      )}
                    </div>
                  )}
                  <p className="text-[10px] text-[#595c5d]/40 mt-0.5">Resets at midnight UTC</p>
                </div>
                <button
                  onClick={fetchTodaySent}
                  className="text-[#006859] hover:bg-[#006859]/10 p-2 rounded-lg transition-colors"
                  title="Refresh count"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                    <path d="M21 3v5h-5"/>
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                    <path d="M8 16H3v5"/>
                  </svg>
                </button>
              </div>

              <div className="flex items-start gap-4 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#006859] to-[#12f8d7] flex items-center justify-center shrink-0">
                  <Send className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-[#2c2f30] text-sm">Automated Schedule</h3>
                  <p className="text-sm text-[#595c5d] mt-0.5">
                    Campaign runs automatically via CRON at <b>4:00 AM</b>, <b>6:00 PM</b>, and <b>7:00 PM (IST)</b>.
                    Picks the oldest free users and queues them via Brevo.
                  </p>
                </div>
              </div>

              <p className="mt-5 text-xs text-[#595c5d]/70">
                ⚠️ Make sure <code className="bg-[#eff1f2] px-1 rounded">BREVO_API_KEY</code> is set in Render env vars.
                Without it the endpoint runs in mock mode (no emails sent).
              </p>
            </div>
          </section>

          {/* -- Affiliates ------------------------------------------ */}
          <section id="affiliates" ref={setRef("affiliates")}>
            <SectionTitle
              title="Affiliates"
              subtitle="Payout requests from creators — send UPI payment then mark as processed"
            />
            <AffiliatePanel />
          </section>

        </main>

        {/* Footer */}
        <footer className="text-center text-xs text-[#595c5d]/60 py-5 border-t border-[#eff1f2]">
          FlashResume Admin · No auth required for local dev · Build in production security before deploying
        </footer>
      </div>
    </div>
  );
}
