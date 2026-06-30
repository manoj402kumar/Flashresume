"use client";
import { useState } from "react";
import { X, Gift } from "lucide-react";

interface Props {
  referralCode: string;
  onClose: () => void;
}

export default function ReferralModal({ referralCode, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (!referralCode) return;
    const url = `${window.location.origin}/?ref=${referralCode}`;

    // 1. Copy to clipboard synchronously first. 
    // iOS Safari blocks clipboard access if it happens after an 'await'.
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(url).catch(() => { });
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
    } catch (e) {
      // Ignore copy errors
    }

    // 2. Attempt native share sheet
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Flashresume",
          text: "I used Flashresume to rebuild my resume in 60 seconds! Must try.",
          url: url,
        });
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Error sharing:", err);
        }
      }
      return; // exit before setCopied
    }

    // fallback: no native share, so we did copy — now show feedback
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-7 w-full max-w-sm mx-auto relative text-center">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700 focus:outline-none"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-4 mt-2">
          <div className="mx-auto w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mb-4">
            <Gift className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="font-bold text-xl text-gray-800 mb-2 leading-tight">
            Share your friend and get bonus 20 credits free
          </h3>
          <p className="text-sm text-gray-500 mb-6 px-2">
            Invite your friends to try Flashresume. You'll instantly receive 20 free credits when they download their first resume!
          </p>
        </div>

        <button
          onClick={handleShare}
          className="w-full bg-primary text-white font-bold py-3.5 rounded-xl
                     hover:bg-primary/90 active:scale-95 transition-all
                     flex items-center justify-center gap-2"
        >
          🎁 {copied ? "Link Copied!" : "Share Link"}
        </button>
      </div>
    </div>
  );
}
