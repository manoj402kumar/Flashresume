import { NextResponse } from "next/server";

export async function GET() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
  try {
    const [statsRes, presenceRes] = await Promise.all([
      fetch(`${backendUrl}/api/public/review-stats`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(3000) }).catch(() => null),
      fetch(`${backendUrl}/api/presence/count`, { next: { revalidate: 15 }, signal: AbortSignal.timeout(3000) }).catch(() => null)
    ]);

    let data = null;
    if (statsRes && statsRes.ok) {
      data = await statsRes.json().catch(() => null);
    }
    
    if (presenceRes && presenceRes.ok && data) {
      const p = await presenceRes.json().catch(() => ({ live: 0 }));
      data.live_users = p.live || 0;
    }

    const fallback = {
      avg_rating: 5.0,
      total_reviews: 0,
      five_star_rate: 100,
      total_signups: 0,
      live_users: 0
    };

    return NextResponse.json(data || fallback);
  } catch (err) {
    return NextResponse.json({
      avg_rating: 5.0,
      total_reviews: 0,
      five_star_rate: 100,
      total_signups: 0,
      live_users: 0
    });
  }
}
