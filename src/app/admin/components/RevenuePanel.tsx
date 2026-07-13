"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { IndianRupee, CheckCircle, Calendar } from "lucide-react";

interface Plan {
  name: string;
  price: string | number;
  users: number;
  mrr: number;
  color: string;
  textColor: string;
  barColor: string;
}

interface TrendPoint {
  label: string;
  value: number;
}

interface AnalyticsData {
  total_revenue: number;
  active_subscriptions: number;
  subscription_count: number;
  breakdown: Plan[];
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

const PLAN_FILTERS = [
  { id: "all", label: "All Plans" },
  { id: "pay_per_use", label: "₹29 One-Time" },
  { id: "student", label: "₹99 Student" },
  { id: "regular", label: "₹199 Standard" },
];

export default function RevenuePanel() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  
  const [timeFilter, setTimeFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  
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

    let url = `/api/admin-proxy/analytics/revenue?time_filter=${timeFilter}&plan_filter=${planFilter}`;
    if (timeFilter === "custom" && startDate && endDate) {
      url += `&start_date=${startDate}T00:00:00Z&end_date=${endDate}T23:59:59Z`;
    }

    const fetchRevenue = () =>
      fetch(url)
        .then((res) => res.json())
        .then((d) => setData(d))
        .catch((e) => console.error("Failed to fetch revenue", e));

    fetchRevenue();
  }, [timeFilter, planFilter, startDate, endDate]);

  const plans = data?.breakdown || [];
  const totalUsers = plans.reduce((s, p) => s + p.users, 0);
  const trend = data?.trend || [];
  const maxTrend = trend.length > 0 ? Math.max(...trend.map((d) => d.value)) : 0;

  return (
    <div className="bg-white rounded-[1.5rem] p-6 border border-[#eff1f2] shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-headline text-xl font-bold text-[#2c2f30]">Revenue & Subscriptions</h2>
          <p className="text-sm text-[#595c5d]">Analytics and trends</p>
        </div>
        <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
          <CheckCircle className="w-3 h-3" />
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    timeFilter === f.id
                      ? "bg-white text-[#006859] shadow-sm"
                      : "text-[#595c5d] hover:text-[#2c2f30]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-[#595c5d] uppercase tracking-wider w-12">Plan:</span>
            <select 
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#eff1f2] border-none text-[#2c2f30] outline-none focus:ring-2 focus:ring-[#006859]/20"
            >
              {PLAN_FILTERS.map(f => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </div>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-[#006859] to-[#0d9e84] rounded-2xl p-5 text-white flex flex-col justify-between">
          <div className="text-sm font-medium opacity-80">Total Revenue</div>
          <div className="text-3xl font-bold font-headline mt-2 flex items-center gap-1">
            ₹{(data?.total_revenue || 0).toLocaleString("en-IN")}
          </div>
        </div>
        <div className="bg-surface-container-low rounded-2xl p-5 border border-[#eff1f2] flex flex-col justify-between">
          <div className="text-sm font-medium text-[#595c5d]">Active Subscriptions</div>
          <div className="text-3xl font-bold font-headline text-[#2c2f30] mt-2">
            {data?.active_subscriptions || 0}
          </div>
          <div className="text-xs text-[#595c5d]/70 mt-1">Users with credits &gt; 0 right now</div>
        </div>
        <div className="bg-surface-container-low rounded-2xl p-5 border border-[#eff1f2] flex flex-col justify-between">
          <div className="text-sm font-medium text-[#595c5d]">Total Purchases</div>
          <div className="text-3xl font-bold font-headline text-[#2c2f30] mt-2">
            {data?.subscription_count || 0}
          </div>
        </div>
      </div>

      {/* Trend Chart */}
      <div className="pt-4 border-t border-[#eff1f2]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-[#2c2f30]">Revenue Trend</h3>
          <div className="h-5 text-xs font-bold text-[#006859]">
            {tooltip ? `${tooltip.label}: ₹${tooltip.value.toLocaleString("en-IN")}` : ""}
          </div>
        </div>
        <div className="flex items-end gap-1 sm:gap-2 h-32">
          {trend.length === 0 ? (
             <div className="w-full h-full flex items-center justify-center text-xs text-[#595c5d]">No trend data available</div>
          ) : trend.map((d, i) => {
            const heightPct = maxTrend > 0 ? (d.value / maxTrend) * 100 : 0;
            return (
              <div
                key={`rev-trend-${i}`}
                className="flex-1 flex flex-col items-center gap-1 group cursor-pointer h-full"
                onMouseEnter={() => setTooltip(d)}
                onMouseLeave={() => setTooltip(null)}
              >
                <div className="relative w-full flex items-end justify-center h-full">
                  <motion.div
                    key={`rev-bar-${i}`}
                    initial={{ height: 0 }}
                    animate={{ height: `${heightPct}%` }}
                    transition={{ duration: 0.5, delay: i * 0.02, ease: "easeOut" }}
                    className="w-full rounded-t-sm sm:rounded-t-md bg-gradient-to-t from-[#006859] to-[#12f8d7] group-hover:opacity-80 transition-opacity min-h-[2px]"
                  />
                </div>
                <span className="text-[9px] sm:text-[10px] font-medium text-[#595c5d] truncate w-full text-center">{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Plan Breakdown */}
      <div className="space-y-4 pt-4 border-t border-[#eff1f2]">
        <h3 className="text-sm font-bold text-[#2c2f30] mb-2">Breakdown by Plan</h3>
        {!data ? (
          <div className="text-sm text-[#595c5d] text-center py-4">Loading data...</div>
        ) : plans.length === 0 ? (
          <div className="text-sm text-[#595c5d] text-center py-4">No data for selected filters</div>
        ) : plans.map((plan, i) => {
          const userPct = totalUsers > 0 ? (plan.users / totalUsers) * 100 : 0;
          return (
            <div key={plan.name} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${plan.barColor}`} />
                  <span className="font-bold text-[#2c2f30]">{plan.name}</span>
                  <span className="text-[#595c5d]">
                    {plan.price === 0 ? "Free" : `₹${plan.price}`}
                  </span>
                </div>
                <span className="font-bold text-[#2c2f30]">
                  {plan.users.toLocaleString("en-IN")} users
                </span>
              </div>
              <div className="w-full h-3 bg-[#eff1f2] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${userPct}%` }}
                  transition={{ duration: 0.7, delay: i * 0.12, ease: "easeOut" }}
                  className={`h-full rounded-full ${plan.barColor}`}
                />
              </div>
              <div className="text-xs text-[#595c5d] text-right">
                {userPct.toFixed(1)}% of total · Revenue:{" "}
                <span className="font-bold text-[#2c2f30]">
                  ₹{plan.mrr.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
