import { NextResponse } from "next/server";

export async function GET() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
  try {
    const res = await fetch(`${backendUrl}/api/public/reviews`, {
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json([], { status: 200 });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([]);
  }
}
