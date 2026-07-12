"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { supabase } from "@/lib/supabase";
import {
  X, User, Zap, CreditCard, Calendar, Plus, Trash2,
  ExternalLink, ChevronDown, Briefcase, BarChart3, Loader2,
  CheckCircle2, Clock, XCircle, MessageSquare, Send, CloudOff, Cloud
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type AppStatus = "Applied" | "Interview" | "Offer" | "Rejected" | "No Response" | "";

interface JobApplication {
  id: string;           // uuid from Supabase or local id for guests
  sno: number;
  company: string;
  job_role: string;
  job_url: string;
  applied_date: string;
  status: AppStatus;
}

interface ProfileData {
  email: string;
  plan: string;
  credits: number | null;
  validUntil: string | null;
  referralStats: { count: number; earned: number };
}

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  credits: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  "Applied":     { label: "Applied",     bg: "bg-amber-500/15",   text: "text-amber-600",  icon: <Send className="w-3 h-3" /> },
  "Interview":   { label: "Interview",   bg: "bg-blue-500/15",    text: "text-blue-600",   icon: <MessageSquare className="w-3 h-3" /> },
  "Offer":       { label: "Offer",       bg: "bg-emerald-500/15", text: "text-emerald-600",icon: <CheckCircle2 className="w-3 h-3" /> },
  "Rejected":    { label: "Rejected",    bg: "bg-red-500/15",     text: "text-red-500",    icon: <XCircle className="w-3 h-3" /> },
  "No Response": { label: "No Response", bg: "bg-gray-500/15",    text: "text-gray-500",   icon: <Clock className="w-3 h-3" /> },
  "":            { label: "— Pick —",    bg: "bg-surface-container", text: "text-on-surface-variant", icon: null },
};

// ─── Application Tracker ─────────────────────────────────────────────────────

export function ApplicationTracker({ userId }: { userId: string }) {
  const [apps, setApps] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(true);
  const statusDropdownRef = useRef<HTMLDivElement | null>(null);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!userId) return; // Wait until userId is available

    // Logged-in: load from Supabase
    (async () => {
      const { data, error } = await supabase
        .from("job_applications")
        .select("*")
        .eq("user_id", userId)
        .order("sno", { ascending: true });

      if (!error && data) {
        setApps(data.map(r => ({
          id: r.id,
          sno: r.sno,
          company: r.company || "",
          job_role: r.job_role || "",
          job_url: r.job_url || "",
          applied_date: r.applied_date || "",
          status: (r.status as AppStatus) || "",
        })));
      }
      setLoading(false);
    })();
  }, [userId]);

  // ── Add new row ───────────────────────────────────────────────────────────

  const addRow = async () => {
    const nextSno = apps.length > 0 ? Math.max(...apps.map(a => a.sno)) + 1 : 1;
    const newApp: JobApplication = {
      id: "", // Will be replaced by Supabase id immediately
      sno: nextSno,
      company: "", job_role: "", job_url: "", applied_date: "", status: "",
    };

    setSaving(true);
    const { data, error } = await supabase
      .from("job_applications")
      .insert({ user_id: userId, sno: nextSno, company: "", job_role: "", job_url: "", applied_date: null, status: "" })
      .select()
      .single();
    setSaving(false);

    if (!error && data) {
      setApps(prev => [...prev, { ...newApp, id: data.id }]);
    }
  };

  // ── Update a field ────────────────────────────────────────────────────────
  // Strategy: update local state immediately, debounce Supabase upsert 600ms

  const updateField = useCallback((id: string, field: keyof JobApplication, value: string | number) => {
    setApps(prev => {
      const updated = prev.map(a => a.id === id ? { ...a, [field]: value } : a);

      // Debounce DB write — clear existing timer for this row
      if (debounceTimers.current[id]) clearTimeout(debounceTimers.current[id]);
      debounceTimers.current[id] = setTimeout(async () => {
        // Find current row in latest state
        const row = updated.find(a => a.id === id);
        if (!row) return;
        setSaving(true);
        await supabase.from("job_applications").upsert({
          id: row.id,
          user_id: userId,
          sno: row.sno,
          company: row.company,
          job_role: row.job_role,
          job_url: row.job_url,
          applied_date: row.applied_date || null,
          status: row.status,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" });
        setSaving(false);
      }, 600);

      return updated;
    });
  }, [userId]);

  // ── Status change (immediate save — no debounce) ──────────────────────────

  const updateStatus = async (id: string, status: AppStatus) => {
    setApps(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    setOpenStatusId(null);

    setSaving(true);
    await supabase.from("job_applications")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    setSaving(false);
  };

  // ── Delete row ────────────────────────────────────────────────────────────

  const deleteRow = async (id: string) => {
    setApps(prev => prev.filter(a => a.id !== id));
    await supabase.from("job_applications").delete().eq("id", id);
  };

  // ── Close status dropdown on outside click ────────────────────────────────

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setOpenStatusId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Derived stats ─────────────────────────────────────────────────────────

  const statusCounts = Object.keys(STATUS_CONFIG).filter(s => s !== "").reduce((acc, s) => {
    acc[s] = apps.filter(a => a.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <Loader2 className="w-7 h-7 text-primary animate-spin" />
        <p className="text-sm text-on-surface-variant">Loading your applications…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col">
        <div className="flex items-center justify-between">
          {/* Storage indicator */}
          <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full w-fit bg-emerald-500/10 text-emerald-600">
            <Cloud className="w-3 h-3" />
            {saving ? "Saving…" : "✓ Synced to cloud"}
          </div>

          {/* Toggle Stats Button */}
          {apps.length > 0 && (
            <button
              type="button"
              onClick={() => setShowStats(!showStats)}
              aria-label="Toggle application stats"
              aria-expanded={showStats}
              className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-background hover:bg-surface-container-low transition-colors"
            >
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showStats ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>

        {/* Summary Stats */}
        <AnimatePresence>
          {apps.length > 0 && showStats && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-4">
                {Object.entries(STATUS_CONFIG).filter(([k]) => k !== "").map(([status, cfg]) => (
                  <div key={status} className={`${cfg.bg} rounded-xl p-2.5 text-center border border-current/10`}>
                    <p className={`text-lg font-black ${cfg.text}`}>{statusCounts[status] || 0}</p>
                    <p className={`text-[10px] font-bold ${cfg.text} opacity-80`}>{cfg.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-on-surface-variant/15 overflow-visible">
        {/* Header row */}
        <div className="hidden md:grid grid-cols-[36px_1fr_1fr_1fr_110px_130px_36px] gap-0 bg-surface-container-low border-b border-on-surface-variant/10 px-3 py-2 rounded-t-2xl">
          {["#", "Company", "Job Role", "Job URL", "Applied Date", "Status", ""].map((h, i) => (
            <span key={i} className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant truncate px-1">{h}</span>
          ))}
        </div>

        {/* Empty state */}
        {apps.length === 0 ? (
          <div className="py-12 text-center">
            <Briefcase className="w-8 h-8 text-on-surface-variant/30 mx-auto mb-2" />
            <p className="text-sm text-on-surface-variant font-medium">No applications yet</p>
            <p className="text-xs text-on-surface-variant/60 mt-1">Click &quot;+ Add Application&quot; to start tracking</p>
          </div>
        ) : (
          <div className="divide-y divide-on-surface-variant/8">
            {apps.map((app, idx) => {
              const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG[""];
              return (
                <motion.div
                  key={app.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="flex flex-col md:grid md:grid-cols-[36px_1fr_1fr_1fr_110px_130px_36px] gap-3 md:gap-0 p-4 md:px-3 md:py-1.5 items-start md:items-center hover:bg-surface-container-lowest/50 transition-colors border-b border-on-surface-variant/10 md:border-b-0 last:border-b-0"
                >
                  {/* Mobile Header: # and Delete */}
                  <div className="flex md:hidden w-full items-center justify-between mb-1">
                    <span className="text-xs font-bold text-on-surface-variant/60 text-center">#{app.sno}</span>
                    <button
                      type="button"
                      onClick={() => deleteRow(app.id)}
                      className="flex items-center justify-center p-1 text-on-surface-variant/30 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Desktop S.No */}
                  <span className="hidden md:block text-xs font-bold text-on-surface-variant/60 text-center">{app.sno}</span>

                  {/* Company */}
                  <div className="w-full">
                    <span className="md:hidden text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">Company</span>
                    <input
                      value={app.company}
                      onChange={e => updateField(app.id, "company", e.target.value)}
                      placeholder="Company"
                      className="text-sm md:text-xs font-medium text-on-background bg-surface-container-lowest md:bg-transparent border border-on-surface-variant/10 md:border-0 outline-none px-3 md:px-1 py-2 md:py-1 w-full placeholder:text-on-surface-variant/30 focus:ring-1 focus:ring-primary/30 rounded-lg md:rounded"
                    />
                  </div>

                  {/* Job Role */}
                  <div className="w-full">
                    <span className="md:hidden text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">Job Role</span>
                    <input
                      value={app.job_role}
                      onChange={e => updateField(app.id, "job_role", e.target.value)}
                      placeholder="Role"
                      className="text-sm md:text-xs font-medium text-on-background bg-surface-container-lowest md:bg-transparent border border-on-surface-variant/10 md:border-0 outline-none px-3 md:px-1 py-2 md:py-1 w-full placeholder:text-on-surface-variant/30 focus:ring-1 focus:ring-primary/30 rounded-lg md:rounded"
                    />
                  </div>

                  {/* Job URL */}
                  <div className="w-full">
                    <span className="md:hidden text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">Job URL</span>
                    <div className="flex items-center gap-2 md:gap-1 px-1">
                      <input
                        value={app.job_url}
                        onChange={e => updateField(app.id, "job_url", e.target.value)}
                        placeholder="https://…"
                        className="text-sm md:text-xs font-medium text-on-background bg-surface-container-lowest md:bg-transparent border border-on-surface-variant/10 md:border-0 outline-none px-3 md:px-1 py-2 md:py-1 w-full placeholder:text-on-surface-variant/30 focus:ring-1 focus:ring-primary/30 rounded-lg md:rounded min-w-0"
                      />
                      {app.job_url && (
                        <a href={app.job_url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 p-2 md:p-0 bg-surface-container-low md:bg-transparent rounded-lg md:rounded-none">
                          <ExternalLink className="w-4 h-4 md:w-3 md:h-3 text-[#006859]/60 hover:text-[#006859] transition-colors" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Applied Date */}
                  <div className="w-full">
                    <span className="md:hidden text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">Applied Date</span>
                    <input
                      type="date"
                      value={app.applied_date}
                      onChange={e => updateField(app.id, "applied_date", e.target.value)}
                      className="text-sm md:text-xs font-medium text-on-background bg-surface-container-lowest md:bg-transparent border border-on-surface-variant/10 md:border-0 outline-none px-3 md:px-1 py-2 md:py-1 w-full focus:ring-1 focus:ring-primary/30 rounded-lg md:rounded cursor-pointer"
                    />
                  </div>

                  {/* Status dropdown */}
                  <div className="w-full relative md:px-1" ref={openStatusId === app.id ? statusDropdownRef : null}>
                    <span className="md:hidden text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">Status</span>
                    <button
                      type="button"
                      onClick={() => setOpenStatusId(openStatusId === app.id ? null : app.id)}
                      className={`w-full flex items-center justify-between md:justify-start gap-2 md:gap-1 px-3 md:px-2 py-2 md:py-1 rounded-lg text-sm md:text-[10px] font-bold ${cfg.bg} ${cfg.text} transition-all border border-transparent md:border-0`}
                    >
                      <div className="flex items-center gap-2 md:gap-1">
                        {cfg.icon}
                        <span className="flex-1 text-left truncate">{cfg.label}</span>
                      </div>
                      <ChevronDown className="w-4 h-4 md:w-3 md:h-3 flex-shrink-0 opacity-60" />
                    </button>

                    <AnimatePresence>
                      {openStatusId === app.id && (
                        <motion.div
                          initial={{ opacity: 0, y: -4, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.95 }}
                          className="absolute bottom-full left-0 mb-1 w-full md:w-36 bg-surface border border-surface-container-high rounded-xl shadow-xl z-50 overflow-hidden"
                        >
                          {(["Applied", "Interview", "Offer", "Rejected", "No Response"] as AppStatus[]).map(s => {
                            const sc = STATUS_CONFIG[s];
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => updateStatus(app.id, s)}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-bold hover:bg-surface-container-low transition-colors ${sc.text} ${app.status === s ? sc.bg : ""}`}
                              >
                                {sc.icon} {sc.label}
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Desktop Delete */}
                  <button
                    type="button"
                    onClick={() => deleteRow(app.id)}
                    className="hidden md:flex items-center justify-center p-1 text-on-surface-variant/30 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add row */}
      <button
        type="button"
        onClick={addRow}
        className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-primary/25 rounded-2xl text-sm font-bold text-primary/60 hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all"
      >
        <Plus className="w-4 h-4" />
        Add Application
      </button>

      <p className="text-center text-[11px] text-on-surface-variant/50">
        All fields are optional · Changes auto-save as you type
      </p>
    </div>
  );
}

// ─── Profile Tab ─────────────────────────────────────────────────────────────

export function ProfileTab({ userEmail, credits }: { userEmail: string; credits: number }) {
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setLoading(false); return; }

      let plan = "Free";
      let validUntil: string | null = null;
      let referralStats = { count: 0, earned: 0 };

      try {
        const { data: subData } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", session.user.id)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (subData) {
          plan = subData.plan_type === "regular" ? "Pro Monthly"
            : subData.plan_type === "student" ? "Student Plan"
            : subData.plan_type === "pay_per_use" ? "Pay Per Use" : "Free";
          validUntil = subData.expires_at;
        }
      } catch { }

      try {
        const { data: rewardData } = await supabase
          .from("referral_rewards")
          .select("credits_awarded")
          .eq("referrer_id", session.user.id);
        if (rewardData) {
          const earned = rewardData.reduce((acc, curr) => acc + (curr.credits_awarded || 0), 0);
          referralStats = { count: rewardData.length, earned };
        }
      } catch { }

      setProfileData({ email: userEmail, plan, credits, validUntil, referralStats });
      setLoading(false);
    }
    load();
  }, [userEmail, credits]);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-primary animate-spin" /></div>;
  }

  if (!profileData) return null;

  const initials = profileData.email ? profileData.email.slice(0, 2).toUpperCase() : "?";

  const planColors: Record<string, string> = {
    "Pro Monthly":  "bg-violet-500/15 text-violet-600 border-violet-400/30",
    "Student Plan": "bg-amber-500/15 text-amber-600 border-amber-400/30",
    "Pay Per Use":  "bg-blue-500/15 text-blue-600 border-blue-400/30",
    "Free":         "bg-gray-500/15 text-gray-500 border-gray-400/20",
  };

  return (
    <div className="space-y-5">
      {/* Avatar + Email */}
      <div className="flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-[#006859]/5 to-[#12f8d7]/5 border border-[#006859]/10">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#006859] to-[#12f8d7] flex items-center justify-center text-white text-xl font-black flex-shrink-0 shadow-lg shadow-[#006859]/20">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Account</p>
          <p className="text-base font-bold text-on-background break-all">{profileData.email}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-surface-container-low border border-[#006859]/10 flex flex-col items-center text-center">
          <Zap className="w-5 h-5 text-[#006859] mb-2" />
          <p className="text-3xl font-black text-on-background">{profileData.credits ?? "—"}</p>
          <p className="text-xs text-on-surface-variant font-semibold mt-1">Available Credits</p>
        </div>
        <div className="p-4 rounded-2xl bg-surface-container-low border border-[#006859]/10 flex flex-col items-center text-center">
          <CreditCard className="w-5 h-5 text-[#006859] mb-2" />
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black border ${planColors[profileData.plan] || planColors["Free"]}`}>
            {profileData.plan}
          </span>
          <p className="text-xs text-on-surface-variant font-semibold mt-2">Current Plan</p>
        </div>
      </div>

      {profileData.validUntil && profileData.plan !== "Free" && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-surface-container-low border border-[#006859]/10">
          <Calendar className="w-5 h-5 text-[#006859] flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Valid Until</p>
            <p className="text-sm font-bold text-on-background">
              {new Date(profileData.validUntil).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>
      )}

      {profileData.referralStats.count > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-400/20">
          <User className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Referrals</p>
            <p className="text-sm font-bold text-on-background">
              {profileData.referralStats.count} friend{profileData.referralStats.count > 1 ? "s" : ""} referred
              · +{profileData.referralStats.earned} credits earned
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function ProfileModal({ isOpen, onClose, userEmail, credits }: ProfileModalProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "tracker">("profile");
  const [userId, setUserId] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id || "");
    });
  }, []);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-x-4 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[720px] sm:max-h-[88vh] bg-surface rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl z-[201] flex flex-col max-h-[92vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 pt-6 pb-4 border-b border-surface-container-low">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="font-headline text-lg font-bold text-on-background leading-tight">My Profile</h2>
                  <p className="text-xs text-on-surface-variant">Account details &amp; job tracker</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-surface-container-low hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex-shrink-0 flex gap-1 px-6 pt-3 pb-0">
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === "profile" ? "bg-primary text-white shadow-sm" : "text-on-surface-variant hover:bg-surface-container-low"}`}
              >
                <User className="w-4 h-4" /> Profile
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("tracker")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === "tracker" ? "bg-primary text-white shadow-sm" : "text-on-surface-variant hover:bg-surface-container-low"}`}
              >
                <BarChart3 className="w-4 h-4" /> Application Tracker
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <AnimatePresence mode="wait">
                {activeTab === "profile" ? (
                  <motion.div key="profile" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.18 }}>
                    <ProfileTab userEmail={userEmail} credits={credits} />
                  </motion.div>
                ) : (
                  <motion.div key="tracker" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}>
                    <ApplicationTracker userId={userId} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
