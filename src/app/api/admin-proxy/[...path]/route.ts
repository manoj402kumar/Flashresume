import { NextRequest, NextResponse } from "next/server";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathArray } = await params;
  const path = pathArray.join("/");
  const searchParams = request.nextUrl.searchParams.toString();
  const targetUrl = `${backendUrl}/api/admin/${path}${searchParams ? `?${searchParams}` : ''}`;
  
  try {
    const res = await fetch(targetUrl, {
      headers: { "X-Admin-Key": process.env.ADMIN_SECRET_KEY || "" },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Failed to proxy request" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathArray } = await params;
  const path = pathArray.join("/");
  const targetUrl = `${backendUrl}/api/admin/${path}`;

  try {
    let body: string | undefined;
    try { body = await request.text(); } catch { body = undefined; }

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "X-Admin-Key": process.env.ADMIN_SECRET_KEY || "",
        "Content-Type": "application/json",
      },
      ...(body ? { body } : {}),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Failed to proxy POST request" }, { status: 500 });
  }
}
