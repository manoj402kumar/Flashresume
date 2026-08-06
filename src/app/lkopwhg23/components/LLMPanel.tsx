"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Cpu, RefreshCw, CheckCircle, AlertCircle, Clock } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface LLMUsageRow {
  id: string;
  request_type: string;
  provider: string;
  model: string;
  success: boolean;
  speed_secs: number | null;
  created_at: string;
}

interface ProviderStats {
  total: number;
  success: number;
  avg_speed: number;
  models: Set<string>;
}

const PROVIDER_META: Record<string, { label: string; color: string; bg: string }> = {
  gemini:     { label: "Gemini",     color: "text-[#006859]",  bg: "bg-[#12f8d7]/15" },

  mistral:    { label: "Mistral",    color: "text-orange-600", bg: "bg-orange-50" },
  cerebras:   { label: "Cerebras",   color: "text-blue-600",   bg: "bg-blue-50" },
  cloudflare: { label: "Cloudflare", color: "text-rose-600",   bg: "bg-rose-50" },
  nvidia_1:   { label: "NVIDIA (1)", color: "text-green-600",  bg: "bg-green-50" },
  nvidia_2:   { label: "NVIDIA (2)", color: "text-green-600",  bg: "bg-green-50" },
  nvidia_3:   { label: "NVIDIA (3)", color: "text-green-600",  bg: "bg-green-50" },
  nvidia_4:   { label: "NVIDIA (4)", color: "text-green-600",  bg: "bg-green-50" },
  nvidia_5:   { label: "NVIDIA (5)", color: "text-green-600",  bg: "bg-green-50" },
  nvidia_6:   { label: "NVIDIA (6)", color: "text-green-600",  bg: "bg-green-50" },
  nvidia_7:   { label: "NVIDIA (7)", color: "text-green-600",  bg: "bg-green-50" },
  nvidia_8:   { label: "NVIDIA (8)", color: "text-green-600",  bg: "bg-green-50" },
};

function ProviderCard({ name, stats, delay }: { name: string; stats: ProviderStats; delay: number }) {
  const meta = PROVIDER_META[name] || { label: name.replace('_', ' ').toUpperCase(), color: "text-gray-600", bg: "bg-gray-50" };
  const successRate = stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-white rounded-[1.5rem] p-6 border border-[#eff1f2] shadow-sm space-y-4"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${meta.bg}`}>
            <Cpu className={`w-5 h-5 ${meta.color}`} />
          </div>
          <div>
            <div className="font-bold text-[#2c2f30] font-headline">{meta.label}</div>
            <div className="text-[10px] text-[#595c5d] leading-tight mt-0.5 max-w-[150px] truncate">
              {Array.from(stats.models).join(', ') || 'Unknown model'}
            </div>
          </div>
        </div>
        <span
          className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
            successRate > 80 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {successRate > 80 ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
          {successRate}% Success
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="bg-[#eff1f2] rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-[#2c2f30] font-headline">{stats.total}</div>
          <div className="text-[10px] text-[#595c5d]/60 font-medium mt-0.5">Total Requests</div>
        </div>
        <div className="bg-[#eff1f2] rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-[#006859] font-headline flex justify-center items-center gap-1">
            <Clock className="w-4 h-4" />
            {stats.avg_speed.toFixed(1)}s
          </div>
          <div className="text-[10px] text-[#595c5d]/60 font-medium mt-0.5">Avg Speed</div>
        </div>
      </div>
    </motion.div>
  );
}

export default function LLMPanel() {
  const [data, setData] = useState<Record<string, ProviderStats> | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/admin-proxy/llm-stats`);
      const rows: LLMUsageRow[] = await res.json();
      
      const aggregated: Record<string, ProviderStats> = {};
      
      if (Array.isArray(rows)) {
        rows.forEach(row => {
          if (!aggregated[row.provider]) {
            aggregated[row.provider] = { total: 0, success: 0, avg_speed: 0, models: new Set() };
          }
          const stats = aggregated[row.provider];
          stats.total += 1;
          if (row.success) stats.success += 1;
          if (row.speed_secs) stats.avg_speed += row.speed_secs;
          stats.models.add(row.model.split('/').pop() || row.model);
        });
        
        // Calculate avg speeds
        Object.keys(aggregated).forEach(p => {
          if (aggregated[p].success > 0) {
            aggregated[p].avg_speed /= aggregated[p].success;
          }
        });
        setData(aggregated);
      } else {
        setData(null);
      }
      setLastUpdated(new Date().toLocaleTimeString());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-headline text-xl font-bold text-[#2c2f30]">LLM Usage & Performance</h2>
          <p className="text-sm text-[#595c5d]">Real analytics based on fallback chain usage</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 text-xs font-bold text-[#006859] border border-[#006859]/20 bg-[#006859]/5 px-3 py-2 rounded-xl hover:bg-[#006859]/10 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh {lastUpdated && `· ${lastUpdated}`}
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-[1.5rem] p-6 border border-[#eff1f2] h-44 animate-pulse" />
          ))}
        </div>
      ) : data && Object.keys(data).length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Object.entries(data).map(([name, stats], i) => (
            <ProviderCard key={name} name={name} stats={stats} delay={i * 0.07} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-[1.5rem] p-10 text-center border border-[#eff1f2]">
          <AlertCircle className="w-10 h-10 text-orange-400 mx-auto mb-3" />
          <p className="font-bold text-[#2c2f30]">No usage data yet</p>
          <p className="text-sm text-[#595c5d] mt-1">Generate resumes to start tracking LLM model performance.</p>
        </div>
      )}
    </div>
  );
}
