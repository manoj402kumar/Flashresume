"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// PresenceTracker — lightweight backend-only ping.
// The Supabase Realtime WebSocket channel was removed because:
//   1. It generated massive egress (Supabase broadcasts to ALL connected browsers on every update).
//   2. No feature in the app ever READ the Realtime presence data.
//   3. The backend HTTP ping below already tracks peak concurrent users for the admin dashboard.
// Cost now: one tiny HTTP POST per user per 5 minutes. Zero Supabase Realtime egress.

export default function PresenceTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Do not track presence on the admin dashboard
    if (pathname && pathname.startsWith("/admin")) return;

    // Get or create anonymous ID from localStorage for de-duplicating tabs
    let anonId = localStorage.getItem("flashresume_anon_id");
    if (!anonId) {
      anonId = `anon_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem("flashresume_anon_id", anonId);
    }

    // Backend Peak Tracking Heartbeat — pings Render backend every 5 minutes.
    // The backend counts active sessions in-memory and saves peak to system_metrics table.
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const pingBackend = () => {
      fetch(`${API_URL}/api/presence/ping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: anonId }),
        keepalive: true,
      }).catch(() => {});
    };

    // Ping immediately on mount / page change
    pingBackend();

    // Then ping every 2 minutes (stale timeout is 3 min, so 1 min safety buffer)
    const pingInterval = setInterval(pingBackend, 120000);

    return () => clearInterval(pingInterval);
  }, [pathname]);

  return null;
}
