"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { IndianRupee, CheckCircle2, Clock, Loader2, Users, TrendingUp, AlertCircle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface PayoutRow {
  id: string;
  amount: number;
  upi_id: string;
  status: string;
  requested_at: string;
  processed_at: string | null;
  admin_note: string | null;
  affiliates: {
    name: string;
    email: string;
    affiliate_code: string;
  } | null;
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

export default function AffiliatePanel() {
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPayouts();
  }, []);

  async function loadPayouts() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/affiliate/admin/payouts`);
      const data = await res.json();
      setPayouts(Array.isArray(data) ? data : []);
    } catch {
      setError("Failed to load payout requests.");
    }
    setLoading(false);
  }

  async function markProcessed(payoutId: string) {
    setProcessing(payoutId);
    try {
      const res = await fetch(`${API_URL}/api/affiliate/admin/mark-processed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payout_id: payoutId, admin_note: "Manually sent via UPI" }),
      });
      if (res.ok) {
        setPayouts(prev =>
          prev.map(p => p.id === payoutId ? { ...p, status: "processed", processed_at: new Date().toISOString() } : p)
        );
      }
    } catch {
      setError("Failed to mark as processed.");
    }
    setProcessing(null);
  }

  const pending = payouts.filter(p => p.status === "pending");
  const processed = payouts.filter(p => p.status === "processed");
  const totalPendingAmount = pending.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-[#eff1f2] p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-[#595c5d] font-semibold uppercase tracking-wider">Pending Payouts</p>
            <p className="text-2xl font-black text-[#2c2f30]">{pending.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[#eff1f2] p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center">
            <IndianRupee className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="text-xs text-[#595c5d] font-semibold uppercase tracking-wider">Pending Amount</p>
            <p className="text-2xl font-black text-[#2c2f30]">₹{totalPendingAmount.toFixed(0)}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[#eff1f2] p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-[#595c5d] font-semibold uppercase tracking-wider">Total Processed</p>
            <p className="text-2xl font-black text-[#2c2f30]">{processed.length}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Pending payouts — action required */}
      {pending.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
            </span>
            <h3 className="font-bold text-[#2c2f30]">Action Required — Pending Payouts ({pending.length})</h3>
          </div>
          <div className="space-y-3">
            {pending.map(p => (
              <motion.div key={p.id} layout
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-[#2c2f30]">{p.affiliates?.name || "Unknown"}</span>
                    <span className="text-xs text-[#595c5d] font-mono">{p.affiliates?.email}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-[#595c5d]">
                    <span className="font-mono bg-white px-2 py-0.5 rounded-lg border border-amber-200">{p.upi_id}</span>
                    <span>Requested {timeAgo(p.requested_at)}</span>
                    <span className="font-bold text-[#006859]">Code: {p.affiliates?.affiliate_code}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-black text-[#2c2f30]">₹{Number(p.amount).toFixed(0)}</span>
                  <button
                    onClick={() => markProcessed(p.id)}
                    disabled={processing === p.id}
                    className="flex items-center gap-2 bg-[#006859] text-white font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-[#005245] transition-all disabled:opacity-50">
                    {processing === p.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <><CheckCircle2 className="w-4 h-4" /> Mark Processed</>
                    }
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* All payouts history */}
      <div className="bg-white rounded-2xl border border-[#eff1f2] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-[#2c2f30]">All Payout Requests</h3>
          <button onClick={loadPayouts} className="text-xs text-[#006859] font-semibold hover:underline">Refresh</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#006859]" />
          </div>
        ) : payouts.length === 0 ? (
          <p className="text-center text-[#595c5d] text-sm py-8">No payout requests yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#eff1f2]">
                  {["Affiliate", "UPI", "Amount", "Status", "Requested", "Processed"].map(h => (
                    <th key={h} className="text-left text-xs text-[#595c5d] font-semibold pb-3 uppercase tracking-wider pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f5f6f7]">
                {payouts.map(p => (
                  <tr key={p.id}>
                    <td className="py-3 pr-4">
                      <div className="font-medium text-[#2c2f30]">{p.affiliates?.name || "—"}</div>
                      <div className="text-xs text-[#595c5d]">{p.affiliates?.email}</div>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-[#595c5d]">{p.upi_id}</td>
                    <td className="py-3 pr-4 font-black text-[#2c2f30]">₹{Number(p.amount).toFixed(0)}</td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${p.status === "processed" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {p.status === "processed" ? "✓ Processed" : "⏳ Pending"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-xs text-[#595c5d]">{timeAgo(p.requested_at)}</td>
                    <td className="py-3 text-xs text-[#595c5d]">{p.processed_at ? timeAgo(p.processed_at) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
