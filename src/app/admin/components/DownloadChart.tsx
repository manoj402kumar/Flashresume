"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { CheckCircle } from "lucide-react";

type Filter = "daily" | "weekly" | "monthly";
type DataPoint = { label: string; value: number };

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

export default function DownloadChart() {
  const [filter, setFilter] = useState<Filter>("daily");
  const [trends, setTrends] = useState<Record<Filter, DataPoint[]>>({
    daily: [],
    weekly: [],
    monthly: []
  });
  const [tooltip, setTooltip] = useState<{ label: string; value: number } | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/admin/download-trends`)
      .then((res) => res.json())
      .then((data) => setTrends(data))
      .catch((e) => console.error("Failed to fetch download trends", e));
  }, []);

  const data = trends[filter] || [];
  const max = data.length > 0 ? Math.max(...data.map((d) => d.value)) : 0;

  return (
    <div className="bg-white rounded-[1.5rem] p-6 border border-[#eff1f2] shadow-sm space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-headline text-xl font-bold text-[#2c2f30]">Resume Downloads</h2>
          <p className="text-sm text-[#595c5d]">Total downloads by time period</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter tabs */}
          <div className="flex p-1 bg-[#eff1f2] rounded-xl gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  filter === f.id
                    ? "bg-white text-[#006859] shadow-sm"
                    : "text-[#595c5d] hover:text-[#2c2f30]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5" />
            Live Data
          </span>
        </div>
      </div>

      {/* Tooltip */}
      <div className="h-5 text-center text-sm font-bold text-[#006859]">
        {tooltip ? `${tooltip.label}: ${tooltip.value} downloads` : ""}
      </div>

      {/* Bar Chart */}
      <div className="flex items-end gap-2 h-44">
        {data.length === 0 ? (
           <div className="w-full h-full flex items-center justify-center text-sm text-[#595c5d]">Loading data...</div>
        ) : data.map((d, i) => {
          const heightPct = max > 0 ? (d.value / max) * 100 : 0;
          return (
            <div
              key={`${filter}-${i}`}
              className="flex-1 flex flex-col items-center gap-1 group cursor-pointer"
              onMouseEnter={() => setTooltip(d)}
              onMouseLeave={() => setTooltip(null)}
            >
              <div className="relative w-full flex items-end justify-center" style={{ height: "160px" }}>
                <motion.div
                  key={`${filter}-${i}-bar`}
                  initial={{ height: 0 }}
                  animate={{ height: `${heightPct}%` }}
                  transition={{ duration: 0.5, delay: i * 0.04, ease: "easeOut" }}
                  className="w-full rounded-t-lg bg-gradient-to-t from-[#006859] to-[#12f8d7] group-hover:opacity-80 transition-opacity"
                />
              </div>
              <span className="text-[10px] font-medium text-[#595c5d]">{d.label}</span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-[#595c5d]/70 text-right">
        * Accurately tracks downloads across all users on the platform
      </p>
    </div>
  );
}
