"use client";
import { useState } from "react";
import { Star, X } from "lucide-react";

interface Props {
  userId: string;
  sessionId: string;
  onClose: () => void;
}

export default function FeedbackModal({ userId, sessionId, onClose }: Props) {
  const [rating, setRating]         = useState(0);
  const [hovered, setHovered]       = useState(0);
  const [suggestion, setSuggestion] = useState("");
  const [submitted, setSubmitted]   = useState(false);
  const [loading, setLoading]       = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const handleSubmit = async () => {
    if (rating === 0) return;
    setLoading(true);
    try {
      await fetch(`${API}/api/feedback/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, session_id: sessionId, rating, suggestion }),
      });
      setSubmitted(true);
      setTimeout(onClose, 2000); // auto-close after thank you
    } catch (e) {
      console.error(e);
      // still close so we don't annoy user
      setSubmitted(true);
      setTimeout(onClose, 2000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-7 w-full max-w-sm mx-auto relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          <div className="text-center py-4">
            <p className="text-4xl mb-3">🎉</p>
            <p className="font-bold text-gray-800 text-lg">Thanks for your feedback!</p>
            <p className="text-sm text-gray-500 mt-1">It helps us improve FlashResume.</p>
          </div>
        ) : (
          <>
            <h3 className="font-bold text-lg text-gray-800 mb-1">How was your experience?</h3>
            <p className="text-sm text-gray-500 mb-5">Takes 10 seconds · Helps us improve</p>

            {/* Star Rating */}
            <div className="flex gap-2 justify-center mb-6">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s}
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setRating(s)}
                  className="p-1 transition-transform hover:scale-110 focus:outline-none"
                >
                  <Star className={`w-8 h-8 transition-colors ${
                    s <= (hovered || rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-200"
                  }`} />
                </button>
              ))}
            </div>

            {/* Suggestion */}
            <textarea
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              placeholder="Any suggestions? (optional)"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                         text-gray-700 resize-none focus:outline-none focus:ring-2
                         focus:ring-primary/50 mb-5 bg-gray-50"
            />

            <button
              onClick={handleSubmit}
              disabled={rating === 0 || loading}
              className="w-full bg-primary text-white font-bold py-3 rounded-xl
                         hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed
                         transition-colors"
            >
              {loading ? "Submitting..." : "Submit Feedback"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
