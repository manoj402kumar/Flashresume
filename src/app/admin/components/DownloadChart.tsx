"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Calendar } from "lucide-react";

type Filter = "daily" | "weekly" | "monthly";

const MOCK: Record<Filter, { label: string; value: number }[]> = {
  daily: [
    { label: "Mon", value: 45 }, { label: "Tue", value: 62 },
    { label: "Wed", value: 38 }, { label: "Thu", value: 71 },
    { label: "Fri", value: 55 }, { label: "Sat", value: 83 },
    { label: "Sun", value: 94 },
  ],
  weekly: [
    { label: "Wk 1", value: 285 }, { label: "Wk 2", value: 342 },
    { label: "Wk 3", value: 298 }, { label: "Wk 4", value: 356 },
  ],
  monthly: [
    { label: "May", value: 120 }, { label: "Jun", value: 145 },
    { label: "Jul", value: 189 }, { label: "Aug", value: 234 },
    { label: "Sep", value: 267 }, { label: "Oct", value: 312 },
    { label: "Nov", value: 298 }, { label: "Dec", value: 345 },
    { label: "Jan", value: 389 }, { label: "Feb", value: 423 },
    { label: "Mar", value: 456 }, { label: "Apr", value: 502 },
  ],
};

const FILTERS: { id: Filter; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

export default function DownloadChart() {
  const [filter, setFilter] = useState<Filter>("daily");
  const data = MOCK[filter];
  const max = Math.max(...data.map((d) => d.value));
  const [tooltip, setTooltip] = useState<{ label: string; value: number } | null>(null);

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
          {/* Custom date (future) */}
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#595c5d] border border-[#eff1f2] hover:border-[#006859]/30 transition-colors">
            <Calendar className="w-3.5 h-3.5" />
            Custom
          </button>
        </div>
      </div>

      {/* Tooltip */}
      <div className="h-5 text-center text-sm font-bold text-[#006859]">
        {tooltip ? `${tooltip.label}: ${tooltip.value} downloads` : ""}
      </div>

      {/* Bar Chart */}
      <div className="flex items-end gap-2 h-44">
        {data.map((d, i) => {
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
        * Simulated data — wire to DB for real analytics
      </p>
    </div>
  );
}
