"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Star, MessageSquare, Clock, RefreshCw } from "lucide-react";

interface Feedback {
  id: string;
  rating: number;
  suggestion: string;
  created_at: string;
  users?: { email: string };
}

export default function FeedbackPanel({ totalDownloads = 0 }: { totalDownloads?: number }) {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const fetchFeedback = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin-proxy/feedback`);
      const data = await res.json();
      // Handle both old (array) and new ({reviews, total_count}) response shapes
      if (Array.isArray(data)) {
        setFeedbacks(data);
        setTotalCount(data.length);
      } else {
        setFeedbacks(Array.isArray(data.reviews) ? data.reviews : []);
        setTotalCount(data.total_count ?? data.reviews?.length ?? 0);
      }
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, [])

  const avgRating = feedbacks.length > 0 ? (feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length).toFixed(1) : "—";
  const fiveStars = feedbacks.length > 0 ? Math.round((feedbacks.filter(f => f.rating === 5).length / feedbacks.length) * 100) + "%" : "—";

  const remainder = totalDownloads % 8;
  const nextFeedbackIn = remainder === 0 ? 0 : 8 - remainder;

  return (
    <div className="bg-white rounded-[1.5rem] p-6 border border-[#eff1f2] shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-headline text-xl font-bold text-[#2c2f30]">User Feedback</h2>
          <p className="text-sm text-[#595c5d]">Ratings, comments & timestamps</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchFeedback}
            className="flex items-center gap-2 text-xs font-bold text-[#006859] border border-[#006859]/20 bg-[#006859]/5 px-3 py-2 rounded-xl hover:bg-[#006859]/10 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh {lastUpdated && `· ${lastUpdated}`}
          </button>
          <div className={`border rounded-lg px-3 py-1.5 text-right ${nextFeedbackIn === 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-[#12f8d7]/10 border-[#006859]/20'}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${nextFeedbackIn === 0 ? 'text-yellow-700' : 'text-[#006859]'}`}>Next Global Trigger</p>
            <p className={`text-sm font-bold ${nextFeedbackIn === 0 ? 'text-yellow-800' : 'text-[#2c2f30]'}`}>
              {nextFeedbackIn === 0 ? "🔔 Next Download!" : `In ${nextFeedbackIn} ${nextFeedbackIn === 1 ? 'download' : 'downloads'}`}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 2, delay: i * 0.3, repeat: Infinity }}
              className="flex items-center gap-4 p-4 rounded-xl bg-[#eff1f2]"
            >
              <div className="w-10 h-10 rounded-full bg-[#595c5d]/20 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-[#595c5d]/20 rounded-full w-1/3" />
                <div className="h-3 bg-[#595c5d]/10 rounded-full w-3/4" />
              </div>
            </motion.div>
          ))}
        </div>
      ) : feedbacks.length === 0 ? (
        <div className="mt-8 text-center py-10 border-2 border-dashed border-[#eff1f2] rounded-2xl">
          <p className="font-bold text-[#2c2f30] text-lg font-headline">No feedback yet</p>
          <p className="text-sm text-[#595c5d] mt-2">Users haven't submitted any feedback yet.</p>
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-3 gap-4 max-w-sm">
            <div className="bg-[#eff1f2] rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-[#006859] font-headline">{avgRating}</div>
              <div className="text-[10px] text-[#595c5d]/60 font-medium mt-0.5">Avg Rating</div>
            </div>
            <div className="bg-[#eff1f2] rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-[#2c2f30] font-headline">{totalCount}</div>
              <div className="text-[10px] text-[#595c5d]/60 font-medium mt-0.5">Total Reviews</div>
            </div>
            <div className="bg-[#eff1f2] rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-green-600 font-headline">{fiveStars}</div>
              <div className="text-[10px] text-[#595c5d]/60 font-medium mt-0.5">5★ Rate</div>
            </div>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {feedbacks.map((f, i) => (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 rounded-xl bg-[#fafafa] border border-[#eff1f2]"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, s) => (
                      <Star key={s} className={`w-4 h-4 ${s < f.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">{new Date(f.created_at).toLocaleDateString()}</span>
                </div>
                {f.suggestion && <p className="text-sm text-gray-700 italic">"{f.suggestion}"</p>}
                <p className="text-xs text-gray-500 mt-2">— {f.users?.email || 'Anonymous'}</p>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
