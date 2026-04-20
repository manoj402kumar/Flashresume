"use client";

import { motion } from "motion/react";
import { IndianRupee, AlertCircle } from "lucide-react";

const PLANS = [
  {
    name: "Free",
    price: 0,
    users: 2847,
    color: "bg-[#eff1f2]",
    textColor: "text-[#595c5d]",
    barColor: "bg-[#595c5d]/30",
    mrr: 0,
  },
  {
    name: "Pro",
    price: 99,
    users: 342,
    color: "bg-[#12f8d7]/15",
    textColor: "text-[#006859]",
    barColor: "bg-gradient-to-r from-[#006859] to-[#12f8d7]",
    mrr: 342 * 99,
  },
  {
    name: "Lifetime",
    price: 999,
    users: 89,
    color: "bg-purple-50",
    textColor: "text-purple-700",
    barColor: "bg-gradient-to-r from-purple-500 to-purple-400",
    mrr: 89 * 999,
  },
];

const TOTAL_USERS = PLANS.reduce((s, p) => s + p.users, 0);

export default function RevenuePanel() {
  const mrr = PLANS.reduce((s, p) => s + p.mrr, 0);

  return (
    <div className="bg-white rounded-[1.5rem] p-6 border border-[#eff1f2] shadow-sm space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-headline text-xl font-bold text-[#2c2f30]">Revenue & Subscriptions</h2>
          <p className="text-sm text-[#595c5d]">Breakdown by plan</p>
        </div>
        <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
          <AlertCircle className="w-3 h-3" />
          Simulated
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
        {PLANS.map((plan, i) => {
          const userPct = (plan.users / TOTAL_USERS) * 100;
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
        * Wire to Razorpay / Stripe webhook for real revenue data
      </p>
    </div>
  );
}
