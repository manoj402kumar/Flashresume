import { NextResponse } from "next/server";
import crypto from "crypto";

function secureCompare(input: string, secret: string): boolean {
  if (!input || !secret) return false;

  // Hash both to SHA-256 to ensure they are the exact same length (32 bytes) for timingSafeEqual
  const inputHash = crypto.createHash("sha256").update(input).digest();
  const secretHash = crypto.createHash("sha256").update(secret).digest();

  return crypto.timingSafeEqual(inputHash, secretHash);
}

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminUsername || !adminPassword) {
      console.error("Admin credentials are not configured in environment variables");
      return NextResponse.json(
        { error: "Authentication system configuration error" },
        { status: 500 }
      );
    }

    // Secure timing-safe comparison
    const isValid = secureCompare(username, adminUsername) && secureCompare(password, adminPassword);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // If valid, create a secure response
    const response = NextResponse.json({ success: true });

    // Set HttpOnly cookie for the admin session
    // Max age: 60 days (matches Supabase refresh token lifetime)
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
  } catch (error) {
    console.error("Login route error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
