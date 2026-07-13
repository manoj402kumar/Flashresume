"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Users, FileText, ShoppingCart, CheckCircle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function FunnelChart() {
  const [stats, setStats] = useState({ landing: 0, result: 0, purchases: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFunnelStats = () => {
      fetch(`/api/admin-proxy/funnel-stats`)
        .then(res => res.json())
        .then(data => {
          setStats(data.landing !== undefined ? data : { landing: 0, result: 0, purchases: 0 });
          setLoading(false);
        })
        .catch(e => {
          console.error("Funnel stats fetch failed", e);
          setLoading(false);
        });
    };
    
    fetchFunnelStats();
  }, []);

  const STAGES = [
    {
      id: "visited",
      label: "Visited Site",
      icon: Users,
      value: stats.landing,
      color: "from-[#006859] to-[#0d9e84]",
      textColor: "text-[#006859]",
      widthPct: 100,
    },
    {
      id: "result",
      label: "Reached /result or /scratch",
      icon: FileText,
      value: stats.result,
      color: "from-[#12f8d7] to-[#0de8cc]",
      textColor: "text-[#0d9e84]",
      widthPct: stats.landing > 0 ? Math.min((stats.result / stats.landing) * 100, 100) : 0,
    },
    {
      id: "purchased",
      label: "Completed Purchase",
      icon: ShoppingCart,
      value: stats.purchases,
      color: "from-purple-500 to-purple-400",
      textColor: "text-purple-600",
      widthPct: stats.landing > 0 ? Math.min((stats.purchases / stats.landing) * 100, 100) : 0,
    },
  ];

  const visitToResult = stats.landing > 0 ? ((stats.result / stats.landing) * 100).toFixed(1) : "0.0";
  const resultToPurchase = stats.result > 0 ? ((stats.purchases / stats.result) * 100).toFixed(1) : "0.0";

  return (
    <div className="bg-white rounded-[1.5rem] p-6 border border-[#eff1f2] shadow-sm space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-headline text-xl font-bold text-[#2c2f30]">Conversion Funnel</h2>
          <p className="text-sm text-[#595c5d]">New users conversion pipeline</p>
        </div>
        <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
          <CheckCircle className="w-3 h-3" />
          Live Data
        </span>
      </div>

      {loading ? (
        <div className="text-sm text-[#595c5d] text-center py-4">Loading data...</div>
      ) : (
        <div className="space-y-4">
          {STAGES.map((stage, i) => {
            const Icon = stage.icon;
            const convRate =
              i === 0
                ? "100%"
                : `${((stage.value / Math.max(1, STAGES[0].value)) * 100).toFixed(1)}% of visitors`;

            return (
              <div key={stage.id}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-lg bg-gradient-to-br ${stage.color} flex items-center justify-center`}
                    >
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#2c2f30]">{stage.label}</div>
                      <div className="text-xs text-[#595c5d]">{convRate}</div>
                    </div>
                  </div>
                  <div className={`text-xl font-bold font-headline ${stage.textColor}`}>
                    {stage.value.toLocaleString("en-IN")}
                  </div>
                </div>

                {/* Funnel bar — narrows with each stage */}
                <div
                  className="overflow-hidden rounded-full h-4 bg-[#eff1f2]"
                  style={{ maxWidth: "100%" }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${stage.widthPct}%` }}
                    transition={{ duration: 0.8, delay: i * 0.18, ease: "easeOut" }}
                    className={`h-full rounded-full bg-gradient-to-r ${stage.color}`}
                  />
                </div>

                {/* Conversion arrow between stages */}
                {i < STAGES.length - 1 && (
                  <div className="text-center text-xs text-[#595c5d] mt-2 font-medium">
                    ↓ {((STAGES[i + 1].value / Math.max(1, stage.value)) * 100).toFixed(1)}% continued
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#eff1f2]">
          <div className="text-center">
            <div className="text-2xl font-bold font-headline text-[#006859]">{visitToResult}%</div>
            <div className="text-xs text-[#595c5d] font-medium">Visit → Result rate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold font-headline text-purple-600">{resultToPurchase}%</div>
            <div className="text-xs text-[#595c5d] font-medium">Result → Purchase rate</div>
          </div>
        </div>
      )}

      <p className="text-xs text-[#595c5d]/70">
        * Aggregated securely from real page visits and successful payments
      </p>
    </div>
  );
}
