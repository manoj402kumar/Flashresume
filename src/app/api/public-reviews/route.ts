import { NextResponse } from "next/server";

export async function GET() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
  try {
    const res = await fetch(`${backendUrl}/api/public/reviews`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000)
    }).catch(() => null);
    
    if (!res || !res.ok) return NextResponse.json([], { status: 200 });
    const data = await res.json().catch(() => []);
    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json([]);
  }
}
