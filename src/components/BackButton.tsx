"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";

export default function BackButton() {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    // Check if there is actual history to go back to.
    // In Next.js App Router, window.history.length > 2 usually indicates
    // we navigated here from within the app or another site, rather than opening a fresh tab.
    if (typeof window !== "undefined") {
      setCanGoBack(window.history.length > 2);
    }
  }, []);

  const handleBack = () => {
    if (canGoBack) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <button
      onClick={handleBack}
      className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors mb-8 cursor-pointer"
    >
      <ArrowLeft className="w-4 h-4" />
      <span>{canGoBack ? "Back" : "Back to Home"}</span>
    </button>
  );
}
