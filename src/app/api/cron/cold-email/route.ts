import { NextResponse } from "next/server";

/**
 * Vercel Cron Job — Daily Cold Email Campaign
 * Schedule: "30 22 * * *" = 10:30 PM UTC = 4:00 AM IST every day
 *
 * Vercel calls this route on the schedule defined in vercel.json.
 * It proxies the trigger to the Render backend using the admin key (server-side only — never exposed to browser).
 *
 * Security: Vercel sets the Authorization header to "Bearer CRON_SECRET" automatically.
 * We verify it to ensure only Vercel can trigger this route.
 */
export async function GET(request: Request) {
  // Verify this is called by Vercel Cron and not a random public request
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const batch = searchParams.get("batch");

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
  const adminKey = process.env.ADMIN_SECRET_KEY || "";
  const targetUrl = `${backendUrl}/api/admin/trigger-cold-email${batch ? `?batch=${batch}` : ""}`;

  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "X-Admin-Key": adminKey,
        "Content-Type": "application/json",
      },
      // Vercel serverless functions have a 60s max — response returns immediately from backend
      signal: AbortSignal.timeout(30000),
    });

    const data = await res.json();

    console.log(`[CronJob] Cold email trigger response: ${JSON.stringify(data)}`);

    if (!res.ok || data.status !== "ok") {
      console.error(`[CronJob] Backend returned error:`, data);
      return NextResponse.json(
        { success: false, error: "Backend trigger failed", detail: data },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Cold email campaign triggered successfully",
      timestamp: new Date().toISOString(),
      detail: data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[CronJob] Failed to reach backend:`, message);
    return NextResponse.json(
      { success: false, error: "Failed to reach backend", detail: message },
      { status: 500 }
    );
  }
}
