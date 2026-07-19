import { NextResponse } from "next/server";

export async function GET() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
  try {
    const [statsRes, presenceRes] = await Promise.all([
      fetch(`${backendUrl}/api/public/review-stats`, { next: { revalidate: 300 } }),
      fetch(`${backendUrl}/api/presence/count`, { next: { revalidate: 15 } })
    ]);

    let data = null;
    if (statsRes.ok) {
      data = await statsRes.json();
    }
    
    if (presenceRes.ok && data) {
      const p = await presenceRes.json();
      data.live_users = p.live || 0;
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(null);
  }
}
