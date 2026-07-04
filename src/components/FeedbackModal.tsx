"use client";
import { useState } from "react";
import { Star } from "lucide-react";

interface Props {
  userId: string;
  sessionId: string;
  onClose: () => void;
  onSubmitSuccess?: (rating: number) => void;
}

export default function FeedbackModal({ userId, sessionId, onClose, onSubmitSuccess }: Props) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [suggestion, setSuggestion] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const handleSubmit = async () => {
    // Inline validation — show message instead of silently blocking
    if (rating === 0) {
      setError("Please give a rating before submitting.");
      return;
    }

    if (rating <= 2 && suggestion.trim() === "") {
      setError("Please tell us what went wrong so we can improve.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/feedback/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, session_id: sessionId, rating, suggestion }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        // If already submitted for this session, treat as success gracefully
        if (res.status === 409) {
          setSubmitted(true);
          setTimeout(() => { onSubmitSuccess?.(rating); onClose(); }, 2000);
          return;
        }
        throw new Error(errData.detail || "Failed to submit feedback. Please try again.");
      }

      setSubmitted(true);
      setTimeout(() => { onSubmitSuccess?.(rating); onClose(); }, 2000); // auto-close after thank you
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-7 w-full max-w-sm mx-auto relative">

        {submitted ? (
          <div className="text-center py-4">
            <p className="text-4xl mb-3">🎉</p>
            <p className="font-bold text-gray-800 text-lg">Thanks for your feedback!</p>
            <p className="text-sm text-gray-500 mt-1">It helps us improve FlashResume.</p>
          </div>
        ) : (
          <>
            <h3 className="font-bold text-lg text-gray-800 mb-1">How was your experience?</h3>
            <p className="text-sm text-gray-500 mb-4">Rate us · Takes just 10 seconds</p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl font-medium text-center">
                {error}
              </div>
            )}

            {/* Star Rating */}
            <div className="flex gap-2 justify-center mb-6">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s}
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => { setRating(s); setError(""); }}
                  className="p-1 transition-transform hover:scale-110 focus:outline-none"
                >
                  <Star className={`w-8 h-8 transition-colors ${s <= (hovered || rating)
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-gray-200"
                    }`} />
                </button>
              ))}
            </div>

            {/* Suggestion */}
            <textarea
              value={suggestion}
              onChange={(e) => {
                setSuggestion(e.target.value);
                if (error) setError("");
              }}
              placeholder={
                rating > 0 && rating <= 2
                  ? "Please tell us what went wrong (required)"
                  : "Please share what impressed you?."
              }
              rows={3}
              className={`w-full border rounded-xl px-4 py-3 text-sm text-gray-700 resize-none 
                         focus:outline-none focus:ring-2 mb-1 bg-gray-50 transition-colors
                         ${rating > 0 && rating <= 2
                  ? "border-red-300 focus:ring-red-300/50"
                  : "border-gray-200 focus:ring-primary/50"
                }`}
            />

            {rating > 0 && rating <= 2 && (
              <p className="text-xs text-red-500 mb-4 font-medium text-left px-1">
                ⚠️ Required
              </p>
            )}

            {/* Submit — always visible, validates rating on click */}
            <button
              onClick={handleSubmit}
              disabled={loading}
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
