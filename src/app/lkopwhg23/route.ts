import { NextResponse } from "next/server";

// Secret URL access point — visiting /lkopwhg23 sets the admin session cookie
// and redirects directly to the admin dashboard (no username/password needed).
export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/admin", request.url));

  response.cookies.set({
    name: "admin_session",
    value: "authenticated",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 60, // 60 days
  });

  return response;
}
