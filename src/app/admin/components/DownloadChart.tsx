"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { CheckCircle, Calendar, Download, Users } from "lucide-react";

type TrendPoint = { label: string; value: number };

interface AnalyticsData {
  total_downloads: number;
  unique_users: number;
  downloads_by_plan: {
    regular: number;
    student: number;
    pay_per_use: number;
    free: number;
  };
  downloads_by_category?: {
    jd_optimized: number;
    no_jd: number;
    no_changes: number;
  };
  downloads_by_device?: {
    desktop: number;
    mobile: number;
  };
  trend: TrendPoint[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const TIME_FILTERS = [
  { id: "today", label: "Today" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "all", label: "All Time" },
  { id: "custom", label: "Custom" },
];

export default function DownloadChart() {
  const [data, setData] = useState<AnalyticsData | null>(null);

  const [timeFilter, setTimeFilter] = useState("all");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateError, setDateError] = useState("");

  const [tooltip, setTooltip] = useState<TrendPoint | null>(null);

  useEffect(() => {
    if (timeFilter === "custom") {
      if (!startDate || !endDate) return;
      if (new Date(startDate) > new Date(endDate)) {
        setDateError("Start date must be before end date");
        return;
      }
      setDateError("");
    } else {
      setDateError("");
    }

    let url = `/api/admin-proxy/analytics/downloads?time_filter=${timeFilter}&plan_filter=all`;
    if (timeFilter === "custom" && startDate && endDate) {
      url += `&start_date=${startDate}T00:00:00Z&end_date=${endDate}T23:59:59Z`;
    }

    const fetchDownloads = () =>
      fetch(url)
        .then((res) => res.json())
        .then((d) => setData(d))
        .catch((e) => console.error("Failed to fetch download analytics", e));

    fetchDownloads();
  }, [timeFilter, startDate, endDate]);

  const trend = data?.trend || [];
  const max = trend.length > 0 ? Math.max(...trend.map((d) => d.value)) : 0;

  const dByPlan = data?.downloads_by_plan;

  return (
    <div className="bg-white rounded-[1.5rem] p-6 border border-[#eff1f2] shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-headline text-xl font-bold text-[#2c2f30]">Resume Downloads</h2>
          <p className="text-sm text-[#595c5d]">Downloads and user engagement</p>
        </div>
        <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
          <CheckCircle className="w-3.5 h-3.5" />
          Live Data
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 p-4 bg-surface-container-lowest border border-[#eff1f2] rounded-2xl">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-[#595c5d] uppercase tracking-wider w-12">Time:</span>
            <div className="flex flex-wrap bg-[#eff1f2] p-1 rounded-xl gap-1">
              {TIME_FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setTimeFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${timeFilter === f.id
                    ? "bg-white text-[#006859] shadow-sm"
                    : "text-[#595c5d] hover:text-[#2c2f30]"
                    }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Plan filtering removed */}
        </div>

        {timeFilter === "custom" && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#eff1f2]">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#595c5d]" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs font-medium px-2 py-1 rounded-lg border border-[#eff1f2] outline-none focus:border-[#006859]"
              />
              <span className="text-xs text-[#595c5d]">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs font-medium px-2 py-1 rounded-lg border border-[#eff1f2] outline-none focus:border-[#006859]"
              />
            </div>
            {dateError && <span className="text-xs font-bold text-red-500">{dateError}</span>}
          </div>
        )}
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-blue-500 rounded-2xl p-5 text-white flex flex-col justify-between">
          <div className="text-sm font-medium opacity-80 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Total Downloads
          </div>
          <div className="text-3xl font-bold font-headline mt-2">
            {(data?.total_downloads || 0).toLocaleString("en-IN")}
          </div>
        </div>
        <div className="bg-surface-container-low rounded-2xl p-5 border border-[#eff1f2] flex flex-col justify-between">
          <div className="text-sm font-medium text-[#595c5d] flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            Unique Users
          </div>
          <div className="text-3xl font-bold font-headline text-[#2c2f30] mt-2">
            {(data?.unique_users || 0).toLocaleString("en-IN")}
          </div>
        </div>
      </div>

      {/* Plan Breakdown */}
      {dByPlan && (
        <div className="pt-2">
          <h3 className="text-sm font-bold text-[#2c2f30] mb-3">Downloads by Plan</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-[#eff1f2]/50 rounded-xl p-3 border-l-4 border-[#6750A4]">
              <div className="text-xs text-[#595c5d] mb-1">Standard</div>
              <div className="font-bold text-[#2c2f30]">{dByPlan.regular.toLocaleString("en-IN")}</div>
            </div>
            <div className="bg-[#eff1f2]/50 rounded-xl p-3 border-l-4 border-orange-500">
              <div className="text-xs text-[#595c5d] mb-1">Student</div>
              <div className="font-bold text-[#2c2f30]">{dByPlan.student.toLocaleString("en-IN")}</div>
            </div>
            <div className="bg-[#eff1f2]/50 rounded-xl p-3 border-l-4 border-emerald-500">
              <div className="text-xs text-[#595c5d] mb-1">One-Time</div>
              <div className="font-bold text-[#2c2f30]">{dByPlan.pay_per_use.toLocaleString("en-IN")}</div>
            </div>
            <div className="bg-[#eff1f2]/50 rounded-xl p-3 border-l-4 border-slate-400">
              <div className="text-xs text-[#595c5d] mb-1">Free</div>
              <div className="font-bold text-[#2c2f30]">{(dByPlan.free ?? 0).toLocaleString("en-IN")}</div>
            </div>
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {data?.downloads_by_category && (
        <div className="pt-2">
          <h3 className="text-sm font-bold text-[#2c2f30] mb-3">Downloads by AI Mode</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {/* jd_optimized: user chose "JD Optimize" mode and provided a job description */}
            <div className="bg-[#eff1f2]/50 rounded-xl p-3 border-l-4 border-[#006859]">
              <div className="text-xs text-[#595c5d] mb-1">JD Optimized</div>
              <div className="font-bold text-[#2c2f30]">{data.downloads_by_category.jd_optimized.toLocaleString("en-IN")}</div>
            </div>
            {/* no_changes: user chose "Self Edit" mode — no AI optimization applied */}
            <div className="bg-[#eff1f2]/50 rounded-xl p-3 border-l-4 border-amber-500">
              <div className="text-xs text-[#595c5d] mb-1">Self Edit (no AI)</div>
              <div className="font-bold text-[#2c2f30]">{data.downloads_by_category.no_changes.toLocaleString("en-IN")}</div>
            </div>
            {/* no_jd: user went through generate flow but submitted with no job description */}
            <div className="bg-[#eff1f2]/50 rounded-xl p-3 border-l-4 border-blue-500">
              <div className="text-xs text-[#595c5d] mb-1">First Resume</div>
              <div className="font-bold text-[#2c2f30]">{data.downloads_by_category.no_jd.toLocaleString("en-IN")}</div>
            </div>
          </div>
        </div>
      )}

      {/* Device Breakdown */}
      {data?.downloads_by_device && (
        <div className="pt-2">
          <h3 className="text-sm font-bold text-[#2c2f30] mb-3">Downloads by Device</h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[#eff1f2]/50 rounded-xl p-3 border-l-4 border-blue-600">
              <div className="text-xs text-[#595c5d] mb-1">Desktop</div>
              <div className="font-bold text-[#2c2f30]">{data.downloads_by_device.desktop.toLocaleString("en-IN")}</div>
            </div>
            <div className="bg-[#eff1f2]/50 rounded-xl p-3 border-l-4 border-emerald-500">
              <div className="text-xs text-[#595c5d] mb-1">Mobile</div>
              <div className="font-bold text-[#2c2f30]">{data.downloads_by_device.mobile.toLocaleString("en-IN")}</div>
            </div>
          </div>
        </div>
      )}

      {/* Bar Chart */}
      <div className="pt-4 border-t border-[#eff1f2]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-[#2c2f30]">Download Trend</h3>
          <div className="h-5 text-xs font-bold text-blue-600">
            {tooltip ? `${tooltip.label}: ${tooltip.value} downloads` : ""}
          </div>
        </div>
        <div className="flex items-end gap-1 sm:gap-2 h-32">
          {trend.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-xs text-[#595c5d]">No trend data available</div>
          ) : trend.map((d, i) => {
            const heightPct = max > 0 ? (d.value / max) * 100 : 0;
            return (
              <div
                key={`dl-trend-${i}`}
                className="flex-1 flex flex-col items-center gap-1 group cursor-pointer h-full"
                onMouseEnter={() => setTooltip(d)}
                onMouseLeave={() => setTooltip(null)}
              >
                <div className="relative w-full flex items-end justify-center h-full">
                  <motion.div
                    key={`dl-bar-${i}`}
                    initial={{ height: 0 }}
                    animate={{ height: `${heightPct}%` }}
                    transition={{ duration: 0.5, delay: i * 0.02, ease: "easeOut" }}
                    className="w-full rounded-t-sm sm:rounded-t-md bg-gradient-to-t from-blue-600 to-blue-400 group-hover:opacity-80 transition-opacity min-h-[2px]"
                  />
                </div>
                <span className="text-[9px] sm:text-[10px] font-medium text-[#595c5d] truncate w-full text-center">{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] text-[#595c5d]/70 text-right">
        * Cap applied for performance (max 10,000 recent downloads evaluated). RPC migration planned.
      </p>
    </div>
  );
}
