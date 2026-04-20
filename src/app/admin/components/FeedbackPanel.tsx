"use client";

import { motion } from "motion/react";
import { Star, MessageSquare, Clock } from "lucide-react";

export default function FeedbackPanel() {
  return (
    <div className="bg-white rounded-[1.5rem] p-6 border border-[#eff1f2] shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-headline text-xl font-bold text-[#2c2f30]">User Feedback</h2>
          <p className="text-sm text-[#595c5d]">Ratings, comments & timestamps</p>
        </div>
        <span className="text-xs font-bold text-[#595c5d] bg-[#eff1f2] px-3 py-1.5 rounded-full">
          Coming Soon
        </span>
      </div>

      {/* Skeleton placeholder rows */}
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 2, delay: i * 0.3, repeat: Infinity }}
            className="flex items-center gap-4 p-4 rounded-xl bg-[#eff1f2]"
          >
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-[#595c5d]/20 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-[#595c5d]/20 rounded-full w-1/3" />
              <div className="h-3 bg-[#595c5d]/10 rounded-full w-3/4" />
            </div>
            {/* Stars placeholder */}
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, s) => (
                <div key={s} className="w-3 h-3 rounded-sm bg-[#595c5d]/20" />
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Placeholder message */}
      <div className="mt-8 text-center py-10 border-2 border-dashed border-[#eff1f2] rounded-2xl">
        <div className="flex justify-center gap-3 mb-4 text-[#595c5d]/40">
          <Star className="w-7 h-7" />
          <MessageSquare className="w-7 h-7" />
          <Clock className="w-7 h-7" />
        </div>
        <p className="font-bold text-[#2c2f30] text-lg font-headline">Feedback system not yet live</p>
        <p className="text-sm text-[#595c5d] mt-2 max-w-sm mx-auto leading-relaxed">
          Once you add a feedback form to the main app, responses will appear here
          with ratings, comments, and timestamps — sortable and filterable.
        </p>
        <div className="mt-6 grid grid-cols-3 gap-4 max-w-xs mx-auto">
          {["Avg Rating", "Total Reviews", "5★ Rate"].map((label) => (
            <div key={label} className="bg-[#eff1f2] rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-[#595c5d]/40 font-headline">—</div>
              <div className="text-[10px] text-[#595c5d]/60 font-medium mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
