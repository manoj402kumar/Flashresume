import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathArray } = await params;
  const path = pathArray.join("/");
  const searchParams = request.nextUrl.searchParams.toString();
  
  // Use NEXT_PUBLIC_BACKEND_URL or fallback
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
  const targetUrl = `${backendUrl}/api/admin/${path}${searchParams ? `?${searchParams}` : ''}`;
  
  try {
    const res = await fetch(targetUrl, {
      headers: {
        "X-Admin-Key": process.env.ADMIN_SECRET_KEY || "",
      },
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: "Failed to proxy request" }, { status: 500 });
  }
}
