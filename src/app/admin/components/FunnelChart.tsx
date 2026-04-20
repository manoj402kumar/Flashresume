"use client";

import { motion } from "motion/react";
import { Users, FileText, ShoppingCart } from "lucide-react";

const STAGES = [
  {
    id: "visited",
    label: "Visited Site",
    icon: Users,
    value: 15234,
    color: "from-[#006859] to-[#0d9e84]",
    textColor: "text-[#006859]",
    widthPct: 100,
  },
  {
    id: "result",
    label: "Reached /result",
    icon: FileText,
    value: 6891,
    color: "from-[#12f8d7] to-[#0de8cc]",
    textColor: "text-[#0d9e84]",
    widthPct: 45.2,
  },
  {
    id: "purchased",
    label: "Completed Purchase",
    icon: ShoppingCart,
    value: 431,
    color: "from-purple-500 to-purple-400",
    textColor: "text-purple-600",
    widthPct: 6.3,
  },
];

export default function FunnelChart() {
  return (
    <div className="bg-white rounded-[1.5rem] p-6 border border-[#eff1f2] shadow-sm space-y-5">
      <div>
        <h2 className="font-headline text-xl font-bold text-[#2c2f30]">Conversion Funnel</h2>
        <p className="text-sm text-[#595c5d]">User journey from visit to purchase</p>
      </div>

      <div className="space-y-4">
        {STAGES.map((stage, i) => {
          const Icon = stage.icon;
          const convRate =
            i === 0
              ? "100%"
              : `${((stage.value / STAGES[0].value) * 100).toFixed(1)}% of visitors`;

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
                  ↓ {((STAGES[i + 1].value / stage.value) * 100).toFixed(1)}% continued
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#eff1f2]">
        <div className="text-center">
          <div className="text-2xl font-bold font-headline text-[#006859]">45.2%</div>
          <div className="text-xs text-[#595c5d] font-medium">Visit → Result rate</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold font-headline text-purple-600">6.3%</div>
          <div className="text-xs text-[#595c5d] font-medium">Result → Purchase rate</div>
        </div>
      </div>

      <p className="text-xs text-[#595c5d]/70">
        * Wire <code className="font-mono bg-[#eff1f2] px-1 rounded">/admin/record/result-visit</code> in
        your result page to track real data
      </p>
    </div>
  );
}
