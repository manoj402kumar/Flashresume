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
        .from("credit_buckets")
        .select("remaining_credits")
        .eq("user_id", user.id)
        .in("status", ["active", "queued", "fallback"])
        .gt("remaining_credits", 0);
      
      if (!error && data) {
        const total = data.reduce((acc, b) => acc + b.remaining_credits, 0);
        setCredits(total);
      } else {
        // Fallback to old users table
        const { data: uData } = await supabase.from("users").select("credits_balance").eq("id", user.id).single();
        if (uData) setCredits(uData.credits_balance || 0);
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
          fetchCredits();
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
