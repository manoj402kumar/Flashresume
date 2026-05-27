"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { Zap } from "lucide-react";

interface CreditBadgeProps {
  onTopUpClick?: () => void;
}

export default function CreditBadge({ onTopUpClick }: CreditBadgeProps) {
  const [credits, setCredits] = useState<number | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setCredits(null);
      return;
    }

    // Fetch initial balance
    const fetchCredits = async () => {
      const { data, error } = await supabase
        .rpc("get_total_active_credits", { p_user_id: user.id });
      
      if (!error && data !== null) {
        setCredits(data);
      }
    };

    fetchCredits();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`badge_credits_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "credit_buckets",
          filter: `user_id=eq.${user.id}`,
        },
        async () => {
          const { data } = await supabase
            .rpc("get_total_active_credits", { p_user_id: user.id });
          if (data !== null) setCredits(data);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (!user || credits === null) return null;

  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low border border-primary/20"
      title="Available credits"
    >
      <Zap className="w-4 h-4 text-primary fill-primary/20" />
      <span className="text-sm font-bold text-on-surface-variant">
        {credits} credits
      </span>
    </div>
  );
}
