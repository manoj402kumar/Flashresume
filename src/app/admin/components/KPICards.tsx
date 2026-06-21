"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  Users, TrendingUp, Download, CreditCard,
  ArrowUpRight, Activity, AlertCircle, ShieldAlert
} from "lucide-react";

// -- Animated counter hook --------------------------------------------------
function useCountUp(target: number, duration = 1400) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const t = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setCount(Math.floor(eased * target));
      if (t >= 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [target, duration]);
  return count;
}

function formatINR(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

interface KPI {
  label: string;
  value: number;
  format?: "number" | "inr";
  icon: React.ReactNode;
  iconBg: string;
  delta: string;
  deltaPositive: boolean;
  note?: string;
}

function KPICard({ kpi, delay }: { kpi: KPI; delay: number }) {
  const count = useCountUp(kpi.value);
  const display = kpi.format === "inr" ? formatINR(count) : count.toLocaleString("en-IN");

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -4, boxShadow: "0 20px 40px rgba(0,104,89,0.10)" }}
      className="bg-white rounded-[1.5rem] p-6 flex flex-col gap-4 border border-[#eff1f2] shadow-sm transition-all duration-300"
    >
      <div className="flex items-center justify-between">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${kpi.iconBg}`}>
          {kpi.icon}
        </div>
        <span
          className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${kpi.deltaPositive
            ? "bg-emerald-50 text-emerald-700"
            : "bg-red-50 text-red-700"
            }`}
        >
          <ArrowUpRight className={`w-3 h-3 ${!kpi.deltaPositive && "rotate-180"}`} />
          {kpi.delta}
        </span>
      </div>
      <div>
        <div className="text-3xl font-bold font-headline text-[#2c2f30] tracking-tight leading-none">
          {display}
        </div>
        <div className="text-sm font-medium text-[#595c5d] mt-1.5">{kpi.label}</div>
        {kpi.note && (
          <div className="text-xs text-[#595c5d]/70 mt-1">{kpi.note}</div>
        )}
      </div>
    </motion.div>
  );
}

export default function KPICards({ onlineUsers, stats }: { onlineUsers: number, stats?: { revenue: number, downloads: number, subscribers: number, totalLogins: number, totalVisitors: number, failedPayments: number, peakConcurrentUsers: number, peakTimestamp: string | null, highRiskUsers?: number } }) {

  const formattedPeakTime = stats?.peakTimestamp
    ? new Date(stats.peakTimestamp).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'No data';

  const kpis: KPI[] = [
    {
      label: "Total Visitors",
      value: stats?.totalVisitors || 0,
      icon: <TrendingUp className="w-5 h-5 text-emerald-600" />,
      iconBg: "bg-emerald-50",
      delta: "All Time",
      deltaPositive: true,
      note: "Home page visits",
    },
    {
      label: "Live Users",
      value: onlineUsers,
      icon: <Users className="w-5 h-5 text-blue-600" />,
      iconBg: "bg-blue-50",
      delta: "Live",
      deltaPositive: true,
      note: "Currently browsing the site",
    },
    {
      label: "Peak Concurrent",
      value: stats?.peakConcurrentUsers || 0,
      icon: <TrendingUp className="w-5 h-5 text-amber-600" />,
      iconBg: "bg-amber-50",
      delta: "Peak",
      deltaPositive: true,
      note: `Achieved: ${formattedPeakTime}`,
    },
    {
      label: "Total Signups",
      value: stats?.totalLogins || 0,
      icon: <Activity className="w-5 h-5 text-[#006859]" />,
      iconBg: "bg-[#12f8d7]/15",
      delta: "All Time",
      deltaPositive: true,
      note: "Registered accounts",
    },
    {
      label: "Paid Subscribers",
      value: stats?.subscribers || 0,
      icon: <CreditCard className="w-5 h-5 text-amber-600" />,
      iconBg: "bg-amber-50",
      delta: "Active",
      deltaPositive: true,
      note: "Total unique paid users",
    },
    {
      label: "Total Downloads",
      value: stats?.downloads || 0,
      icon: <Download className="w-5 h-5 text-indigo-600" />,
      iconBg: "bg-indigo-50",
      delta: "All Time",
      deltaPositive: true,
    },
    {
      label: "Total Revenue",
      value: stats?.revenue || 0,
      format: "inr",
      icon: <TrendingUp className="w-5 h-5 text-purple-600" />,
      iconBg: "bg-purple-50",
      delta: "All Time",
      deltaPositive: true,
      note: "From Razorpay payments",
    },
    {
      label: "Failed Payments",
      value: stats?.failedPayments || 0,
      icon: <AlertCircle className="w-5 h-5 text-red-500" />,
      iconBg: "bg-red-50",
      delta: "All Time",
      deltaPositive: false,
      note: "Technical/Gateway failures",
    },
    {
      label: "High Risk Users",
      value: stats?.highRiskUsers || 0,
      icon: <ShieldAlert className="w-5 h-5 text-red-600" />,
      iconBg: "bg-red-50",
      delta: "Warning",
      deltaPositive: false,
      note: "Generations > 5 without downloads",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
      {kpis.map((kpi, i) => (
        <KPICard key={kpi.label} kpi={kpi} delay={i * 0.08} />
      ))}
    </div>
  );
}
