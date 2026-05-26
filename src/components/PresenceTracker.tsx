"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

export default function PresenceTracker() {
  const pathname = usePathname();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Do not track presence on the admin dashboard
    if (pathname && pathname.startsWith("/admin")) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    // Get or create anonymous ID from localStorage for de-duplicating tabs
    let anonId = localStorage.getItem("flashresume_anon_id");
    if (!anonId) {
      anonId = `anon_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem("flashresume_anon_id", anonId);
    }

    if (!channelRef.current) {
      // Connect first time
      channelRef.current = supabase.channel("public:online-users");
      
      channelRef.current.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channelRef.current?.track({
            user: anonId,
            page: pathname,
            online_at: new Date().toISOString(),
          });
        }
      });
    } else {
      // If already connected, just update the presence state with the new page
      if (channelRef.current.state === "joined") {
        channelRef.current.track({
          user: anonId,
          page: pathname,
          updated_at: new Date().toISOString(),
        });
      }
    }
  }, [pathname]);

  // Cleanup on full unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  return null;
}
