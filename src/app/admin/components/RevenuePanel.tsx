"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { IndianRupee, CheckCircle } from "lucide-react";

interface Plan {
  name: string;
  price: string | number;
  users: number;
  mrr: number;
  color: string;
  textColor: string;
  barColor: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function RevenuePanel() {
  const [plans, setPlans] = useState<Plan[]>([]);
  
  useEffect(() => {
    fetch(`${API_URL}/api/admin/revenue-breakdown`)
      .then((res) => res.json())
      .then((data) => setPlans(data))
      .catch((e) => console.error("Failed to fetch revenue", e));
  }, []);

  const totalUsers = plans.reduce((s, p) => s + p.users, 0);
  const mrr = plans.reduce((s, p) => s + p.mrr, 0);

  return (
    <div className="bg-white rounded-[1.5rem] p-6 border border-[#eff1f2] shadow-sm space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-headline text-xl font-bold text-[#2c2f30]">Revenue & Subscriptions</h2>
          <p className="text-sm text-[#595c5d]">Breakdown by plan</p>
        </div>
        <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
          <CheckCircle className="w-3 h-3" />
          Live Data
        </span>
      </div>

      {/* MRR Hero */}
      <div className="bg-gradient-to-br from-[#006859] to-[#0d9e84] rounded-2xl p-5 text-white flex items-center justify-between">
        <div>
          <div className="text-sm font-medium opacity-80">Monthly Recurring Revenue</div>
          <div className="text-3xl font-bold font-headline mt-1">
            ₹{mrr.toLocaleString("en-IN")}
          </div>
        </div>
        <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center">
          <IndianRupee className="w-6 h-6 text-[#12f8d7]" />
        </div>
      </div>

      {/* Plan Breakdown */}
      <div className="space-y-4">
        {plans.length === 0 ? (
          <div className="text-sm text-[#595c5d] text-center py-4">Loading data...</div>
        ) : plans.map((plan, i) => {
          const userPct = totalUsers > 0 ? (plan.users / totalUsers) * 100 : 0;
          return (
            <div key={plan.name} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${plan.barColor}`} />
                  <span className="font-bold text-[#2c2f30]">{plan.name}</span>
                  <span className="text-[#595c5d]">
                    {plan.price === 0 ? "Free" : `₹${plan.price}/mo`}
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
                {userPct.toFixed(1)}% of total · MRR contribution:{" "}
                <span className="font-bold text-[#2c2f30]">
                  ₹{plan.mrr.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-[#595c5d]/70">
        * Aggregated securely from active subscriptions and successful payments
      </p>
    </div>
  );
}
