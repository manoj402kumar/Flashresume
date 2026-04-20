"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Cpu, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ProviderStatus {
  rpm_used: number;
  rpm_limit: number;
  rpd_used: number;
  rpd_limit: number;
  available: boolean;
}

type LLMData = Record<string, ProviderStatus>;

const PROVIDER_META: Record<string, { label: string; color: string; bg: string; models: string }> = {
  gemini:     { label: "Gemini",     color: "text-[#006859]",  bg: "bg-[#12f8d7]/15", models: "gemini-2.0-flash, gemini-1.5-pro" },
  groq:       { label: "Groq",       color: "text-purple-600", bg: "bg-purple-50",    models: "llama-4, Qwen models via Groq" },
  mistral:    { label: "Mistral",    color: "text-orange-600", bg: "bg-orange-50",    models: "mistral-large-2, ministral" },
  cerebras:   { label: "Cerebras",   color: "text-blue-600",   bg: "bg-blue-50",      models: "llama3.1-70b, qwen-3" },
  cloudflare: { label: "Cloudflare", color: "text-rose-600",   bg: "bg-rose-50",      models: "@cf/meta/llama-3.1" },
};

function ProviderBar({ label, used, limit, color }: { label: string; used: number; limit: number; color: string }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isHigh = pct > 75;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-medium text-[#595c5d]">
        <span>{label}</span>
        <span className={isHigh ? "text-rose-600 font-bold" : ""}>
          {used} / {limit === 99999 ? "∞" : limit}
        </span>
      </div>
      <div className="w-full h-2 bg-[#eff1f2] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${isHigh ? "bg-rose-500" : "bg-gradient-to-r from-[#006859] to-[#12f8d7]"}`}
        />
      </div>
    </div>
  );
}

function ProviderCard({ name, data, delay }: { name: string; data: ProviderStatus; delay: number }) {
  const meta = PROVIDER_META[name] ?? { label: name, color: "text-gray-600", bg: "bg-gray-50", models: "" };

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
            <div className="text-[10px] text-[#595c5d] leading-tight mt-0.5">{meta.models}</div>
          </div>
        </div>
        <span
          className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
            data.available ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {data.available ? (
            <CheckCircle className="w-3 h-3" />
          ) : (
            <AlertCircle className="w-3 h-3" />
          )}
          {data.available ? "Available" : "Rate Limited"}
        </span>
      </div>

      <div className="space-y-3">
        <ProviderBar
          label="Requests / min"
          used={data.rpm_used}
          limit={data.rpm_limit}
          color={meta.color}
        />
        <ProviderBar
          label="Requests / day"
          used={data.rpd_used}
          limit={data.rpd_limit}
          color={meta.color}
        />
      </div>
    </motion.div>
  );
}

export default function LLMPanel() {
  const [data, setData] = useState<LLMData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_URL}/health/llm`);
      const json = await res.json();
      setData(json.providers ?? json);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch {
      // backend offline — show graceful fallback
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 15000); // auto-refresh every 15s
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-headline text-xl font-bold text-[#2c2f30]">LLM Usage</h2>
          <p className="text-sm text-[#595c5d]">Live rate-limit status from backend · auto-refreshes every 15s</p>
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
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-[1.5rem] p-6 border border-[#eff1f2] h-44 animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Object.entries(data).map(([name, status], i) => (
            <ProviderCard key={name} name={name} data={status} delay={i * 0.07} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-[1.5rem] p-10 text-center border border-[#eff1f2]">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <p className="font-bold text-[#2c2f30]">Backend Offline</p>
          <p className="text-sm text-[#595c5d] mt-1">Start the FastAPI server to see live LLM stats</p>
        </div>
      )}
    </div>
  );
}
