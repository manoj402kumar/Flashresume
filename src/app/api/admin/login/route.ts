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
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const admin1Email = process.env.ADMIN_USER_1_EMAIL;
    const admin1Password = process.env.ADMIN_USER_1_PASSWORD;
    const admin2Email = process.env.ADMIN_USER_2_EMAIL;
    const admin2Password = process.env.ADMIN_USER_2_PASSWORD;

    if (!admin1Email || !admin1Password || !admin2Email || !admin2Password) {
      console.error("Admin credentials are not configured in environment variables");
      return NextResponse.json(
        { error: "Authentication system configuration error" },
        { status: 500 }
      );
    }

    // Secure timing-safe comparison for Admin 1 or Admin 2
    const isAdmin1 = secureCompare(email, admin1Email) && secureCompare(password, admin1Password);
    const isAdmin2 = secureCompare(email, admin2Email) && secureCompare(password, admin2Password);

    if (!isAdmin1 && !isAdmin2) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // If valid, create a secure response
    const response = NextResponse.json({ success: true });

    // Set HttpOnly cookie for the admin session
    // Max age: 24 hours
    response.cookies.set({
      name: "admin_session",
      value: "authenticated",
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24, 
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
